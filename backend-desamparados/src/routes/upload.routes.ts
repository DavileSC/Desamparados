import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller.js';
import { privateUploadMiddleware, publicUploadMiddleware } from '../middleware/upload.middleware.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js'; 
import { Role } from '@prisma/client';
import { type } from 'arktype';
import { validate } from '../config/validate.js';

const uploadRoutes = Router();

/**
 * Subir archivo al servidor.
 * POST /api/upload/public y /api/upload/private
 * Headers: { Authorization: Bearer <token>, Content-Type: multipart/form-data }
 * Body: form-data key="file" value=<archivo>
 */
const cmsRoles = [Role.ADMIN, Role.TESORERIA, Role.ALBACERIA, Role.HERMANO_MAYOR, Role.REDES, Role.SECRETARIA];
const validateFilename = validate(type({ params: { filename: type('string').matching(/^[a-f0-9]{32}\.(jpg|jpeg|png|webp|pdf)$/i) } }));

// Mismo rol que para subir: si un hermano raso no puede colocar un documento
// en la carpeta privada, tampoco debe poder descargarlo. El nombre es un hash
// de 32 caracteres y no se adivina, pero eso es seguridad por oscuridad y basta
// con que alguien reenvíe el enlace.
uploadRoutes.get('/private/:filename',
    authenticateToken,
    checkRole(cmsRoles),
    validateFilename,
    UploadController.downloadPrivate
);
uploadRoutes.post('/public', authenticateToken, checkRole([Role.ADMIN, Role.SECRETARIA, Role.REDES]), publicUploadMiddleware.single('file'), UploadController.uploadFile);
uploadRoutes.post('/private', authenticateToken, checkRole(cmsRoles), privateUploadMiddleware.single('file'), UploadController.uploadFile);

export { uploadRoutes };
