import { Router } from 'express';
import { type } from 'arktype';
import { HermanoController } from '../controllers/hermano.controller';
import { CensoHojaController } from '../controllers/censo-hoja.controller';
import { ficheroDeDatosMiddleware } from '../middleware/upload.middleware';
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
    emancipateSchema,
    emancipateByStaffSchema,
    bajaHermanoSchema,
    exportarCensoSchema,
    guardarListaSchema,
    difuntosQuerySchema,
    fijarDefuncionSchema,
    nuevoSufragioSchema,
    pesameSchema
} from '../schemas/hermano.schema';

/**
 * Quién gestiona el censo. El Hermano Mayor entra en todo lo de esta sección
 * igual que secretaría: leer, buscar, editar la ficha, admitir altas, dar de
 * baja, reactivar y emancipar. Lo único que tiene vedado es la administración
 * del sistema, que vive en admin.routes.ts.
 *
 * Redes y los hermanos rasos se quedan fuera de todo esto, con test negativo
 * en test/permisos-hermano-mayor.test.ts.
 */
const rolesGestionCenso = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR];

const hermanoRouter = Router();

hermanoRouter.use(authenticateToken); 

const validateId = validate(type({ params: { id: idParam } }));

// ==========================================
// --- RUTAS ADMIN (GESTIÓN DEL CENSO) ---
// ==========================================

// 1. Buscador Total 
hermanoRouter.get('/admin/search', checkRole(rolesGestionCenso), validate(searchHermanoSchema), HermanoController.search);

// 2. Leer todo el censo (Paginado) y reordenar Censo (Debe ir antes de cualquier /admin/:id)
hermanoRouter.get('/admin/all', checkRole(rolesGestionCenso), HermanoController.getAll);
hermanoRouter.post('/admin/reordenar-censo', checkRole(rolesGestionCenso), HermanoController.reordenarCenso);
hermanoRouter.post('/admin/cerrar-huecos-numero', checkRole(rolesGestionCenso), HermanoController.cerrarHuecosNumero);

// El censo en Excel o CSV: sacarlo y traer el de otra parte. Antes de /admin/:id.
hermanoRouter.get('/admin/censo/exportar', checkRole(rolesGestionCenso), validate(exportarCensoSchema), CensoHojaController.exportar);
hermanoRouter.post('/admin/censo/importar/previa', checkRole(rolesGestionCenso), ficheroDeDatosMiddleware.single('fichero'), CensoHojaController.previa);
hermanoRouter.post('/admin/censo/importar', checkRole(rolesGestionCenso), ficheroDeDatosMiddleware.single('fichero'), CensoHojaController.importar);

// 3. Gestión de Solicitudes
hermanoRouter.get('/admin/solicitudes', checkRole(rolesGestionCenso), HermanoController.getSolicitudes);
hermanoRouter.post('/admin/solicitudes/:id/aprobar', checkRole(rolesGestionCenso), validateId, HermanoController.aprobarSolicitud);
hermanoRouter.delete('/admin/solicitudes/:id/rechazar', checkRole(rolesGestionCenso), validateId, HermanoController.rechazarSolicitud);
// Las peticiones de volver salen en la misma pantalla que las solicitudes, pero
// se atienden con «reactivar» (más abajo) o descartándolas: nunca con aprobar,
// que es para quien nunca estuvo en el censo.
hermanoRouter.delete('/admin/reactivaciones/:id', checkRole(rolesGestionCenso), validateId, HermanoController.descartarReactivacion);

// 4. Operaciones sobre un Hermano Específico
// Las búsquedas guardadas del censo. Antes de `/admin/:id`: si no, «listas» se
// leería como un id y validateId respondería 400.
hermanoRouter.get('/admin/listas', checkRole(rolesGestionCenso), HermanoController.listas);
hermanoRouter.post('/admin/listas', checkRole(rolesGestionCenso), validate(guardarListaSchema), HermanoController.guardarLista);
hermanoRouter.delete('/admin/listas/:id', checkRole(rolesGestionCenso), validateId, HermanoController.borrarLista);

// Los difuntos y sus sufragios. También antes de `/admin/:id`.
hermanoRouter.get('/admin/difuntos', checkRole(rolesGestionCenso), validate(difuntosQuerySchema), HermanoController.difuntos);
hermanoRouter.get('/admin/difuntos/aniversarios', checkRole(rolesGestionCenso), HermanoController.aniversarios);
hermanoRouter.get('/admin/difuntos/:id', checkRole(rolesGestionCenso), validateId, HermanoController.difunto);
hermanoRouter.put('/admin/difuntos/:id/defuncion', checkRole(rolesGestionCenso), validateId, validate(fijarDefuncionSchema), HermanoController.fijarDefuncion);
hermanoRouter.post('/admin/difuntos/:id/sufragios', checkRole(rolesGestionCenso), validateId, validate(nuevoSufragioSchema), HermanoController.crearSufragio);
hermanoRouter.post('/admin/difuntos/:id/pesame', checkRole(rolesGestionCenso), validateId, validate(pesameSchema), HermanoController.enviarPesame);
hermanoRouter.delete('/admin/sufragios/:id', checkRole(rolesGestionCenso), validateId, HermanoController.borrarSufragio);

hermanoRouter.get('/admin/:id', checkRole(rolesGestionCenso), validateId, HermanoController.getById);
hermanoRouter.put('/admin/:id', checkRole(rolesGestionCenso), validateId, validate(updateAdminHermanoSchema), HermanoController.updateAdmin);
// La baja admite un cuerpo opcional con la fecha ({ fechaBaja: 'AAAA-MM-DD' }).
hermanoRouter.delete('/admin/:id/baja', checkRole(rolesGestionCenso), validateId, validate(bajaHermanoSchema), HermanoController.darDeBajaHermano);
hermanoRouter.post('/admin/:id/reactivar', checkRole(rolesGestionCenso), validateId, HermanoController.reactivarHermano);
hermanoRouter.post('/admin/:id/emancipar', checkRole(rolesGestionCenso), validateId, validate(emancipateByStaffSchema), HermanoController.emancipateByStaff);

// ==========================================
// --- RUTAS FAMILIARES (Usuario normal) ---
// ==========================================

hermanoRouter.get('/mis-perfiles', HermanoController.getMyProfiles);
hermanoRouter.post('/mis-perfiles', validate(addProfileSchema), HermanoController.addProfile);
hermanoRouter.put('/mis-perfiles/:id', validateId, validate(updateProfileSchema), HermanoController.updateProfile);
hermanoRouter.delete('/mis-perfiles/:id', validateId, HermanoController.deleteProfile);
hermanoRouter.post('/mis-perfiles/:id/emancipar', validateId, validate(emancipateSchema), HermanoController.emancipate);

export { hermanoRouter as hermanoRoutes };
