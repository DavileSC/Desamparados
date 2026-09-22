import { Router } from 'express';
import { type } from 'arktype';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken, resolverSesiones } from '../middleware/session';
import { checkRole } from '../middleware/checkRole';
import { Role } from '@prisma/client';

// 1. Validadores
import { validate } from '../config/validate'; 
import { idParam, password } from '../config/common';
import { authLimiter } from '../config/limiter';
import { recibirAlta, comprobarDocumentosDelAlta } from '../middleware/alta-documentos.middleware';

// 2. Esquemas blindados
import {
  registerSchema,
  reactivacionSchema,
  loginSchema,
  verify2FASchema,
  enable2FASchema,
  disable2FASchema,
  deleteAccountSchema,
  requestPasswordResetSchema,
  logoutSchema
} from '../schemas/auth.schema';

const authRoutes = Router();

// Auxiliar para validar el :id
const validateId = validate(type({ params: { id: idParam } }));
// El token viaja en la URL, asi que el schema se define aqui. La contrasena usa
// el validador compartido de config/common: antes era "string >= 8" a secas, y
// eso dejaba pasar 12345678 o password1234 justo en el flujo de recuperacion.
// El token va en el cuerpo y no en la ruta: una URL acaba en los registros de
// acceso de nginx y de la API, y ese token abre la cuenta durante una hora.
const resetPasswordRequestSchema = type({
  body: { token: type("string").matching(/^[a-f0-9]{64}$/i), newPassword: password }
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
// El alta llega en multipart cuando trae la foto o el certificado de bautismo
// (ver alta-documentos.middleware), y en JSON cuando no.
authRoutes.post('/register', authLimiter, recibirAlta, validate(registerSchema), comprobarDocumentosDelAlta, AuthController.register);

// Pedir volver tras una baja: la web lo ofrece cuando el registro topa con un
// DNI que ya está en el censo. Lleva el mismo limitador que el resto, porque es
// justo lo que usaría quien quisiera ir tanteando DNI uno a uno.
authRoutes.post('/reactivacion', authLimiter, validate(reactivacionSchema), AuthController.solicitarReactivacion);

// Login 
authRoutes.post('/login', authLimiter, validate(loginSchema), AuthController.login);

// Validación 2FA (objetivo clásico de fuerza bruta de códigos de 6 dígitos)
authRoutes.post('/login/2fa', authLimiter, validate(verify2FASchema), AuthController.loginVerify2FA);

// Cierre de sesion: sin autenticar, para que una sesion caducada pueda limpiarse.
authRoutes.post('/logout', validate(logoutSchema), AuthController.logout);

// Recuperación de contraseña
authRoutes.post('/reset-password', authLimiter, validate(requestPasswordResetSchema), AuthController.requestPasswordReset);
authRoutes.post('/reset-password/confirmar', authLimiter, validate(resetPasswordRequestSchema), AuthController.resetPassword);

// ==========================================
//  RUTAS PRIVADAS (Gestión del Perfil)
// ==========================================
// Requieren Header: Authorization: Bearer <TOKEN>

// Sesion actual: el frontend la consulta al arrancar, ya no guarda nada en el
// navegador. Sin authenticateToken a propósito: un invitado sin sesión es el
// caso normal de la web pública, no un error, y /me solo informa de qué
// sesiones hay (puede que ninguna).
authRoutes.get('/me', resolverSesiones, AuthController.me);

// POST y no GET: genera y guarda un secreto nuevo, no es una lectura.
authRoutes.post('/2fa/generate', authenticateToken, checkRole(rolesStaffCMS), AuthController.setup2FAGenerate);
authRoutes.post('/2fa/enable', authenticateToken, checkRole(rolesStaffCMS), validate(enable2FASchema), AuthController.setup2FAEnable);
// Con checkRole como las otras dos: sin él, con la contraseña de un cargo se
// entraba por el área de hermanos (que no pide 2FA) y desde esa sesión se
// probaban códigos contra esta ruta. checkRole exige además origen 'cms'.
authRoutes.post('/2fa/disable', authenticateToken, checkRole(rolesStaffCMS), validate(disable2FASchema), AuthController.setup2FADisable);

// ==========================================
//  RGPD (Datos personales del propio usuario)
// ==========================================

// Derecho de acceso: exportación completa de mis datos (art. 15 RGPD)
authRoutes.get('/mis-datos', authenticateToken, AuthController.exportMisDatos);

// Derecho de supresión: anonimización de mi cuenta (art. 17 RGPD).
// Requiere confirmar con la contraseña actual en el body. Sin checkRole porque
// también la usan los hermanos; el servicio exige origen 'cms' a las cuentas
// del equipo y protege al último ADMIN activo.
authRoutes.delete('/mi-cuenta', authenticateToken, validate(deleteAccountSchema), AuthController.deleteOwnAccount);


// ==========================================
//  RUTAS ADMIN (Emergencia)
// ==========================================

// Rescate: Resetear el 2FA de un usuario.
// Solo ADMIN: quitar el segundo factor de otra cuenta sin código es el poder
// más delicado del sistema. Con SECRETARIA también, una secretaria podía
// dejar sin 2FA a un ADMIN. Nunca sobre la propia cuenta (lo impide el servicio).
authRoutes.post(
  '/admin/reset-2fa/:id', 
  authenticateToken, 
  checkRole([Role.ADMIN]),
  validateId,
  AuthController.adminReset2FA
);

export { authRoutes };
