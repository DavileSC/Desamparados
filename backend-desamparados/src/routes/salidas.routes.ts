import { Router } from 'express';
import { Role } from '@prisma/client';
import { SalidasController } from '../controllers/salidas.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { crearSalidaSchema, editarSalidaSchema, fechaDeSalidaSchema } from '../schemas/salidas.schema.js';

/** Las activas, para la web pública y el área de hermanos: basta con sesión, de cualquiera de las dos áreas. */
const salidasRouter = Router();
// La próxima salida, para la cuenta atrás de la portada: pública, porque la
// portada la ve cualquiera. Va antes de exigir sesión y solo dice el nombre,
// el día y la hora: las cuotas, los puestos y el cortejo siguen tras la sesión.
salidasRouter.get('/proxima', SalidasController.proxima);
salidasRouter.use(authenticateToken);
salidasRouter.get('/', SalidasController.listarWeb);

/**
 * El CMS: todas (también las inactivas), las da de alta y las edita
 * Secretaría; la Junta y el Hermano Mayor solo las leen, como el resto de
 * `/procesion/admin`.
 */
const rolesLectura = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR];
const rolesEscritura = [Role.ADMIN, Role.SECRETARIA];

const salidasCmsRouter = Router();
salidasCmsRouter.use(authenticateToken);
salidasCmsRouter.get('/', checkRole(rolesLectura), SalidasController.listarCms);
salidasCmsRouter.post('/', checkRole(rolesEscritura), validate(crearSalidaSchema), SalidasController.crear);
salidasCmsRouter.put('/:id', checkRole(rolesEscritura), validate(editarSalidaSchema), SalidasController.editar);
salidasCmsRouter.put('/:id/fecha', checkRole(rolesEscritura), validate(fechaDeSalidaSchema), SalidasController.fijarFecha);

export { salidasRouter as salidasRoutes, salidasCmsRouter as salidasCmsRoutes };
