import { Router } from 'express';
import { Role } from '@prisma/client';
import { WebAbiertaController } from '../controllers/web-abierta.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { cachePublica } from '../middleware/cache-publica.js';
import { validate } from '../config/validate.js';
import { estadoDeLaWebSchema } from '../schemas/web-abierta.schema.js';

/**
 * Si la web está abierta: público, igual para todos. Quién ve la web cerrada
 * lo decide la web con la sesión del CMS; el contenido sigue saliendo por sus
 * rutas, porque la vista previa y la Junta lo necesitan y nada de él es secreto.
 */
const webAbiertaRouter = Router();
webAbiertaRouter.get('/', cachePublica, WebAbiertaController.leer);

/** Sistema → Abrir la web: abrirla al público es cosa del Hermano Mayor (y Administración lo ve todo). */
const webAbiertaCmsRouter = Router();
webAbiertaCmsRouter.use(authenticateToken);
webAbiertaCmsRouter.use(checkRole([Role.ADMIN, Role.HERMANO_MAYOR]));
webAbiertaCmsRouter.put('/', validate(estadoDeLaWebSchema), WebAbiertaController.guardar);

export { webAbiertaRouter as webAbiertaRoutes, webAbiertaCmsRouter as webAbiertaCmsRoutes };
