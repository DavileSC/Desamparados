import { Router } from 'express';
import { Role } from '@prisma/client';
import { Modelo182Controller } from '../controllers/modelo-182.controller.js';
import { checkRole } from '../middleware/checkRole.js';
import { ROLES_TESORERIA } from './roles.js';
import { validate } from '../config/validate.js';
import { certificadosQuerySchema, configuracionModelo182Schema, ejercicioQuerySchema, ficheroModelo182Schema } from '../schemas/modelo-182.schema.js';

/**
 * El Modelo 182 (módulo `modelo-182`): los donativos del año para Hacienda y
 * los certificados. Montado dentro de recibo.routes.ts en `/admin/modelo-182`
 * con su guarda; los certificados propios del hermano (`/mis-recibos/
 * certificados`) se quedan allí con la misma guarda en línea.
 */
const modelo182Router = Router();

modelo182Router.get('/', checkRole(ROLES_TESORERIA), validate(ejercicioQuerySchema), Modelo182Controller.resumen);
modelo182Router.put('/configuracion', checkRole([Role.ADMIN, Role.TESORERIA]), validate(configuracionModelo182Schema), Modelo182Controller.guardarConfiguracion);
modelo182Router.get('/fichero', checkRole(ROLES_TESORERIA), validate(ficheroModelo182Schema), Modelo182Controller.fichero);
modelo182Router.get('/certificados', checkRole(ROLES_TESORERIA), validate(certificadosQuerySchema), Modelo182Controller.certificados);
modelo182Router.post('/enviar', checkRole([Role.ADMIN, Role.TESORERIA]), validate(ejercicioQuerySchema), Modelo182Controller.enviar);
// Los que fallaron al salir: la pantalla de envíos de la cola es de Secretaría, no de Tesorería.
modelo182Router.post('/enviar/reintentar', checkRole([Role.ADMIN, Role.TESORERIA]), validate(ejercicioQuerySchema), Modelo182Controller.reintentar);

export { modelo182Router as modelo182Routes };
