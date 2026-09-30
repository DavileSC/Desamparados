import type { EstadoPedido } from '@prisma/client';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { TiendaService, type DatosCompra, type DatosProducto } from '../services/tienda.service.js';

export class TiendaController {
  static catalogo = manejar('Error obteniendo la tienda', async (_req, res) => { res.json(await TiendaService.catalogo()); });
  static comprar = manejar('Error haciendo el pedido', async (req, res) => {
    res.status(201).json(await TiendaService.comprar(req.body as DatosCompra, AuditoriaService.metaFromReq(req)));
  });
  static pedido = manejar('Error obteniendo el pedido', async (req, res) => { res.json(await TiendaService.pedidoPublico(String(req.params.token))); });

  static productos = manejar('Error obteniendo los productos', async (_req, res) => { res.json(await TiendaService.productos()); });
  static crearProducto = manejar('Error guardando el producto', async (req, res) => { res.status(201).json(await TiendaService.crearProducto(req.body as DatosProducto)); });
  static actualizarProducto = manejar('Error guardando el producto', async (req, res) => { res.json(await TiendaService.actualizarProducto(Number(req.params.id), req.body as DatosProducto)); });
  static borrarProducto = manejar('Error borrando el producto', async (req, res) => { res.json(await TiendaService.borrarProducto(Number(req.params.id))); });
  static pedidos = manejar('Error obteniendo los pedidos', async (req, res) => {
    res.json(await TiendaService.pedidos(req.query.estado as EstadoPedido | undefined));
  });
  static entregar = manejar('Error entregando el pedido', async (req, res) => {
    res.json(await TiendaService.entregar(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });
}
