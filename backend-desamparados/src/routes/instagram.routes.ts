import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { InstagramController } from '../controllers/instagram.controller.js';
import { conectarInstagramSchema, publicarNoticiaInstagramSchema } from '../schemas/instagram.schema.js';

/**
 * La cuenta de Instagram y publicar en ella las noticias. Los mismos roles que
 * las noticias: quien escribe la noticia es quien decide si va a Instagram, y
 * conectar la cuenta es cosa de Redes. Todo de staff: nada público aquí.
 */
const instagramRoutes = Router();
const rolesRedes = [Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR];

instagramRoutes.use(authenticateToken);
instagramRoutes.use(checkRole(rolesRedes));

instagramRoutes.get('/', InstagramController.estado);
instagramRoutes.put('/', validate(conectarInstagramSchema), InstagramController.conectar);
instagramRoutes.delete('/', InstagramController.desconectar);
instagramRoutes.post('/noticias/:id', validate(publicarNoticiaInstagramSchema), InstagramController.publicarNoticia);

export { instagramRoutes };
