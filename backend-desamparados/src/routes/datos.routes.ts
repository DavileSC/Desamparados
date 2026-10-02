import { Router } from 'express';
import { Role } from '@prisma/client';
import { DatosController } from '../controllers/datos.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { conModulo } from '../middleware/modulos.js';
import { validate } from '../config/validate.js';
import { anioInformeSchema, areaInformeSchema, guardarInformeAnualSchema } from '../schemas/datos.schema.js';

const datosRoutes = Router();

// «Datos e informes» es de la junta de gobierno en sentido estricto: el Hermano
// Mayor y Administración. El Informe anual lo escribe también Secretaría (su
// epílogo): el servicio decide qué campos toca cada cargo.
const ROLES_DATOS = [Role.ADMIN, Role.HERMANO_MAYOR];
const ROLES_INFORME_ANUAL = [Role.ADMIN, Role.HERMANO_MAYOR, Role.SECRETARIA];

datosRoutes.use(authenticateToken);

datosRoutes.get('/', checkRole(ROLES_DATOS), DatosController.leer);
datosRoutes.get('/informe/:area', checkRole(ROLES_DATOS), validate(areaInformeSchema), DatosController.informe);

// El Informe anual es un módulo; Datos e informes, núcleo.
datosRoutes.use('/informe-anual', conModulo('informe-anual'));

datosRoutes.get('/informe-anual/:anio', checkRole(ROLES_INFORME_ANUAL), validate(anioInformeSchema), DatosController.leerInformeAnual);
datosRoutes.put('/informe-anual/:anio', checkRole(ROLES_INFORME_ANUAL), validate(guardarInformeAnualSchema), DatosController.guardarInformeAnual);
datosRoutes.get('/informe-anual/:anio/pdf', checkRole(ROLES_INFORME_ANUAL), validate(anioInformeSchema), DatosController.informeAnualPdf);

export { datosRoutes };
