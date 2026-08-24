import { Router } from 'express';
import { type } from 'arktype';
import { AgendaController } from '../controllers/agenda.controller.js';
import { optionalAuthentication } from '../middleware/optionalAuth.js'; 
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';

// --- CORRECCIÓN: Importamos también updateAgendaSchema ---
import { agendaSchema, updateAgendaSchema, queryAgendaSchema } from '../schemas/agenda.schema.js';

const agendaRoutes = Router();
const validateId = validate(type({ params: { id: idParam } }));

// Roles autorizados para tocar el calendario
const rolesAgenda = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR];

// LECTURA (Híbrida - Opcionalmente autenticada)
agendaRoutes.get('/', optionalAuthentication, validate(queryAgendaSchema), AgendaController.list);
agendaRoutes.get('/:id', optionalAuthentication, validateId, AgendaController.getOne);

// GESTIÓN (Estricta - Solo Junta)
agendaRoutes.post('/', authenticateToken, checkRole(rolesAgenda), validate(agendaSchema), AgendaController.create);

// --- CORRECCIÓN: Usamos updateAgendaSchema ---
agendaRoutes.put('/:id', authenticateToken, checkRole(rolesAgenda), validateId, validate(updateAgendaSchema), AgendaController.update);

agendaRoutes.delete('/:id', authenticateToken, checkRole(rolesAgenda), validateId, AgendaController.delete);

export { agendaRoutes };