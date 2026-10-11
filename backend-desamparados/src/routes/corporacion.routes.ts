import { Router } from 'express';
import { Role } from '@prisma/client';
import { CorporacionController } from '../controllers/corporacion.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { cachePublica } from '../middleware/cache-publica.js';
import { validate } from '../config/validate.js';
import { corporacionSchema } from '../schemas/corporacion.schema.js';

/** Secretaría, sede, redes y privacidad: públicos, los pinta la web para cualquiera. */
const corporacionRouter = Router();
corporacionRouter.get('/', cachePublica, CorporacionController.leer);

/** Sistema → Datos de la corporación: Secretaría los lleva, y Administración lo ve todo. */
const corporacionCmsRouter = Router();
corporacionCmsRouter.use(authenticateToken);
corporacionCmsRouter.use(checkRole([Role.ADMIN, Role.SECRETARIA]));
corporacionCmsRouter.get('/', CorporacionController.leer);
corporacionCmsRouter.put('/', validate(corporacionSchema), CorporacionController.guardar);

export { corporacionRouter as corporacionRoutes, corporacionCmsRouter as corporacionCmsRoutes };
