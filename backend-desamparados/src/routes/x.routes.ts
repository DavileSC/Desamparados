import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { XController } from '../controllers/x.controller.js';
import { conectarXSchema, publicarNoticiaXSchema } from '../schemas/x.schema.js';

/**
 * La cuenta de X y publicar en ella las noticias. Los mismos roles que
 * Instagram: quien escribe la noticia decide si va a X, y conectar la cuenta
 * es cosa de Redes. Todo de staff: nada público aquí.
 */
const xRoutes = Router();
const rolesRedes = [Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR];

xRoutes.use(authenticateToken);
xRoutes.use(checkRole(rolesRedes));

xRoutes.get('/', XController.estado);
xRoutes.put('/', validate(conectarXSchema), XController.conectar);
xRoutes.delete('/', XController.desconectar);
xRoutes.post('/noticias/:id', validate(publicarNoticiaXSchema), XController.publicarNoticia);

export { xRoutes };
