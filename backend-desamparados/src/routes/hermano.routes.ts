import { Router } from 'express';
import { type } from 'arktype';
import { HermanoController } from '../controllers/hermano.controller';
import { authenticateToken } from '../middleware/session';
import { checkRole } from '../middleware/checkRole';
import { Role } from '@prisma/client';

import { validate } from '../config/validate';
import { idParam } from '../config/common'; 

import { 
    addProfileSchema, 
    updateProfileSchema, 
    updateAdminHermanoSchema,
    searchHermanoSchema,
    emancipateSchema
} from '../schemas/hermano.schema';

const rolesSecretaria = [Role.ADMIN, Role.SECRETARIA];
const rolesLecturaCenso = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR];
/** Quién admite hermanos nuevos: el Hermano Mayor también. Admitir un alta es
 *  censo, no administración del sistema, que es lo único que tiene vedado. */
const rolesAltasHermanos = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR];

const hermanoRouter = Router();

hermanoRouter.use(authenticateToken); 

const validateId = validate(type({ params: { id: idParam } }));

// ==========================================
// --- RUTAS ADMIN (SECRETARÍA) ---
// ==========================================

// 1. Buscador Total 
hermanoRouter.get('/admin/search', checkRole(rolesSecretaria), validate(searchHermanoSchema), HermanoController.search);

// 2. Leer todo el censo (Paginado) y reordenar Censo (Debe ir antes de cualquier /admin/:id)
hermanoRouter.get('/admin/all', checkRole(rolesLecturaCenso), HermanoController.getAll);
hermanoRouter.post('/admin/reordenar-censo', checkRole(rolesSecretaria), HermanoController.reordenarCenso);

// 3. Gestión de Solicitudes (Panel de Secretaría)
hermanoRouter.get('/admin/solicitudes', checkRole(rolesAltasHermanos), HermanoController.getSolicitudes);
hermanoRouter.post('/admin/solicitudes/:id/aprobar', checkRole(rolesAltasHermanos), validateId, HermanoController.aprobarSolicitud);
hermanoRouter.delete('/admin/solicitudes/:id/rechazar', checkRole(rolesAltasHermanos), validateId, HermanoController.rechazarSolicitud);

// 4. Operaciones sobre un Hermano Específico
hermanoRouter.get('/admin/:id', checkRole(rolesLecturaCenso), validateId, HermanoController.getById);
hermanoRouter.put('/admin/:id', checkRole(rolesSecretaria), validateId, validate(updateAdminHermanoSchema), HermanoController.updateAdmin);
hermanoRouter.delete('/admin/:id/baja', checkRole(rolesSecretaria), validateId, HermanoController.darDeBajaHermano);
hermanoRouter.post('/admin/:id/reactivar', checkRole(rolesSecretaria), validateId, HermanoController.reactivarHermano);

// ==========================================
// --- RUTAS FAMILIARES (Usuario normal) ---
// ==========================================

hermanoRouter.get('/mis-perfiles', HermanoController.getMyProfiles);
hermanoRouter.post('/mis-perfiles', validate(addProfileSchema), HermanoController.addProfile);
hermanoRouter.put('/mis-perfiles/:id', validateId, validate(updateProfileSchema), HermanoController.updateProfile);
hermanoRouter.delete('/mis-perfiles/:id', validateId, HermanoController.deleteProfile);
hermanoRouter.post('/mis-perfiles/:id/emancipar', validateId, validate(emancipateSchema), HermanoController.emancipate);

export { hermanoRouter as hermanoRoutes };
