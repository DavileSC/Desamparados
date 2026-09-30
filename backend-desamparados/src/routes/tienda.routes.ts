import { Router } from 'express';
import { Role } from '@prisma/client';
import { TiendaController } from '../controllers/tienda.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { limitadorCompras } from '../config/limiter.js';
import { compraSchema, pedidosQuerySchema, productoIdSchema, productoSchema, tokenPedidoSchema } from '../schemas/tienda.schema.js';

const tiendaRoutes = Router();

// Lo público va ANTES de `authenticateToken`: el catálogo, comprar sin cuenta
// y ver el propio pedido con su enlace (un token de 32 cifras hexadecimales).
tiendaRoutes.get('/', TiendaController.catalogo);
tiendaRoutes.post('/pedidos', limitadorCompras, validate(compraSchema), TiendaController.comprar);
tiendaRoutes.get('/pedidos/:token', validate(tokenPedidoSchema), TiendaController.pedido);

// La gestión: productos y pedidos, desde el CMS.
const admin = Router();
admin.use(authenticateToken);
admin.use(checkRole([Role.ADMIN, Role.SECRETARIA, Role.TESORERIA, Role.HERMANO_MAYOR]));
admin.get('/productos', TiendaController.productos);
admin.post('/productos', validate(productoSchema), TiendaController.crearProducto);
admin.put('/productos/:id', validate(productoIdSchema), validate(productoSchema), TiendaController.actualizarProducto);
admin.delete('/productos/:id', validate(productoIdSchema), TiendaController.borrarProducto);
admin.get('/pedidos', validate(pedidosQuerySchema), TiendaController.pedidos);
admin.post('/pedidos/:id/entregar', validate(productoIdSchema), TiendaController.entregar);
tiendaRoutes.use('/admin', admin);

export { tiendaRoutes };
