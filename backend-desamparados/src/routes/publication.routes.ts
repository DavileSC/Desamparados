import { Router } from 'express';
import { Role } from '@prisma/client';
import { PublicationController } from '../controllers/publication.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { categoryParamSchema, createPublicationSchema, publicationIdParamSchema, publicationListQuerySchema, updatePublicationSchema } from '../schemas/publication.schema.js';

const publicationRoutes = Router();
// Gestión de contenido, no administración del sistema: el Hermano Mayor ve y
// edita todo salvo promover/degradar cargos y la configuración global (esas
// dos siguen siendo solo de ADMIN, en admin.routes.ts).
const roles = [Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR];

publicationRoutes.get('/latest', PublicationController.latest);
publicationRoutes.get('/admin', authenticateToken, checkRole(roles), validate(publicationListQuerySchema), PublicationController.adminList);
publicationRoutes.get('/category/:category', validate(categoryParamSchema), PublicationController.list);
publicationRoutes.get('/', validate(publicationListQuerySchema), PublicationController.list);

// El orden es de corrección, no de estilo: '/:id' captura cualquier segmento
// suelto, así que va DESPUÉS de '/latest' y '/admin' o esas dos dejarían de
// funcionar ("latest" se leería como un id). Y como muestra los borradores,
// lleva su propia sesión y rol en línea: queda por encima del use() de abajo.
publicationRoutes.get('/:id', authenticateToken, checkRole(roles), validate(publicationIdParamSchema), PublicationController.getOne);

publicationRoutes.use(authenticateToken, checkRole(roles));
publicationRoutes.post('/', validate(createPublicationSchema), PublicationController.create);
publicationRoutes.put('/:id', validate(publicationIdParamSchema), validate(updatePublicationSchema), PublicationController.update);
publicationRoutes.delete('/:id', validate(publicationIdParamSchema), PublicationController.delete);

export { publicationRoutes };
