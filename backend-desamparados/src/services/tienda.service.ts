/**
 * La tienda en línea: el catálogo, la compra sin cuenta y los pedidos, que se
 * recogen en Secretaría (sin envíos: ni portes ni direcciones que guardar).
 *
 * Pagar va por la pasarela de siempre (`PagoEnLineaService`). El pedido pasa
 * a pagado solo con el aviso firmado del banco (o en el acto, con el pago
 * simulado de desarrollo): entonces se descuentan las existencias, se apunta
 * el ingreso en la contabilidad y se manda el correo. Si al llegar el aviso ya
 * no queda existencia, el pago queda como incidencia para devolverlo.
 */
import crypto from 'node:crypto';
import { EstadoPedido, MetodoPago, OrigenPago, Prisma, TipoTransaccion } from '@prisma/client';
import db from '../config/db';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { PagoEnLineaService, registrarOrigenDePago, type MetodoEnLinea } from './pagos/pago-en-linea.service.js';
import { idCategoriaDeRecibos } from './recibos/comunes.js';
import { enviarCorreo } from './correos/envio.js';
import { PlantillasCorreoService } from './plantillas-correo.service.js';
import { bloqueDeSecretaria, datos, esc, firma, maquetar, parrafo, urlDeLaWeb } from './correos/plantilla.js';
import { modoDePago, pagoParaLaWeb } from '../domain/redsys.js';
import { aCentimos } from '../domain/sepa.js';
import { prepararPedido, type LineaPedida } from '../domain/tienda.js';
import { deLaCorporacion } from '../domain/articulos.js';

export const CATEGORIA_TIENDA = 'Ventas de la tienda';

export interface DatosProducto {
  nombre: string;
  descripcion: string;
  precio: number;
  foto: string | null;
  /** Sin él, no se tocan las que haya. Las que no tienen dirección se descartan. */
  fotos?: { url: string | null; pie: string }[];
  existencias: number | null;
  activo: boolean;
  orden: number;
}

/** Lo que se guarda de un producto: las fotos de más, limpias. */
function datosAGuardar({ fotos, ...d }: DatosProducto) {
  return {
    ...d,
    nombre: d.nombre.trim(),
    precio: new Prisma.Decimal(d.precio),
    ...(fotos !== undefined ? { fotos: fotos.filter((f) => f.url).map((f) => ({ url: f.url!, pie: f.pie.trim() })) } : {}),
  };
}

/** Las fotos de más tal como están guardadas: un JSON que puede faltar en los productos de antes. */
function fotosDe(fotos: Prisma.JsonValue): { url: string; pie: string }[] {
  if (!Array.isArray(fotos)) return [];
  return fotos.flatMap((f) => (f && typeof f === 'object' && !Array.isArray(f) && typeof f.url === 'string' && f.url
    ? [{ url: f.url, pie: typeof f.pie === 'string' ? f.pie : '' }]
    : []));
}

export interface DatosCompra {
  nombre: string;
  email: string;
  telefono: string;
  metodo: MetodoEnLinea;
  lineas: LineaPedida[];
}

const euros = (centimos: number) => `${(centimos / 100).toFixed(2).replace('.', ',')} €`;

const resumenProducto = (p: { id: number; nombre: string; descripcion: string; precio: Prisma.Decimal; foto: string | null; fotos: Prisma.JsonValue; existencias: number | null; activo: boolean; orden: number }) => ({
  id: p.id, nombre: p.nombre, descripcion: p.descripcion, precio: Number(p.precio), foto: p.foto, fotos: fotosDe(p.fotos), existencias: p.existencias, activo: p.activo, orden: p.orden,
});

/** El correo de «pedido pagado», con lo que se compró y dónde recogerlo. */
/** El correo de «pedido pagado», de su plantilla (Emails → «Pedido de la tienda pagado»). */
function correoDePedido(p: { nombre: string; id: number; total: Prisma.Decimal; lineas: { nombre: string; precio: Prisma.Decimal; cantidad: number }[] }) {
  return PlantillasCorreoService.correo('pedido_tienda', {
    campos: { nombre: p.nombre, numero: p.id, total: euros(aCentimos(p.total)) },
    bloques: {
      lineas: datos([
        ...p.lineas.map((l): [string, string] => [`${l.cantidad} × ${esc(l.nombre)}`, esc(euros(aCentimos(l.precio) * l.cantidad))]),
        ['Total', `<strong>${esc(euros(aCentimos(p.total)))}</strong>`],
      ]),
      secretaria: bloqueDeSecretaria('Dónde y cuándo'),
    },
  });
}

/**
 * Aplica el pago de un pedido: existencias, contabilidad y estado, todo o
 * nada. Lanza HttpError si ya no se puede (y el pago queda como incidencia).
 */
async function aplicarPago(pedidoId: number, metodo: MetodoEnLinea, meta: MetaDeAuditoria) {
  const categoriaId = await idCategoriaDeRecibos(TipoTransaccion.INGRESO, CATEGORIA_TIENDA);
  const pedido = await db.$transaction(async (tx) => {
    const p = await tx.pedidoTienda.findUnique({ where: { id: pedidoId }, include: { lineas: true } });
    if (!p) throw new HttpError('El pedido ya no existe.');
    if (p.estado !== EstadoPedido.PENDIENTE_PAGO) throw new HttpError('El pedido ya no estaba pendiente de pago.');
    for (const l of p.lineas) {
      if (l.productoId === null) continue;
      // Condicionado: con dos pedidos del último que queda, solo uno se lo lleva.
      const quitado = await tx.producto.updateMany({
        where: { id: l.productoId, OR: [{ existencias: null }, { existencias: { gte: l.cantidad } }] },
        data: { existencias: { decrement: l.cantidad } },
      });
      if (quitado.count === 0) throw new HttpError(`«${l.nombre}» se agotó mientras se pagaba.`);
      // Sin límite no se descuenta: `decrement` sobre null deja null.
    }
    const pagado = await tx.pedidoTienda.update({
      where: { id: pedidoId },
      data: { estado: EstadoPedido.PAGADO, metodo: metodo as MetodoPago, pagadoEl: new Date() },
      include: { lineas: true },
    });
    await tx.transaccion.create({
      data: {
        tipo: TipoTransaccion.INGRESO, categoriaId, concepto: `Tienda: pedido n.º ${pedidoId}`,
        importe: p.total, fecha: new Date(), metodoPago: metodo as MetodoPago,
      },
    });
    return pagado;
  });
  await AuditoriaService.log(ACCIONES_AUDITORIA.TIENDA_PEDIDO_PAGADO, meta, 'pedido', pedidoId, { despues: { total: pedido.total.toString(), metodo } });
  void correoDePedido(pedido).then(({ asunto, html }) => enviarCorreo(pedido.email, asunto, html)).catch(console.error);
}

registrarOrigenDePago(OrigenPago.TIENDA, aplicarPago, async (id) => (await db.pedidoTienda.findUnique({ where: { id }, select: { email: true } }))?.email ?? null);

export class TiendaService {
  /** Lo que se vende, para la web pública: solo lo activo. */
  static async catalogo() {
    const productos = await db.producto.findMany({ where: { activo: true }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }, { id: 'asc' }] });
    return {
      productos: productos.map(resumenProducto),
      // Sin pasarela no se puede comprar: la web enseña el catálogo y dice dónde
      // comprar. Con ella, los métodos que admite (Bizum, solo si está contratado).
      pagoDisponible: modoDePago() !== null,
      metodos: modoDePago() === 'redsys' ? pagoParaLaWeb()?.metodos ?? ['TARJETA'] : ['TARJETA'],
    };
  }

  /**
   * Compra sin cuenta. Calcula el total aquí, apunta el pedido y lo manda al
   * banco (o lo da por pagado en el acto, con el pago simulado).
   */
  static async comprar(datosCompra: DatosCompra, meta: MetaDeAuditoria) {
    const modo = modoDePago();
    if (!modo) throw new HttpError('La tienda en línea todavía no admite pagos. Los recuerdos se pueden comprar en Secretaría.', 409);
    const ids = [...new Set(datosCompra.lineas.map((l) => l.productoId))];
    const catalogo = await db.producto.findMany({ where: { id: { in: ids } } });
    const preparado = prepararPedido(datosCompra.lineas, catalogo.map((p) => ({ id: p.id, nombre: p.nombre, centimos: aCentimos(p.precio), activo: p.activo, existencias: p.existencias })));
    if ('problema' in preparado) throw new HttpError(preparado.problema, 409);

    const pedido = await db.pedidoTienda.create({
      data: {
        token: crypto.randomBytes(16).toString('hex'),
        nombre: datosCompra.nombre.trim(), email: datosCompra.email.trim().toLowerCase(), telefono: datosCompra.telefono.trim(),
        total: new Prisma.Decimal(preparado.centimos).div(100),
        lineas: { create: preparado.lineas.map((l) => ({ productoId: l.productoId, nombre: l.nombre, precio: new Prisma.Decimal(l.centimos).div(100), cantidad: l.cantidad })) },
      },
    });

    if (modo === 'simulado') {
      await aplicarPago(pedido.id, datosCompra.metodo, meta);
      return { tipo: 'hecho' as const, token: pedido.token };
    }
    const banco = await PagoEnLineaService.iniciarSinCuenta({
      origen: OrigenPago.TIENDA, referenciaId: pedido.id, centimos: preparado.centimos, metodo: datosCompra.metodo,
      descripcion: `Tienda ${deLaCorporacion()}, pedido ${pedido.id}`,
      urlVuelta: urlDeLaWeb(`/tienda/pedido/${pedido.token}`),
      urlFallo: urlDeLaWeb(`/tienda/pedido/${pedido.token}?resultado=no`),
    });
    return { ...banco, token: pedido.token };
  }

  /** Cómo va un pedido, para quien lo hizo (con su enlace): sin el correo ni el teléfono. */
  static async pedidoPublico(token: string) {
    const p = await db.pedidoTienda.findUnique({ where: { token }, include: { lineas: true } });
    if (!p) throw new NotFoundError('No se encuentra ese pedido.');
    return {
      numero: p.id, estado: p.estado, total: Number(p.total), nombre: p.nombre,
      lineas: p.lineas.map((l) => ({ nombre: l.nombre, precio: Number(l.precio), cantidad: l.cantidad })),
    };
  }

  // --- La gestión, desde el CMS ---

  static async productos() {
    const lista = await db.producto.findMany({ orderBy: [{ activo: 'desc' }, { orden: 'asc' }, { nombre: 'asc' }, { id: 'asc' }] });
    return lista.map(resumenProducto);
  }

  static async crearProducto(d: DatosProducto) {
    return resumenProducto(await db.producto.create({ data: datosAGuardar(d) }));
  }

  static async actualizarProducto(id: number, d: DatosProducto) {
    if (!(await db.producto.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundError('Producto no encontrado.');
    return resumenProducto(await db.producto.update({ where: { id }, data: datosAGuardar(d) }));
  }

  /** Con pedidos, no se borra (los pedidos lo nombran): se retira de la venta. */
  static async borrarProducto(id: number) {
    const usado = await db.pedidoTiendaLinea.count({ where: { productoId: id } });
    if (usado > 0) {
      await db.producto.update({ where: { id }, data: { activo: false } });
      return { message: 'Tiene pedidos: se ha retirado de la venta en vez de borrarlo.' };
    }
    await db.producto.deleteMany({ where: { id } });
    return { message: 'Producto borrado.' };
  }

  static async pedidos(estado?: EstadoPedido) {
    const lista = await db.pedidoTienda.findMany({
      where: estado ? { estado } : { estado: { not: EstadoPedido.PENDIENTE_PAGO } },
      include: { lineas: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return lista.map((p) => ({
      id: p.id, nombre: p.nombre, email: p.email, telefono: p.telefono, estado: p.estado, total: Number(p.total), metodo: p.metodo,
      creadoEl: p.createdAt, pagadoEl: p.pagadoEl, entregadoEl: p.entregadoEl,
      lineas: p.lineas.map((l) => ({ nombre: l.nombre, precio: Number(l.precio), cantidad: l.cantidad })),
    }));
  }

  static async entregar(id: number, meta?: MetaDeAuditoria) {
    const r = await db.pedidoTienda.updateMany({ where: { id, estado: EstadoPedido.PAGADO }, data: { estado: EstadoPedido.ENTREGADO, entregadoEl: new Date() } });
    if (r.count === 0) throw new HttpError('Solo se entrega un pedido pagado y sin entregar.', 409);
    await AuditoriaService.log(ACCIONES_AUDITORIA.TIENDA_PEDIDO_ENTREGADO, meta ?? {}, 'pedido', id);
    return { message: `Pedido n.º ${id} entregado.` };
  }
}
