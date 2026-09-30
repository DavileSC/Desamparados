import { Router } from 'express';
import { Role } from '@prisma/client';
import { CortejoDirectoController as C } from '../controllers/cortejo-directo.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { posicionSchema } from '../schemas/cortejo-directo.schema.js';

const cortejoDirectoRoutes = Router();

// Lo público, ANTES de la sesión: el mapa del recorrido pregunta sin cuenta.
cortejoDirectoRoutes.get('/', C.publico);

// Quien lleva el móvil en la calle: la Junta que va en el cortejo.
const admin = Router();
admin.use(authenticateToken);
admin.use(checkRole([Role.ADMIN, Role.SECRETARIA, Role.ALBACERIA, Role.HERMANO_MAYOR]));
admin.get('/', C.paraLaJunta);
admin.put('/', validate(posicionSchema), C.enviar);
admin.post('/terminar', C.terminar);
cortejoDirectoRoutes.use('/admin', admin);

export { cortejoDirectoRoutes };
