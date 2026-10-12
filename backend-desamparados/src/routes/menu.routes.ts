import { Router } from 'express';
import { Role } from '@prisma/client';
import { MenuController } from '../controllers/menu.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { cachePublica } from '../middleware/cache-publica.js';
import { validate } from '../config/validate.js';
import { guardarNombresEnMenuSchema } from '../schemas/menu.schema.js';

/** Los nombres del menú público: la web los pide sin sesión, como el contenido. */
const menuRouter = Router();
menuRouter.get('/', cachePublica, MenuController.leer);

/**
 * CMS → Páginas: quien edita las páginas les cambia también el nombre en el
 * menú (los mismos roles que `rolesCMS` de contenido.routes.ts; Administración
 * lo ve todo).
 */
const menuCmsRouter = Router();
menuCmsRouter.use(authenticateToken);
menuCmsRouter.use(checkRole([Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR]));
menuCmsRouter.put('/', validate(guardarNombresEnMenuSchema), MenuController.guardar);

export { menuRouter as menuRoutes, menuCmsRouter as menuCmsRoutes };
