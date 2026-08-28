import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { handleHttp } from '../utils/error.handle';
import { RegisterDto, LoginDto } from '../dtos/auth.dto';
import { AuditService } from '../services/audit.service';
import { ponerCookieSesion, ponerCookie2FA, limpiarCookie2FA, limpiarCookiesAuth, COOKIE_2FA } from '../utils/cookies';
import { verifyToken } from '../utils/jwt.handle';

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
      const response = await AuthService.loginUser(body);

      // Con 2FA activo no hay sesion todavia: solo el testigo del primer factor.
      if (response.status === '2FA_NEEDED') {
        ponerCookie2FA(res, response.pendingToken);
        return res.status(200).json({ status: '2FA_NEEDED', message: response.message });
      }

      // El token va en la cookie httpOnly, nunca en el cuerpo.
      ponerCookieSesion(res, response.token, response.user.role);
      res.status(200).json({ status: 'OK', user: response.user });

    } catch (error) {
      handleHttp(res, error, 'Credenciales incorrectas');
    }
  }

  static async loginVerify2FA(req: Request, res: Response) {
    try {
      // El usuario sale del testigo del primer factor, nunca del cuerpo: asi el
      // segundo factor queda vinculado a haber superado la contrasena.
      const pendiente = req.cookies?.[COOKIE_2FA];
      const payload = pendiente ? verifyToken(pendiente, '2fa_pending') : null;

      if (!payload) {
        limpiarCookiesAuth(res);
        return res.status(401).json({
          error: 'PENDING_2FA_REQUIRED',
          message: 'La verificación ha caducado. Vuelve a introducir tu email y contraseña.'
        });
      }

      const { token2fa } = req.body;
      const response = await AuthService.verifyLogin2FA(payload.id, token2fa);

      limpiarCookie2FA(res);
      ponerCookieSesion(res, response.token, response.user.role);
      res.status(200).json({ status: 'OK', user: response.user });
    } catch (error) {
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
      const token = req.params.token as string;
      const { newPassword } = req.body;
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

      const result = await AuthService.forceDisable2FA(targetUserId, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (error) {
      handleHttp(res, error, 'Error reseteando usuario');
    }
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
      const result = await AuthService.deleteOwnAccount(userId, password, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (error) {
      handleHttp(res, error, 'Error eliminando la cuenta');
    }
  }
}
