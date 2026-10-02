import { Router } from 'express';
import { Role } from '@prisma/client';
import { type } from 'arktype';
import { RemesaController } from '../controllers/remesa.controller.js';
import { Norma43Controller } from '../controllers/norma43.controller.js';
import { ficheroDeDatosMiddleware } from '../middleware/upload.middleware.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import { remesaSchema } from '../schemas/recibo.schema.js';

/**
 * Remesas SEPA y Norma 43: el módulo `remesas`. Se monta DENTRO de
 * recibo.routes.ts en `/admin/remesas`, detrás de su guarda, para que las
 * direcciones de siempre sigan valiendo y, apagado, respondan 404 sin que el
 * resto de los recibos (que es núcleo) se entere.
 */
const remesasRouter = Router();
const validateId = validate(type({ params: { id: idParam } }));
const rolesTesoreria = [Role.ADMIN, Role.TESORERIA, Role.HERMANO_MAYOR];

remesasRouter.get('/', checkRole(rolesTesoreria), RemesaController.estado);
remesasRouter.post('/previa', checkRole(rolesTesoreria), validate(remesaSchema), RemesaController.previa);
remesasRouter.post('/', checkRole(rolesTesoreria), validate(remesaSchema), RemesaController.generar);
// El extracto del banco en Norma 43: casa devoluciones y cobros de las remesas.
// El fichero va a memoria y no se guarda: se lee y se descarta.
remesasRouter.post('/norma43/previa', checkRole(rolesTesoreria), ficheroDeDatosMiddleware.single('fichero'), Norma43Controller.previa);
remesasRouter.post('/norma43/aplicar', checkRole(rolesTesoreria), ficheroDeDatosMiddleware.single('fichero'), Norma43Controller.aplicar);
remesasRouter.get('/:id/fichero', checkRole(rolesTesoreria), validateId, RemesaController.fichero);
remesasRouter.post('/:id/cobrar', checkRole(rolesTesoreria), validateId, RemesaController.darPorCobrada);

export { remesasRouter as remesasRoutes };
