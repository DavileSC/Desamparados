import { Router } from 'express';
import { type } from 'arktype';
import { AgendaController } from '../controllers/agenda.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';

// --- CORRECCIÓN: Importamos también updateAgendaSchema ---
import { agendaSchema, updateAgendaSchema, queryAgendaSchema, queryAgendaAdminSchema, queryAgendaCalendarioSchema } from '../schemas/agenda.schema.js';

const agendaRoutes = Router();
const validateId = validate(type({ params: { id: idParam } }));

// Roles autorizados para tocar el calendario
const rolesAgenda = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR];

// LECTURA pública: todos los actos son públicos, no hace falta sesión.
agendaRoutes.get('/', validate(queryAgendaSchema), AgendaController.list);

// El listado del CMS, con los eventos pasados. El orden es de corrección, no
// de estilo: tiene que ir ANTES de '/:id', que se traga cualquier segmento
// suelto y rechazaría «admin» por no ser un id. Lleva su sesión y su rol en
// línea porque este router no tiene un use() de autenticación.
agendaRoutes.get('/admin', authenticateToken, checkRole(rolesAgenda), validate(queryAgendaAdminSchema), AgendaController.adminList);

agendaRoutes.get('/admin/calendario', authenticateToken, checkRole(rolesAgenda), validate(queryAgendaCalendarioSchema), AgendaController.adminCalendario);

// El calendario para suscribirse y el de cada acto, sin sesión: son públicos
// como la agenda. El primero, antes de '/:id', que se tragaría el segmento.
agendaRoutes.get('/calendario.ics', AgendaController.suscripcion);
agendaRoutes.get('/:id/ics', validateId, AgendaController.ics);

agendaRoutes.get('/:id', validateId, AgendaController.getOne);

// GESTIÓN (Estricta - Solo Junta)
agendaRoutes.post('/', authenticateToken, checkRole(rolesAgenda), validate(agendaSchema), AgendaController.create);

// --- CORRECCIÓN: Usamos updateAgendaSchema ---
agendaRoutes.put('/:id', authenticateToken, checkRole(rolesAgenda), validateId, validate(updateAgendaSchema), AgendaController.update);

agendaRoutes.delete('/:id', authenticateToken, checkRole(rolesAgenda), validateId, AgendaController.delete);

export { agendaRoutes };