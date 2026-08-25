import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { handleHttp } from '../utils/error.handle';
import { RegisterDto, LoginDto } from '../dtos/auth.dto';
import { AuditService } from '../services/audit.service';

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

      // El frontend evaluará response.status ('OK' o '2FA_NEEDED')
      res.status(200).json(response);

    } catch (error) {
      handleHttp(res, error, 'Credenciales incorrectas');
    }
  }

  static async loginVerify2FA(req: Request, res: Response) {
    try {
      const { userId, token2fa } = req.body;
      if (!userId || !token2fa) throw new Error('Faltan datos');

      const response = await AuthService.verifyLogin2FA(userId, token2fa);
      res.status(200).json(response);
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
