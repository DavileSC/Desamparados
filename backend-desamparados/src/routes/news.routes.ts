import { Router } from 'express';
import { type } from 'arktype';
import { NewsController } from '../controllers/news.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js'; // Usamos el global
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import { createNewsSchema, updateNewsSchema, limitConfigSchema, slugParamSchema } from '../schemas/news.schema.js';

const newsRoutes = Router();

const validateId = validate(type({ params: { id: idParam } }));
// Gestión de contenido, no administración del sistema: el Hermano Mayor ve y
// edita todo salvo promover/degradar cargos y la configuración global (esas
// dos siguen siendo solo de ADMIN, en admin.routes.ts).
const rolesCMS = [Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR];

// --- RUTAS PÚBLICAS ---
newsRoutes.get('/latest', NewsController.getLatest);   
// Nota: Query params se validan en el controller o con un schema extra
newsRoutes.get('/archive', NewsController.getArchive); 

// Esta ruta debe declararse antes de /:slug para que "admin" no se interprete
// como un slug, lo que la deja fuera del bloque .use() de más abajo: por eso
// lleva su propia autenticación en línea. Sin ella expone los borradores
// (visible: false) a cualquiera. Cubierto por test/integration.test.ts.
newsRoutes.get(
  '/admin/archive',
  authenticateToken,
  checkRole(rolesCMS),
  NewsController.getAdminArchive
);

// Blindamos que el slug no tenga inyecciones
newsRoutes.get('/:slug', validate(slugParamSchema), NewsController.getOne);       

// --- RUTAS PRIVADAS (Gestión CMS) ---
// Aplicamos seguridad en bloque para no repetir
newsRoutes.use(authenticateToken);
newsRoutes.use(checkRole(rolesCMS));

newsRoutes.post('/limit', validate(limitConfigSchema), NewsController.configHomeLimit); 
newsRoutes.post('/', validate(createNewsSchema), NewsController.create);
newsRoutes.put('/:id', validateId, validate(updateNewsSchema), NewsController.update); // Faltaba!
newsRoutes.delete('/:id', validateId, NewsController.delete); // Faltaba!

export { newsRoutes };
