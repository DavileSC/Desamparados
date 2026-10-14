import { Router } from 'express';
import { type } from 'arktype';
import { Role } from '@prisma/client';
import { ComunicadosController } from '../controllers/comunicados.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import { comunicadoSchema, destinatariosSchema } from '../schemas/comunicados.schema.js';

const comunicadosRoutes = Router();

// La baja del boletín no está aquí: va en `boletin.routes.ts`, del núcleo,
// para que el enlace del correo siga valiendo con el módulo apagado.

comunicadosRoutes.use(authenticateToken);

// El boletín lo escriben quienes llevan la comunicación; los avisos a los
// hermanos (cuotas, cabildos), también Secretaría.
const rolesComunicacion = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR, Role.REDES];
const validateId = validate(type({ params: { id: idParam } }));

comunicadosRoutes.get('/', checkRole(rolesComunicacion), ComunicadosController.listar);
// Los envíos a muchos (comunicados y aperturas de papeletas) y el tope del día. Antes que '/:id'.
comunicadosRoutes.get('/envios', checkRole(rolesComunicacion), ComunicadosController.envios);
comunicadosRoutes.post('/destinatarios', checkRole(rolesComunicacion), validate(destinatariosSchema), ComunicadosController.destinatarios);
comunicadosRoutes.post('/', checkRole(rolesComunicacion), validate(comunicadoSchema), ComunicadosController.crear);
comunicadosRoutes.get('/:id', checkRole(rolesComunicacion), validateId, ComunicadosController.obtener);
comunicadosRoutes.put('/:id', checkRole(rolesComunicacion), validateId, validate(comunicadoSchema), ComunicadosController.actualizar);
comunicadosRoutes.delete('/:id', checkRole(rolesComunicacion), validateId, ComunicadosController.borrar);
comunicadosRoutes.post('/:id/prueba', checkRole(rolesComunicacion), validateId, ComunicadosController.prueba);
comunicadosRoutes.post('/:id/enviar', checkRole(rolesComunicacion), validateId, ComunicadosController.enviar);
comunicadosRoutes.post('/:id/reintentar', checkRole(rolesComunicacion), validateId, ComunicadosController.reintentar);

export { comunicadosRoutes };
