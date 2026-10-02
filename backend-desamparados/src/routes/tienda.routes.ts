import { Router } from 'express';
import { Role } from '@prisma/client';
import { TiendaController } from '../controllers/tienda.controller.js';
import { CajaController } from '../controllers/caja.controller.js';
import { abrirCajaSchema, cerrarCajaSchema, venderSchema, ventaIdSchema } from '../schemas/caja.schema.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { limitadorCompras } from '../config/limiter.js';
import { conModulo } from '../middleware/modulos.js';
import { compraSchema, pedidosQuerySchema, productoIdSchema, productoSchema, tokenPedidoSchema } from '../schemas/tienda.schema.js';

const tiendaRoutes = Router();

// Lo público va ANTES de `authenticateToken`: el catálogo, comprar sin cuenta
// y ver el propio pedido con su enlace (un token de 32 cifras hexadecimales).
// La compra desde la web pública es el módulo tienda-web; la caja (/admin) es «tienda».
tiendaRoutes.get('/', conModulo('tienda-web'), TiendaController.catalogo);
tiendaRoutes.post('/pedidos', conModulo('tienda-web'), limitadorCompras, validate(compraSchema), TiendaController.comprar);
tiendaRoutes.get('/pedidos/:token', conModulo('tienda-web'), validate(tokenPedidoSchema), TiendaController.pedido);

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
// La caja: lo que se vende en persona, con su apertura y su cierre.
admin.get('/caja', CajaController.estado);
admin.post('/caja/abrir', validate(abrirCajaSchema), CajaController.abrir);
admin.post('/caja/ventas', validate(venderSchema), CajaController.vender);
admin.post('/caja/ventas/:id/anular', validate(ventaIdSchema), CajaController.anular);
admin.post('/caja/cerrar', validate(cerrarCajaSchema), CajaController.cerrar);
tiendaRoutes.use('/admin', admin);

export { tiendaRoutes };
