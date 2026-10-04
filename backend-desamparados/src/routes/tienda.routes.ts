import { Router } from 'express';
import { Role } from '@prisma/client';
import { TiendaController } from '../controllers/tienda.controller.js';
import { CajaController } from '../controllers/caja.controller.js';
import { ingresoIdSchema, ingresoSchema, venderSchema, ventaIdSchema } from '../schemas/caja.schema.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { limitadorCompras } from '../config/limiter.js';
import { conModulo } from '../middleware/modulos.js';
import { categoriaSchema, compraSchema, ordenCategoriasSchema, pedidosQuerySchema, productoIdSchema, productoSchema, tokenPedidoSchema } from '../schemas/tienda.schema.js';

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
admin.get('/categorias', TiendaController.categorias);
admin.post('/categorias', validate(categoriaSchema), TiendaController.crearCategoria);
// Antes que /categorias/:id, para que «orden» no se tome por un id.
admin.put('/categorias/orden', validate(ordenCategoriasSchema), TiendaController.ordenarCategorias);
admin.put('/categorias/:id', validate(productoIdSchema), validate(categoriaSchema), TiendaController.renombrarCategoria);
admin.delete('/categorias/:id', validate(productoIdSchema), TiendaController.borrarCategoria);
admin.get('/pedidos', validate(pedidosQuerySchema), TiendaController.pedidos);
admin.post('/pedidos/:id/entregar', validate(productoIdSchema), TiendaController.entregar);
// La venta en mano: lo que se lleva alguien en Secretaría, y el efectivo
// que después se ingresa en el banco. Sin caja que abrir ni cerrar.
admin.get('/caja', CajaController.estado);
admin.post('/caja/ventas', validate(venderSchema), CajaController.vender);
admin.post('/caja/ventas/:id/anular', validate(ventaIdSchema), CajaController.anular);
admin.post('/caja/ingresos', validate(ingresoSchema), CajaController.ingresar);
admin.delete('/caja/ingresos/:id', validate(ingresoIdSchema), CajaController.borrarIngreso);
tiendaRoutes.use('/admin', admin);

export { tiendaRoutes };
