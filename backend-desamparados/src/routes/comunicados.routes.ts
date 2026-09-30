import { Router } from 'express';
import { type } from 'arktype';
import { Role } from '@prisma/client';
import { ComunicadosController } from '../controllers/comunicados.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import { limitadorContacto } from '../config/limiter.js';
import { bajaBoletinSchema, comunicadoSchema, destinatariosSchema } from '../schemas/comunicados.schema.js';

const comunicadosRoutes = Router();

// La baja del boletín va ANTES de `authenticateToken`, sin sesión: se pulsa
// desde el correo y no se puede pedir entrar para dejar de recibirlo. La
// protege la firma del enlace (domain/comunicados.ts) y el limitador del
// formulario de contacto, el otro público que escribe.
comunicadosRoutes.post('/baja-boletin', limitadorContacto, validate(bajaBoletinSchema), ComunicadosController.bajaBoletin);

comunicadosRoutes.use(authenticateToken);

// El boletín lo escriben quienes llevan la comunicación; los avisos a los
// hermanos (cuotas, cabildos), también Secretaría.
const rolesComunicacion = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR, Role.REDES];
const validateId = validate(type({ params: { id: idParam } }));

comunicadosRoutes.get('/', checkRole(rolesComunicacion), ComunicadosController.listar);
comunicadosRoutes.post('/destinatarios', checkRole(rolesComunicacion), validate(destinatariosSchema), ComunicadosController.destinatarios);
comunicadosRoutes.post('/', checkRole(rolesComunicacion), validate(comunicadoSchema), ComunicadosController.crear);
comunicadosRoutes.get('/:id', checkRole(rolesComunicacion), validateId, ComunicadosController.obtener);
comunicadosRoutes.put('/:id', checkRole(rolesComunicacion), validateId, validate(comunicadoSchema), ComunicadosController.actualizar);
comunicadosRoutes.delete('/:id', checkRole(rolesComunicacion), validateId, ComunicadosController.borrar);
comunicadosRoutes.post('/:id/prueba', checkRole(rolesComunicacion), validateId, ComunicadosController.prueba);
comunicadosRoutes.post('/:id/enviar', checkRole(rolesComunicacion), validateId, ComunicadosController.enviar);
comunicadosRoutes.post('/:id/reintentar', checkRole(rolesComunicacion), validateId, ComunicadosController.reintentar);

export { comunicadosRoutes };
