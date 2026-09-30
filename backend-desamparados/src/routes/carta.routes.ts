import { Router } from 'express';
import { Role } from '@prisma/client';
import { type } from 'arktype';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import { cartaSchema, pdfCartaSchema, recuentoCartaSchema } from '../schemas/carta.schema.js';
import { CartaController } from '../controllers/carta.controller.js';

const cartaRoutes = Router();

// Las cartas son cosa de quien gestiona el censo: llevan sus datos.
cartaRoutes.use(authenticateToken, checkRole([Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR]));

const validateId = validate(type({ params: { id: idParam } }));

cartaRoutes.get('/', CartaController.listar);
cartaRoutes.post('/', validate(cartaSchema), CartaController.crear);
cartaRoutes.get('/destinatarios', validate(recuentoCartaSchema), CartaController.recuento);
cartaRoutes.post('/pdf', validate(pdfCartaSchema), CartaController.pdf);
cartaRoutes.put('/:id', validateId, validate(cartaSchema), CartaController.actualizar);
cartaRoutes.delete('/:id', validateId, CartaController.borrar);

export { cartaRoutes };
