import { Router } from 'express';
import { type } from 'arktype';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/session';
import { checkRole } from '../middleware/checkRole';
import { Role } from '@prisma/client';

// 1. Validadores
import { validate } from '../config/validate'; 
import { idParam, password } from '../config/common';
import { authLimiter } from '../config/limiter';

// 2. Esquemas blindados
import { 
  registerSchema, 
  loginSchema, 
  verify2FASchema, 
  enable2FASchema,
  disable2FASchema,
  deleteAccountSchema,
  requestPasswordResetSchema
} from '../schemas/auth.schema';

const authRoutes = Router();

// Auxiliar para validar el :id
const validateId = validate(type({ params: { id: idParam } }));
// El token viaja en la URL, asi que el schema se define aqui. La contrasena usa
// el validador compartido de config/common: antes era "string >= 8" a secas, y
// eso dejaba pasar 12345678 o password1234 justo en el flujo de recuperacion.
const resetPasswordRequestSchema = type({
  params: { token: type("string").matching(/^[a-f0-9]{64}$/i) },
  body: { newPassword: password }
});

// El 2FA es exclusivo del personal con acceso al CMS (staff).
// Un hermano normal (USER) de la app familiar no puede activarlo.
const rolesStaffCMS = [
  Role.ADMIN,
  Role.TESORERIA,
  Role.ALBACERIA,
  Role.HERMANO_MAYOR,
  Role.REDES,
  Role.SECRETARIA
];

// ==========================================
//  RUTAS PÚBLICAS (Entrada al sistema)
// ==========================================
// Todas llevan el limitador estricto anti fuerza bruta (10 intentos/15 min por IP).
// Las rutas autenticadas (2FA setup, rescate) NO lo llevan: ya exigen token válido
// y les basta el limitador global.

// Registro (Crea solicitud inactiva)
authRoutes.post('/register', authLimiter, validate(registerSchema), AuthController.register);

// Login 
authRoutes.post('/login', authLimiter, validate(loginSchema), AuthController.login);

// Validación 2FA (objetivo clásico de fuerza bruta de códigos de 6 dígitos)
authRoutes.post('/login/2fa', authLimiter, validate(verify2FASchema), AuthController.loginVerify2FA);

// Cierre de sesion: sin autenticar, para que una sesion caducada pueda limpiarse.
authRoutes.post('/logout', AuthController.logout);

// Recuperación de contraseña
authRoutes.post('/reset-password', authLimiter, validate(requestPasswordResetSchema), AuthController.requestPasswordReset);
authRoutes.post('/reset-password/:token', authLimiter, validate(resetPasswordRequestSchema), AuthController.resetPassword);

// ==========================================
//  RUTAS PRIVADAS (Gestión del Perfil)
// ==========================================
// Requieren Header: Authorization: Bearer <TOKEN>

// Sesion actual: el frontend la consulta al arrancar, ya no guarda nada en el navegador.
authRoutes.get('/me', authenticateToken, AuthController.me);

authRoutes.get('/2fa/generate', authenticateToken, checkRole(rolesStaffCMS), AuthController.setup2FAGenerate);
authRoutes.post('/2fa/enable', authenticateToken, checkRole(rolesStaffCMS), validate(enable2FASchema), AuthController.setup2FAEnable);
authRoutes.post('/2fa/disable', authenticateToken, validate(disable2FASchema), AuthController.setup2FADisable);

// ==========================================
//  RGPD (Datos personales del propio usuario)
// ==========================================

// Derecho de acceso: exportación completa de mis datos (art. 15 RGPD)
authRoutes.get('/mis-datos', authenticateToken, AuthController.exportMisDatos);

// Derecho de supresión: anonimización de mi cuenta (art. 17 RGPD).
// Requiere confirmar con la contraseña actual en el body.
authRoutes.delete('/mi-cuenta', authenticateToken, validate(deleteAccountSchema), AuthController.deleteOwnAccount);


// ==========================================
//  RUTAS ADMIN (Emergencia)
// ==========================================

// Rescate: Resetear el 2FA de un usuario
authRoutes.post(
  '/admin/reset-2fa/:id', 
  authenticateToken, 
  checkRole([Role.ADMIN, Role.SECRETARIA]), // Añadida Secretaria por si el Admin no está
  validateId,
  AuthController.adminReset2FA
);

export { authRoutes };
