import { Router } from 'express';
import { Role } from '@prisma/client';
import { PublicationController } from '../controllers/publication.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { categoryParamSchema, createPublicationSchema, publicationIdParamSchema, updatePublicationSchema } from '../schemas/publication.schema.js';

const publicationRoutes = Router();
const roles = [Role.ADMIN, Role.REDES];

publicationRoutes.get('/latest', PublicationController.latest);
publicationRoutes.get('/admin', authenticateToken, checkRole(roles), PublicationController.adminList);
publicationRoutes.get('/category/:category', validate(categoryParamSchema), PublicationController.list);
publicationRoutes.get('/', PublicationController.list);
publicationRoutes.use(authenticateToken, checkRole(roles));
publicationRoutes.post('/', validate(createPublicationSchema), PublicationController.create);
publicationRoutes.put('/:id', validate(publicationIdParamSchema), validate(updatePublicationSchema), PublicationController.update);
publicationRoutes.delete('/:id', validate(publicationIdParamSchema), PublicationController.delete);

export { publicationRoutes };
