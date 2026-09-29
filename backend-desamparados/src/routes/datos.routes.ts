import { Router } from 'express';
import { Role } from '@prisma/client';
import { DatosController } from '../controllers/datos.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { areaInformeSchema, cursoMemoriaSchema, guardarMemoriaSchema } from '../schemas/datos.schema.js';

const datosRoutes = Router();

// «Datos e informes» es de la junta de gobierno en sentido estricto: el Hermano
// Mayor y Administración. La Memoria la escribe también Secretaría (su
// epílogo): el servicio decide qué campos toca cada cargo.
const ROLES_DATOS = [Role.ADMIN, Role.HERMANO_MAYOR];
const ROLES_MEMORIA = [Role.ADMIN, Role.HERMANO_MAYOR, Role.SECRETARIA];

datosRoutes.use(authenticateToken);

datosRoutes.get('/', checkRole(ROLES_DATOS), DatosController.leer);
datosRoutes.get('/informe/:area', checkRole(ROLES_DATOS), validate(areaInformeSchema), DatosController.informe);

datosRoutes.get('/memoria/:curso', checkRole(ROLES_MEMORIA), validate(cursoMemoriaSchema), DatosController.leerMemoria);
datosRoutes.put('/memoria/:curso', checkRole(ROLES_MEMORIA), validate(guardarMemoriaSchema), DatosController.guardarMemoria);
datosRoutes.get('/memoria/:curso/pdf', checkRole(ROLES_MEMORIA), validate(cursoMemoriaSchema), DatosController.memoriaPdf);

export { datosRoutes };
