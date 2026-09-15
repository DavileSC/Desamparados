import { Request, Response } from 'express';
import { AuthService, CuentaSinCmsError, Testigo2FACaducadoError } from '../services/auth.service';
import { handleHttp } from '../utils/error.handle';
import { RegisterDto, LoginDto } from '../dtos/auth.dto';
import { AuditService } from '../services/audit.service';
import { ponerCookieSesion, ponerCookie2FA, limpiarCookie2FA, limpiarCookieSesion, limpiarCookiesAuth, COOKIE_2FA } from '../utils/cookies';
import type { AreaSesion } from '../utils/cookies';
import { verifyToken } from '../utils/jwt.handle';
import type { AuthTokenPayload } from '../utils/jwt.handle';
import { resolverSesiones } from '../middleware/session';

export class AuthController {

  // =================================================================
  //  REGISTRO (Solicitud Inactiva)
  // =================================================================

  static async register(req: Request, res: Response) {
    try {
      const body: RegisterDto = req.body;
      const result = await AuthService.registerUser(body);

      // Ahora devuelve un 201 Created con el mensaje de "Pásate por Secretaría"
      res.status(201).json(result);
    } catch (error) {
      handleHttp(res, error, 'Error registrando usuario');
    }
  }

  // =================================================================
  //  LOGIN
  // =================================================================

  static async login(req: Request, res: Response) {
    try {
      const body: LoginDto = req.body;
      const recordarme = body.recordarme === true;
      const contexto = body.contexto === 'hermanos' ? 'hermanos' : 'cms';
      // La IP entra en el bloqueo por fallos: cinco intentos desde un sitio no
      // deben dejar a la cuenta fuera en todos los demás.
      const response = await AuthService.loginUser({ ...body, recordarme, contexto }, req.ip ?? 'desconocida');

      // Con 2FA activo no hay sesion todavia: solo el testigo del primer factor.
      if (response.status === '2FA_NEEDED') {
        ponerCookie2FA(res, response.pendingToken);
        return res.status(200).json({ status: '2FA_NEEDED', message: response.message });
      }

      // El token va en la cookie httpOnly, nunca en el cuerpo.
      // Solo la cookie de SU área: entrar por un acceso no puede tirar la
      // sesión del otro. Es el hallazgo que abrió esta fase.
      ponerCookieSesion(res, contexto, response.token, response.user.role, recordarme);
      res.status(200).json({ status: 'OK', user: response.user });

    } catch (error) {
      // Con código propio para que el acceso del CMS pinte su aviso con enlace
      // al área de hermanos, sin tener que reconocer el texto del mensaje.
      if (error instanceof CuentaSinCmsError) {
        return res.status(403).json({ error: error.codigo, message: error.message });
      }
      handleHttp(res, error, 'Credenciales incorrectas');
    }
  }

  static async loginVerify2FA(req: Request, res: Response) {
    try {
      // El usuario sale del testigo del primer factor, nunca del cuerpo: asi el
      // segundo factor queda vinculado a haber superado la contrasena.
      const pendiente = req.cookies?.[COOKIE_2FA];
      const payload = pendiente ? verifyToken(pendiente, '2fa_pending') : null;

      // Solo la cookie del 2FA: la de sesión puede ser una del área de hermanos
      // perfectamente válida, y borrarla dejaba al frontend creyéndose con
      // sesión mientras el navegador ya no la tenía.
      if (!payload) {
        limpiarCookie2FA(res);
        return res.status(401).json({
          error: 'PENDING_2FA_REQUIRED',
          message: 'La verificación ha caducado. Vuelve a introducir tu email y contraseña.'
        });
      }

      const { token2fa } = req.body;
      // El "recordarme" y el origen del primer factor viajan dentro del testigo:
      // así el segundo paso no puede inventárselos.
      const recordarme = payload.rem === true;
      // Sin el claim no es CMS: la gracia de migración ya no tiene a quién proteger.
      const origen = payload.origen === 'cms' ? 'cms' : 'hermanos';
      const response = await AuthService.verifyLogin2FA(payload.id, token2fa, recordarme, origen, {
        paso2fa: payload.paso2fa,
        emitidoMs: payload.emitidoMs
      });

      limpiarCookie2FA(res);
      // El área sale del testigo del primer factor, nunca del cuerpo: si no,
      // el segundo paso podría inventarse un origen 'cms' sin haber pasado
      // por el acceso del CMS. Es la misma regla de arriba en `origen`.
      ponerCookieSesion(res, origen, response.token, response.user.role, recordarme);
      res.status(200).json({ status: 'OK', user: response.user });
    } catch (error) {
      // Testigo ya gastado: fuera su cookie (solo esa, como arriba) y el mismo
      // código que cuando falta, para que el frontend vuelva a la contraseña.
      if (error instanceof Testigo2FACaducadoError) {
        limpiarCookie2FA(res);
        return res.status(401).json({ error: error.codigo, message: error.message });
      }
      // El servicio lanza mensajes de negocio específicos ("Cuenta bloqueada temporalmente...",
      // "Código incorrecto o expirado") que deben llegar al usuario tal cual.
      handleHttp(res, error, 'Código 2FA incorrecto o expirado');
    }
  }

  // =================================================================
  //  RECUPERACIÓN DE CONTRASEÑA
  // =================================================================

  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      const result = await AuthService.resetPassword(token, newPassword);
      res.status(200).json(result);
    } catch (error) {
      handleHttp(res, error, 'Error al restablecer contraseña');
    }
  }

    static async requestPasswordReset(req: Request, res: Response) {
      try {
        const { email } = req.body;
        const result = await AuthService.requestPasswordReset(email);
        res.status(200).json(result);
      } catch (error) {
        handleHttp(res, error, 'Error al solicitar recuperación');
      }
  }
  // =================================================================
  //  CONFIGURACIÓN 2FA (Desde el Perfil - Requiere Auth)
  // =================================================================

  static async setup2FAGenerate(req: Request, res: Response) {
    try {
      const userId = req.user!.id; 
      const data = await AuthService.generate2FAQR(userId);
      res.status(200).json(data);
    } catch (error) {
      handleHttp(res, error, 'Error generando QR');
    }
  }

  static async setup2FAEnable(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { token2fa } = req.body;

      const result = await AuthService.enable2FA(userId, token2fa);
      res.status(200).json(result);
    } catch (error) {
      handleHttp(res, error, 'Error al activar 2FA. Código incorrecto.');
    }
  }

  static async setup2FADisable(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { token2fa } = req.body;

      const result = await AuthService.disable2FA(userId, token2fa);
      res.status(200).json(result);
    } catch (error) {
      handleHttp(res, error, 'Error al desactivar 2FA. Código incorrecto o expirado.');
    }
  }

  // =================================================================
  //  ADMINISTRACIÓN (Rescate)
  // =================================================================

  static async adminReset2FA(req: Request, res: Response) {
    try {
      const targetUserId = Number(req.params.id);
      if (isNaN(targetUserId)) return handleHttp(res, null, 'ID inválido', 400);

      const result = await AuthService.forceDisable2FA(targetUserId, req.user!.id, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (error) {
      handleHttp(res, error, 'Error reseteando usuario');
    }
  }

  // =================================================================
  //  SESION ACTUAL Y CIERRE
  // =================================================================

  /**
   * Las sesiones abiertas de este navegador, una por área. Responde 200 aunque
   * no haya ninguna: un visitante sin sesión es el caso normal de la web
   * pública, y devolverle un 401 hacía que el arranque del frontend lo tratara
   * como error y lo reintentara.
   */
  static async me(req: Request, res: Response) {
    try {
      const perfil = async (sesion: AuthTokenPayload | null) => {
        if (!sesion) return null;
        const datos = await AuthService.perfilSesion(sesion.id);
        // El origen viene del propio JWT; la BD no lo guarda.
        return { ...datos, origen: sesion.origen };
      };

      const [cms, hermano] = await Promise.all([perfil(req.sesiones.cms), perfil(req.sesiones.hermano)]);
      res.status(200).json({ cms, hermano });
    } catch (error) {
      handleHttp(res, error, 'No se ha podido recuperar la sesión');
    }
  }

  /**
   * Sin authenticateToken a propósito: una sesión ya caducada también tiene que
   * poder limpiar su cookie. Es idempotente.
   *
   * Cierra el área que se pida, y las dos si no se pide ninguna. Borrar solo la
   * cookie dejaba vivo el token: quien lo hubiera copiado seguía dentro sus 8 h
   * (o 72 h con «Recordarme») aunque se hubiera cerrado sesión en un equipo
   * compartido. Por eso además se revoca en el servidor.
   */
  static async logout(req: Request, res: Response) {
    const area: AreaSesion | undefined =
      req.body?.area === 'cms' ? 'cms' : req.body?.area === 'hermanos' ? 'hermanos' : undefined;

    try {
      await resolverSesiones(req, res, () => {});
      const sesiones = area === 'cms' ? [req.sesiones.cms]
        : area === 'hermanos' ? [req.sesiones.hermano]
        : [req.sesiones.cms, req.sesiones.hermano];
      for (const sesion of sesiones) {
        if (sesion) await AuthService.cerrarSesionesDe(sesion.id, area);
      }
    } catch (error) {
      // La cookie se borra igual: el cierre en el navegador no puede depender
      // de la base de datos. Queda en el log para que se sepa que el token no
      // se revocó.
      console.error('[Logout] No se pudo revocar la sesión en el servidor:', error);
    }

    if (area) limpiarCookieSesion(res, area);
    else limpiarCookiesAuth(res);
    res.status(204).end();
  }

  // =================================================================
  //  RGPD: DATOS PROPIOS (Acceso y Supresión)
  // =================================================================

  /** Derecho de acceso (art. 15 RGPD): exporta todos los datos personales. */
  static async exportMisDatos(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const data = await AuthService.exportMisDatos(userId, AuditService.metaFromReq(req));
      res.status(200).json(data);
    } catch (error) {
      handleHttp(res, error, 'Error exportando tus datos');
    }
  }

  /** Derecho de supresión (art. 17 RGPD): anonimiza la cuenta. Requiere contraseña. */
  static async deleteOwnAccount(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { password } = req.body;
      // El área efectiva se saca de req.sesiones y no de req.user.origen: la
      // tarea 4 dejó req.user por defecto como hermano ?? cms, así que un
      // cargo con las dos cookies abiertas (esta ruta no lleva checkRole,
      // porque también la usan los hermanos) mandaba origen 'hermanos' al
      // servicio aunque tuviera sesión de CMS válida, y el borrado RGPD de su
      // propia cuenta de staff salía rechazado por error. Mirar si hay sesión
      // de CMS DE ESTE MISMO usuario es la misma garantía de antes ("esta
      // persona tiene sesión de CMS en este navegador"), ni más permisiva ni
      // más estricta.
      const origen: 'cms' | 'hermanos' = req.sesiones.cms?.id === userId ? 'cms' : 'hermanos';
      const result = await AuthService.deleteOwnAccount(userId, password, origen, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (error) {
      handleHttp(res, error, 'Error eliminando la cuenta');
    }
  }
}
