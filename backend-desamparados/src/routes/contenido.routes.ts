import { Router } from 'express';
import { type } from 'arktype';
import { Role } from '@prisma/client';
import { ContenidoController } from '../controllers/contenido.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { cachePublica } from '../middleware/cache-publica.js';
import { idParam } from '../config/common.js';
import { esSlugContenido } from '../domain/contenido.js';
import { guardarContenidoSchema } from '../schemas/contenido.schema.js';
import { sanearBloques } from '../utils/sanear-html.js';

const contenidoRoutes = Router();

// Gestión de contenido, como la portada y las noticias.
const rolesCMS = [Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR];

// La web la lee sin sesión.
contenidoRoutes.get('/:slug', cachePublica, ContenidoController.leer);

// El historial es del CMS: quién cambió qué y cuándo no es para la web.
const idVersion = type({ params: { slug: 'string', id: idParam } });
contenidoRoutes.get('/:slug/versiones', authenticateToken, checkRole(rolesCMS), ContenidoController.versiones);
contenidoRoutes.get('/:slug/versiones/:id', authenticateToken, checkRole(rolesCMS), validate(idVersion), ContenidoController.version);

/**
 * El esquema depende del slug, así que el `validate` se elige en tiempo de
 * petición. El slug se comprueba ANTES de validar: con uno desconocido no hay
 * esquema que aplicar, y responder 404 aquí evita que `guardarContenidoSchema`
 * reciba un índice que no existe.
 *
 * Los middlewares van en línea y no colgados de un `.use()` porque esta ruta
 * comparte camino con la pública de arriba: el orden de declaración manda, y un
 * `.use(authenticateToken)` entre las dos cerraría también la lectura pública.
 */
contenidoRoutes.put(
  '/:slug',
  authenticateToken,
  checkRole(rolesCMS),
  (req, res, next) => {
    const slug = req.params.slug;
    if (!esSlugContenido(slug)) return res.status(404).json({ message: 'Página no encontrada' });
    // El HTML de los bloques se limpia ANTES de validar: el servicio guarda el
    // documento entero tal y como llega, y el esquema tiene que juzgar lo que
    // de verdad se va a almacenar. Ver `sanearBloques`.
    if (req.body && typeof req.body === 'object') req.body.datos = sanearBloques(req.body.datos);
    return validate(guardarContenidoSchema(slug))(req, res, next);
  },
  ContenidoController.guardar,
);

export { contenidoRoutes };
