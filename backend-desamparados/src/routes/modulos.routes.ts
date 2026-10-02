import { Router } from 'express';
import { Role } from '@prisma/client';
import { ModulosController } from '../controllers/modulos.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { cambiarModuloSchema } from '../schemas/modulos.schema.js';

/** La lista de activos: pública, porque la web la necesita antes de que nadie entre (barra, pie, rutas). */
const modulosRouter = Router();
modulosRouter.get('/', ModulosController.activos);

/** Sistema → Módulos: solo Administración. Encender un módulo es abrir pantallas y rutas a toda la junta. */
const modulosCmsRouter = Router();
modulosCmsRouter.use(authenticateToken);
modulosCmsRouter.use(checkRole([Role.ADMIN]));
modulosCmsRouter.get('/', ModulosController.listar);
modulosCmsRouter.put('/:clave', validate(cambiarModuloSchema), ModulosController.cambiar);

export { modulosRouter as modulosRoutes, modulosCmsRouter as modulosCmsRoutes };
