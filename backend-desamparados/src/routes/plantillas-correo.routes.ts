import { Router } from 'express';
import { Role } from '@prisma/client';
import { PlantillasCorreoController as C } from '../controllers/plantillas-correo.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { plantillaIdSchema, plantillaSchema, usarPlantillaSchema, vistaPreviaSchema } from '../schemas/plantillas-correo.schema.js';

// Las plantillas de los correos (Emails): las llevan Secretaría, el Hermano Mayor y Administración.
const plantillasCorreoRoutes = Router();
plantillasCorreoRoutes.use(authenticateToken);

const rolesEmails = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR];

// Las libres se eligen al redactar en «Boletín y avisos»: también las ve quien escribe allí.
plantillasCorreoRoutes.get('/libres', checkRole([Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR, Role.REDES]), C.libres);

plantillasCorreoRoutes.use(checkRole(rolesEmails));
plantillasCorreoRoutes.get('/', C.listar);
plantillasCorreoRoutes.post('/', validate(plantillaSchema), C.crear);
plantillasCorreoRoutes.post('/vista-previa', validate(vistaPreviaSchema), C.vistaPrevia);
plantillasCorreoRoutes.post('/prueba', validate(vistaPreviaSchema), C.prueba);
plantillasCorreoRoutes.post('/usar', validate(usarPlantillaSchema), C.usar);
plantillasCorreoRoutes.get('/:id', validate(plantillaIdSchema), C.obtener);
plantillasCorreoRoutes.put('/:id', validate(plantillaIdSchema.and(plantillaSchema)), C.actualizar);
plantillasCorreoRoutes.delete('/:id', validate(plantillaIdSchema), C.borrar);

export { plantillasCorreoRoutes };
