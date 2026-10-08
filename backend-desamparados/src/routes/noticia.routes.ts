import { Router } from 'express';
import { type } from 'arktype';
import { NoticiaController } from '../controllers/noticia.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js'; // Usamos el global
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { cachePublica } from '../middleware/cache-publica.js';
import { idParam } from '../config/common.js';
import { crearNoticiaSchema, actualizarNoticiaSchema, slugParamSchema, archivoCmsQuerySchema } from '../schemas/noticia.schema.js';

const noticiaRoutes = Router();

const validateId = validate(type({ params: { id: idParam } }));
// Gestión de contenido, no administración del sistema: el Hermano Mayor ve y
// edita todo salvo promover/degradar cargos y la configuración global (esas
// dos siguen siendo solo de ADMIN, en admin.routes.ts).
const rolesCMS = [Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR];

// --- RUTAS PÚBLICAS ---
noticiaRoutes.get('/latest', cachePublica, NoticiaController.getLatest);
// Nota: Query params se validan en el controller o con un schema extra
noticiaRoutes.get('/archive', cachePublica, NoticiaController.getArchive);

// Esta ruta debe declararse antes de /:slug para que "admin" no se interprete
// como un slug, lo que la deja fuera del bloque .use() de más abajo: por eso
// lleva su propia autenticación en línea. Sin ella expone los borradores
// (visible: false) a cualquiera. Cubierto por test/integration.test.ts.
noticiaRoutes.get(
  '/admin/archive',
  authenticateToken,
  checkRole(rolesCMS),
  validate(archivoCmsQuerySchema),
  NoticiaController.getAdminArchive
);

// Misma razón que /admin/archive: debe ir antes de /:slug y lleva su propia
// autenticación en línea, o "admin" se leería como slug y expondría los
// borradores a cualquiera.
noticiaRoutes.get(
  '/admin/:id',
  authenticateToken,
  checkRole(rolesCMS),
  validateId,
  NoticiaController.getAdminOne
);

// Blindamos que el slug no tenga inyecciones
noticiaRoutes.get('/:slug', cachePublica, validate(slugParamSchema), NoticiaController.getOne);

// --- RUTAS PRIVADAS (Gestión CMS) ---
// Aplicamos seguridad en bloque para no repetir
noticiaRoutes.use(authenticateToken);
noticiaRoutes.use(checkRole(rolesCMS));

noticiaRoutes.post('/', validate(crearNoticiaSchema), NoticiaController.create);
noticiaRoutes.put('/:id', validateId, validate(actualizarNoticiaSchema), NoticiaController.update); // Faltaba!
noticiaRoutes.delete('/:id', validateId, NoticiaController.delete); // Faltaba!

export { noticiaRoutes };
