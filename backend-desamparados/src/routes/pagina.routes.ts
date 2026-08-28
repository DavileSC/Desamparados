import { Router } from 'express';
import { PaginaController } from '../controllers/pagina.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { savePaginaSchema, slugParamSchema } from '../schemas/pagina.schema.js';
import { type } from 'arktype'; 

// Esquema rápido para actualizar (todo opcional)
const updatePaginaSchema = type({
    body: {
        "titulo?": "string",
        "contenido?": "string"
    }
});

const paginaRoutes = Router();
const rolesCMS = [Role.ADMIN, Role.REDES, Role.SECRETARIA]; 

// ==========================================
//  LISTADO DEL CMS
// ==========================================
// El orden importa dos veces: tiene que ir ANTES de '/:slug', o "list-all" se
// interpreta como un slug y la ruta devuelve 404; y como eso la deja fuera del
// bloque .use() de más abajo, lleva su propia autenticación en línea, igual que
// /admin/archive en news.routes.
//
// Estaba abierta al público: no filtraba nada sensible —Pagina no tiene estado
// de publicación y solo devuelve slug, título y fecha— pero era superficie
// accesible sin sesión que ningún cliente usaba.
paginaRoutes.get(
  '/list-all',
  authenticateToken,
  checkRole(rolesCMS),
  PaginaController.listAll
);

// ==========================================
//  PÚBLICAS
// ==========================================
paginaRoutes.get('/:slug', validate(slugParamSchema), PaginaController.getPage);

// ==========================================
//  ADMIN (Gestión CMS)
// ==========================================

// Aplicamos seguridad a todo este bloque de golpe
paginaRoutes.use(authenticateToken);
paginaRoutes.use(checkRole(rolesCMS));

// CREAR
paginaRoutes.post('/', validate(savePaginaSchema), PaginaController.createPage);

// ACTUALIZAR (¡NUEVO!)
paginaRoutes.put('/:slug', validate(slugParamSchema), validate(updatePaginaSchema), PaginaController.updatePage);

// BORRAR
paginaRoutes.delete('/:slug', validate(slugParamSchema), PaginaController.deletePage);

export { paginaRoutes };