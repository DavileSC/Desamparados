import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller.js';
import { uploadMiddleware } from '../middleware/upload.middleware.js'; // Asumo que tienes Multer configurado aquí
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js'; 
import { Role } from '@prisma/client';

const uploadRoutes = Router();

/**
 * Subir archivo al servidor.
 * POST /api/storage/upload
 * Headers: { Authorization: Bearer <token>, Content-Type: multipart/form-data }
 * Body: form-data key="file" value=<archivo>
 */
uploadRoutes.post('/upload', 
    authenticateToken, 
    // CORRECCIÓN: Array separado por comas
    checkRole([Role.ADMIN, Role.SECRETARIA, Role.REDES]), 
    uploadMiddleware.single('file'), 
    UploadController.uploadFile
);

export { uploadRoutes };