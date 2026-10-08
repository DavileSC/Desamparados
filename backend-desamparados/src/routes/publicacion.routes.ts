import { Router } from 'express';
import { Role } from '@prisma/client';
import { PublicacionController } from '../controllers/publicacion.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { cachePublica } from '../middleware/cache-publica.js';
import { publicacionesCmsQuerySchema, categoryParamSchema, crearPublicacionSchema, publicacionIdParamSchema, publicacionesQuerySchema, actualizarPublicacionSchema } from '../schemas/publicacion.schema.js';

const publicacionRoutes = Router();
// Gestión de contenido, no administración del sistema: el Hermano Mayor ve y
// edita todo salvo promover/degradar cargos y la configuración global (esas
// dos siguen siendo solo de ADMIN, en admin.routes.ts).
const roles = [Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR];

publicacionRoutes.get('/latest', cachePublica, PublicacionController.latest);
publicacionRoutes.get('/admin', authenticateToken, checkRole(roles), validate(publicacionesCmsQuerySchema), PublicacionController.adminList);
publicacionRoutes.get('/category/:category', cachePublica, validate(categoryParamSchema), PublicacionController.list);
publicacionRoutes.get('/', cachePublica, validate(publicacionesQuerySchema), PublicacionController.list);

// El orden es de corrección, no de estilo: '/:id' captura cualquier segmento
// suelto, así que va DESPUÉS de '/latest' y '/admin' o esas dos dejarían de
// funcionar ("latest" se leería como un id). Y como muestra los borradores,
// lleva su propia sesión y rol en línea: queda por encima del use() de abajo.
publicacionRoutes.get('/:id', authenticateToken, checkRole(roles), validate(publicacionIdParamSchema), PublicacionController.getOne);

publicacionRoutes.use(authenticateToken, checkRole(roles));
publicacionRoutes.post('/', validate(crearPublicacionSchema), PublicacionController.create);
publicacionRoutes.put('/:id', validate(publicacionIdParamSchema), validate(actualizarPublicacionSchema), PublicacionController.update);
publicacionRoutes.delete('/:id', validate(publicacionIdParamSchema), PublicacionController.delete);

export { publicacionRoutes };
