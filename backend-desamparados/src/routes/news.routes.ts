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
const rolesCMS = [Role.ADMIN, Role.REDES];

// --- RUTAS PÚBLICAS ---
newsRoutes.get('/latest', NewsController.getLatest);   
// Nota: Query params se validan en el controller o con un schema extra
newsRoutes.get('/archive', NewsController.getArchive); 
// Blindamos que el slug no tenga inyecciones
newsRoutes.get('/:slug', validate(slugParamSchema), NewsController.getOne);       

// --- RUTAS PRIVADAS (Gestión CMS) ---
// Aplicamos seguridad en bloque para no repetir
newsRoutes.use(authenticateToken);
newsRoutes.use(checkRole(rolesCMS));

newsRoutes.get('/admin/archive', NewsController.getAdminArchive); // Incluye borradores
newsRoutes.post('/limit', validate(limitConfigSchema), NewsController.configHomeLimit); 
newsRoutes.post('/', validate(createNewsSchema), NewsController.create);
newsRoutes.put('/:id', validateId, validate(updateNewsSchema), NewsController.update); // Faltaba!
newsRoutes.delete('/:id', validateId, NewsController.delete); // Faltaba!

export { newsRoutes };