import { Router } from 'express';
import { SubidaController } from '../controllers/subida.controller.js';
import { privateUploadMiddleware, publicUploadMiddleware, videoUploadMiddleware } from '../middleware/upload.middleware.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js'; 
import { Role } from '@prisma/client';
import { type } from 'arktype';
import { validate } from '../config/validate.js';
import { ROLES_CENSO } from './roles.js';

const subidaRoutes = Router();

/**
 * Subir archivo al servidor.
 * POST /api/upload/public y /api/upload/private
 * Headers: { Authorization: Bearer <token>, Content-Type: multipart/form-data }
 * Body: form-data key="file" value=<archivo>
 */
// Lo que guarda storage/private son los documentos del alta (la foto y el
// certificado de bautismo de cada ficha): solo los abre quien gestiona el
// censo. Tesorería, Albacería y Redes no tienen nada ahí que les toque, y con
// la lista entera de staff cualquiera con un enlace reenviado veía la foto y
// la partida de bautismo de un hermano.
const rolesDocumentosPrivados = ROLES_CENSO;
// Las fotos públicas: noticias y publicaciones (Hermano Mayor, Redes), y
// también los enseres del inventario, la tienda y los apadrinamientos, que
// llevan Albacería y Tesorería y tienen su campo de imagen.
const rolesFotosPublicas = [Role.ADMIN, Role.SECRETARIA, Role.REDES, Role.HERMANO_MAYOR, Role.ALBACERIA, Role.TESORERIA];
// doc y docx: los certificados de bautismo que se adjuntan al alta.
const validateFilename = validate(type({ params: { filename: type('string').matching(/^[a-f0-9]{32}\.(jpg|jpeg|png|webp|pdf|doc|docx)$/i) } }));

// Mismo rol que para subir. El nombre es un hash de 32 caracteres y no se
// adivina, pero eso es seguridad por oscuridad y basta con que alguien
// reenvíe el enlace.
subidaRoutes.get('/private/:filename',
    authenticateToken,
    checkRole(rolesDocumentosPrivados),
    validateFilename,
    SubidaController.downloadPrivate
);
// El Hermano Mayor edita noticias y publicaciones (news.routes.ts, publication.routes.ts):
// sin él aquí, el CMS le dejaba editar una noticia pero la subida de su foto le daba 403.
subidaRoutes.post('/public', authenticateToken, checkRole(rolesFotosPublicas), publicUploadMiddleware.single('file'), SubidaController.subirArchivo);
// Vídeos del hero y de las galerías: los mismos roles que suben fotos públicas.
// Nunca a la carpeta privada ni desde el perfil de un hermano.
subidaRoutes.post('/video/:uso', authenticateToken, checkRole([Role.ADMIN, Role.SECRETARIA, Role.REDES, Role.HERMANO_MAYOR]), videoUploadMiddleware.single('file'), SubidaController.subirVideo);
subidaRoutes.post('/private',authenticateToken, checkRole(rolesDocumentosPrivados), privateUploadMiddleware.single('file'), SubidaController.subirArchivo);

export { subidaRoutes };
