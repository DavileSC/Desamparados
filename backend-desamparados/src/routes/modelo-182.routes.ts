import { Router } from 'express';
import { Role } from '@prisma/client';
import { Modelo182Controller } from '../controllers/modelo-182.controller.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { certificadosQuerySchema, configuracionModelo182Schema, ejercicioQuerySchema, ficheroModelo182Schema } from '../schemas/modelo-182.schema.js';

/**
 * El Modelo 182 (módulo `modelo-182`): los donativos del año para Hacienda y
 * los certificados. Montado dentro de recibo.routes.ts en `/admin/modelo-182`
 * con su guarda; los certificados propios del hermano (`/mis-recibos/
 * certificados`) se quedan allí con la misma guarda en línea.
 */
const modelo182Router = Router();
const rolesTesoreria = [Role.ADMIN, Role.TESORERIA, Role.HERMANO_MAYOR];

modelo182Router.get('/', checkRole(rolesTesoreria), validate(ejercicioQuerySchema), Modelo182Controller.resumen);
modelo182Router.put('/configuracion', checkRole([Role.ADMIN, Role.TESORERIA]), validate(configuracionModelo182Schema), Modelo182Controller.guardarConfiguracion);
modelo182Router.get('/fichero', checkRole(rolesTesoreria), validate(ficheroModelo182Schema), Modelo182Controller.fichero);
modelo182Router.get('/certificados', checkRole(rolesTesoreria), validate(certificadosQuerySchema), Modelo182Controller.certificados);
modelo182Router.post('/enviar', checkRole([Role.ADMIN, Role.TESORERIA]), validate(ejercicioQuerySchema), Modelo182Controller.enviar);

export { modelo182Router as modelo182Routes };
