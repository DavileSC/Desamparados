import { Request, Response } from 'express';
import { MENSAJE_ALTA, RegistroService } from '../services/registro.service';
import { DobleFactorService } from '../services/doble-factor.service';
import { MisDatosService } from '../services/mis-datos.service';
import { AuthService, AreaHermanosApagadaError, CuentaSinCmsError, Testigo2FACaducadoError } from '../services/auth.service';
import { handleHttp } from '../utils/error.handle';
import { RegisterDto, LoginDto } from '../dtos/auth.dto';
import { AuditoriaService } from '../services/auditoria.service';
import { trampaRellena } from '../domain/senales-de-robot';
import { ponerCookieSesion, ponerCookie2FA, limpiarCookie2FA, limpiarCookieSesion, limpiarCookiesAuth, COOKIE_2FA } from '../utils/cookies';
import type { AreaSesion } from '../utils/cookies';
import { duracionSesionSegundos, verifyToken } from '../utils/jwt.handle';
import type { AuthTokenPayload } from '../utils/jwt.handle';
import { resolverSesiones } from '../middleware/session';
import { manejar } from '../utils/manejar';
import { AprobacionEntradaService } from '../services/aprobacion/aprobacion-entrada.service';

/** El testigo del primer factor, leído de su cookie, con lo que el segundo paso necesita. */
interface TestigoLeido {
  cookie: string;
  id: number;
  recordarme: boolean;
  origen: 'cms' | 'hermanos';
  paso2fa?: number | null;
  emitidoMs?: number;
}

/**
 * El usuario del segundo paso sale del testigo del primer factor, nunca del
 * cuerpo: así el segundo factor queda vinculado a haber superado la
 * contraseña. Sin testigo válido responde 401 y devuelve null.
 */
function leerTestigo(req: Request, res: Response): TestigoLeido | null {
  const cookie: string | undefined = req.cookies?.[COOKIE_2FA];
  const payload = cookie ? verifyToken(cookie, '2fa_pending') : null;

  // Solo la cookie del 2FA: la de sesión puede ser una del área de hermanos
  // perfectamente válida, y borrarla dejaba al frontend creyéndose con
  // sesión mientras el navegador ya no la tenía.
  if (!cookie || !payload) {
    limpiarCookie2FA(res);
    res.status(401).json({
      error: 'PENDING_2FA_REQUIRED',
      message: 'La verificación ha caducado. Vuelve a introducir tu email y contraseña.'
    });
    return null;
  }
  return {
    cookie,
    id: payload.id,
    // El "recordarme" y el origen del primer factor viajan dentro del testigo:
    // así el segundo paso no puede inventárselos.
    recordarme: payload.rem === true,
    // Sin el claim no es CMS: la gracia de migración ya no tiene a quién proteger.
    origen: payload.origen === 'cms' ? 'cms' : 'hermanos',
    paso2fa: payload.paso2fa,
    emitidoMs: payload.emitidoMs,
  };
}

/**
 * El segundo factor pasado, por el camino que sea: fuera el testigo y la
 * cookie de sesión de su área. El área sale del testigo del primer factor,
 * nunca del cuerpo: si no, el segundo paso podría inventarse un origen 'cms'
 * sin haber pasado por el acceso del CMS.
 */
function entregarSesion(
  res: Response,
  testigo: TestigoLeido,
  sesion: { token: string; user: { role: string } },
  extra: Record<string, unknown> = {},
) {
  limpiarCookie2FA(res);
  ponerCookieSesion(res, testigo.origen, sesion.token, sesion.user.role, testigo.recordarme);
  res.status(200).json({ ...extra, status: 'OK', user: sesion.user });
}

function fallarSegundoFactor(res: Response, error: unknown, mensaje: string) {
  // Testigo ya gastado: fuera su cookie (solo esa) y el mismo código que
  // cuando falta, para que el frontend vuelva a la contraseña.
  if (error instanceof Testigo2FACaducadoError) {
    limpiarCookie2FA(res);
    return res.status(401).json({ error: error.codigo, message: error.message });
  }
  handleHttp(res, error, mensaje);
}

export class AuthController {

  // =================================================================
  //  REGISTRO (Solicitud Inactiva)
  // =================================================================

  static register = manejar('Error registrando usuario', async (req, res) => {
    const { comentarioAdicional, ...body } = req.body as RegisterDto;

    // Al robot se le responde lo mismo que a una persona: si notara la
    // diferencia, aprendería a esquivar la trampa. No se crea nada ni se
    // manda ningún correo a Secretaría.
    //
    // Aquí solo se mira el campo trampa, y NO el tiempo de relleno que sí
    // descarta en el formulario de contacto: el alta son varios pasos, nadie
    // la termina en tres segundos, y perder en silencio el alta de un hermano
    // de verdad es mucho peor que perder un mensaje. La trampa, en cambio, es
    // segura: quien usa la web no puede rellenarla sin querer.
    if (trampaRellena(comentarioAdicional)) {
      console.warn('[Alta] Solicitud descartada como spam (campo trampa relleno).');
      return res.status(201).json({
        fichas: (body.menores?.length ?? 0) + (body.titular ? 1 : 0),
        message: MENSAJE_ALTA,
      });
    }

    const { creada, ...respuesta } = await RegistroService.registerUser(
      { ...body, documentos: req.documentosDelAlta }, AuditoriaService.metaFromReq(req),
    );
    // Ya están en la ficha: que no los borre la limpieza de alta-documentos.
    // Si el alta chocó con algo ya registrado, no hay ficha y se borran.
    res.locals.conservarDocumentos = creada;

    // El mismo 201 y el mismo cuerpo se haya creado o no: ver registerUser.
    res.status(201).json(respuesta);
  });

  /**
   * Pedir volver tras una baja. Devuelve siempre 200 con el mismo mensaje,
   * exista o no la ficha: distinguir convertiría esto en una forma de averiguar
   * qué DNI están en el censo.
   */
  static solicitarReactivacion = manejar('Error pidiendo la reactivación', async (req, res) => {
    res.status(200).json(await RegistroService.solicitarReactivacion(req.body));
  });

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
      const response = await AuthService.loginUser({ ...body, recordarme, contexto }, req.ip ?? 'desconocida', req.headers['user-agent']);

      // Con 2FA activo no hay sesion todavia: solo el testigo del primer factor.
      // Y, con móviles apuntados, el número que cuadrar con el que les llega.
      if (response.status === '2FA_NEEDED') {
        const { pendingToken, ...respuesta } = response;
        ponerCookie2FA(res, pendingToken);
        return res.status(200).json(respuesta);
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
      // El aviso de área apagada va tal cual: la pantalla de acceso solo tiene
      // que enseñarlo, no reconocer un código.
      if (error instanceof AreaHermanosApagadaError) {
        return res.status(404).json({ message: error.message });
      }
      handleHttp(res, error, 'Credenciales incorrectas');
    }
  }

  static async loginVerify2FA(req: Request, res: Response) {
    try {
      const testigo = leerTestigo(req, res);
      if (!testigo) return;

      const { token2fa } = req.body;
      const response = await AuthService.verifyLogin2FA(testigo.id, token2fa, testigo.recordarme, testigo.origen, testigo);
      entregarSesion(res, testigo, response);
    } catch (error) {
      // El servicio lanza mensajes de negocio específicos ("Cuenta bloqueada temporalmente...",
      // "Código incorrecto o expirado") que deben llegar al usuario tal cual.
      fallarSegundoFactor(res, error, 'Código 2FA incorrecto o expirado');
    }
  }

  // =================================================================
  //  APROBAR LA ENTRADA DESDE EL MÓVIL
  // =================================================================

  /**
   * El ordenador pregunta si su aprobación ya está. Mientras espera, 200 con
   * el estado (no cuenta como fallo para el limitador); aprobada, la sesión.
   */
  static async esperarAprobacion(req: Request, res: Response) {
    try {
      const testigo = leerTestigo(req, res);
      if (!testigo) return;
      const resultado = await AprobacionEntradaService.consultar(testigo.cookie, testigo);
      if (resultado.estado !== 'APROBADA') return res.status(200).json({ estado: resultado.estado });
      entregarSesion(res, testigo, resultado, { estado: 'APROBADA' });
    } catch (error) {
      fallarSegundoFactor(res, error, 'No se ha podido comprobar la aprobación');
    }
  }

  /** Entrar desde el mismo móvil apuntado: su clave hace de segundo factor. */
  static async entrarDesdeEsteMovil(req: Request, res: Response) {
    try {
      const testigo = leerTestigo(req, res);
      if (!testigo) return;
      const { dispositivo, clave } = req.body as { dispositivo: number; clave: string };
      const response = await AprobacionEntradaService.entrarDesdeEsteMovil(testigo, dispositivo, clave, AuditoriaService.metaFromReq(req));
      entregarSesion(res, testigo, response);
    } catch (error) {
      fallarSegundoFactor(res, error, 'No se ha podido entrar desde este móvil');
    }
  }

  // Las tres del móvil van sin sesión: el aviso puede abrirse con la del CMS
  // caducada. Lo que prueba quién es, la clave del dispositivo, va en el cuerpo.
  static verAprobacion = manejar('No se ha podido abrir la aprobación', async (req, res) => {
    const { dispositivo, clave } = req.body as { dispositivo: number; clave: string };
    res.status(200).json(await AprobacionEntradaService.ver(String(req.params.id), dispositivo, clave));
  });

  static aprobarEntrada = manejar('No se ha podido aprobar la entrada', async (req, res) => {
    const { dispositivo, clave, numero } = req.body as { dispositivo: number; clave: string; numero: number };
    res.status(200).json(await AprobacionEntradaService.aprobar(String(req.params.id), dispositivo, clave, numero, AuditoriaService.metaFromReq(req)));
  });

  static rechazarEntrada = manejar('No se ha podido rechazar la entrada', async (req, res) => {
    const { dispositivo, clave } = req.body as { dispositivo: number; clave: string };
    res.status(200).json(await AprobacionEntradaService.rechazar(String(req.params.id), dispositivo, clave, AuditoriaService.metaFromReq(req)));
  });

  static listarMoviles = manejar('No se han podido cargar tus móviles', async (req, res) => {
    res.status(200).json(await AprobacionEntradaService.listar(req.user!.id));
  });

  static apuntarMovil = manejar('No se ha podido apuntar el móvil', async (req, res) => {
    const { password, nombre, suscripcion } = req.body as {
      password: string; nombre: string; suscripcion: { endpoint: string; keys: { p256dh: string; auth: string } };
    };
    const resultado = await AprobacionEntradaService.apuntar(req.user!.id, {
      password, nombre, suscripcion: { endpoint: suscripcion.endpoint, p256dh: suscripcion.keys.p256dh, auth: suscripcion.keys.auth },
    }, AuditoriaService.metaFromReq(req));
    res.status(201).json(resultado);
  });

  static quitarMovil = manejar('No se ha podido quitar el móvil', async (req, res) => {
    await AprobacionEntradaService.quitar(req.user!.id, Number(req.params.id), AuditoriaService.metaFromReq(req));
    res.status(204).end();
  });

  // =================================================================
  //  RECUPERACIÓN DE CONTRASEÑA
  // =================================================================

  static resetPassword = manejar('Error al restablecer contraseña', async (req, res) => {
    const { token, newPassword } = req.body;
    const { message } = await AuthService.resetPassword(token, newPassword);
    res.status(200).json({ message });
  });

  static requestPasswordReset = manejar('Error al solicitar recuperación', async (req, res) => {
      const { email, contexto } = req.body;
      const result = await AuthService.requestPasswordReset(email, contexto);
      res.status(200).json(result);
  });
  // =================================================================
  //  CONFIGURACIÓN 2FA (Desde el Perfil - Requiere Auth)
  // =================================================================

  static setup2FAGenerate = manejar('Error generando QR', async (req, res) => {
    const userId = req.user!.id; 
    const data = await DobleFactorService.generate2FAQR(userId);
    res.status(200).json(data);
  });

  static setup2FAEnable = manejar('Error al activar 2FA. Código incorrecto.', async (req, res) => {
    const userId = req.user!.id;
    const { token2fa } = req.body;

    const result = await DobleFactorService.enable2FA(userId, token2fa);
    res.status(200).json(result);
  });

  static setup2FADisable = manejar('Error al desactivar 2FA. Código incorrecto o expirado.', async (req, res) => {
    const userId = req.user!.id;
    const { token2fa } = req.body;

    const result = await DobleFactorService.disable2FA(userId, token2fa);
    res.status(200).json(result);
  });

  // =================================================================
  //  ADMINISTRACIÓN (Rescate)
  // =================================================================

  static adminReset2FA = manejar('Error reseteando usuario', async (req, res) => {
    // El id llega comprobado: la ruta pasa por `validateId`.
    const result = await DobleFactorService.forceDisable2FA(Number(req.params.id), req.user!.id, AuditoriaService.metaFromReq(req));
    res.status(200).json(result);
  });

  // =================================================================
  //  SESION ACTUAL Y CIERRE
  // =================================================================

  /**
   * Las sesiones abiertas de este navegador, una por área. Responde 200 aunque
   * no haya ninguna: un visitante sin sesión es el caso normal de la web
   * pública, y devolverle un 401 hacía que el arranque del frontend lo tratara
   * como error y lo reintentara.
   */
  static me = manejar('No se ha podido recuperar la sesión', async (req, res) => {
    const perfil = async (sesion: AuthTokenPayload | null) => {
      if (!sesion) return null;
      const datos = await AuthService.perfilSesion(sesion.id);
      // El origen viene del propio JWT; la BD no lo guarda.
      return { ...datos, origen: sesion.origen };
    };

    const [cms, hermano] = await Promise.all([perfil(req.sesiones.cms), perfil(req.sesiones.hermano)]);
    res.status(200).json({ cms, hermano });
  });

  /**
   * Sin authenticateToken a propósito: una sesión ya caducada también tiene que
   * poder limpiar su cookie. Es idempotente.
   *
   * Cierra el área que se pida, y las dos si no se pide ninguna. Borrar solo la
   * cookie dejaba vivo el token: quien lo hubiera copiado seguía dentro sus 8 h
   * (o días con «Recuérdame») aunque se hubiera cerrado sesión en un equipo
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
  static exportMisDatos = manejar('Error exportando tus datos', async (req, res) => {
    const userId = req.user!.id;
    const data = await MisDatosService.exportMisDatos(userId, AuditoriaService.metaFromReq(req));
    res.status(200).json(data);
  });

  /**
   * Cambiar la contraseña con la sesión abierta. Cierra todas las sesiones de
   * la cuenta y vuelve a dar una a las áreas que traía este navegador (las
   * dos, si un cargo tiene abiertas la del CMS y la de hermanos), con la
   * misma duración que tenían.
   */
  static cambiarContrasena = manejar('Error cambiando la contraseña', async (req, res) => {
    const userId = req.user!.id;
    const { actual, nueva } = req.body as { actual: string; nueva: string };
    const sesiones = (['cms', 'hermanos'] as const)
      .map((area) => ({ area, sesion: area === 'cms' ? req.sesiones.cms : req.sesiones.hermano }))
      .filter(({ sesion }) => sesion?.id === userId)
      .map(({ area, sesion }) => ({
        area,
        // «Recuérdame» no viaja en el token de sesión: se deduce de lo que
        // dura, que con él pasa de la duración normal del rol.
        recordarme: typeof sesion!.exp === 'number' && typeof sesion!.iat === 'number'
          && sesion!.exp - sesion!.iat > duracionSesionSegundos(sesion!.role) + 60,
      }));
    const resultado = await AuthService.cambiarContrasena(userId, actual, nueva, sesiones, AuditoriaService.metaFromReq(req));
    for (const s of resultado.sesiones) ponerCookieSesion(res, s.area, s.token, s.role, s.recordarme);
    res.status(200).json({ message: resultado.message });
  });

  /** Derecho de supresión (art. 17 RGPD): anonimiza la cuenta. Requiere contraseña. */
  static deleteOwnAccount = manejar('Error eliminando la cuenta', async (req, res) => {
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
    const result = await MisDatosService.deleteOwnAccount(userId, password, origen, AuditoriaService.metaFromReq(req));
    res.status(200).json(result);
  });
}
