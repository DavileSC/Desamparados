import { Router } from 'express';
import { type } from 'arktype';
import { Role } from '@prisma/client';
import { SeccionesController } from '../controllers/secciones.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import { crearSeccionSchema } from '../schemas/secciones.schema.js';
import { sanearBloques } from '../utils/sanear-html.js';

/** Las secciones guardadas del constructor: los mismos roles que editan las páginas. */
const seccionesRoutes = Router();
seccionesRoutes.use(authenticateToken, checkRole([Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR]));

seccionesRoutes.get('/', SeccionesController.listar);
seccionesRoutes.post(
  '/',
  // Como en las páginas: el HTML se sanea y los vídeos se normalizan ANTES de validar.
  (req, _res, next) => {
    if (req.body && typeof req.body === 'object') req.body = { ...req.body, ...(sanearBloques({ bloques: req.body.bloques }) as object) };
    next();
  },
  validate(crearSeccionSchema),
  SeccionesController.crear,
);
seccionesRoutes.delete('/:id', validate(type({ params: { id: idParam } })), SeccionesController.borrar);

export { seccionesRoutes };
