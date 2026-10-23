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
import { EstadoPagoEnLinea, EstadoPedido, MetodoPago, OrigenPago, Prisma, TipoTransaccion } from '@prisma/client';
import db from '../config/db';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { transactionWithRetry } from '../utils/transaction-retry.js';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { PagoEnLineaService, intentosVigentesDesde, registrarOrigenDePago, type MetodoEnLinea } from './pagos/pago-en-linea.service.js';
import { idCategoriaDeRecibos } from './recibos/comunes.js';
import { enviarCorreo } from './correos/envio.js';
import { PlantillasCorreoService } from './plantillas-correo.service.js';
import { bloqueDeSecretaria, datos, esc, urlDeLaWeb } from './correos/plantilla.js';
import { modoDePago, pagoParaLaWeb } from '../domain/redsys.js';
import { aCentimos } from '../domain/sepa.js';
import { nombreConTalla, prepararPedido, type LineaPedida } from '../domain/tienda.js';
import { deLaCorporacion } from '../domain/articulos.js';
import { eurosDeCentimos } from '../utils/euros.js';

export const CATEGORIA_TIENDA = 'Ventas de la tienda';
/** El gasto que devuelve lo cobrado de un pedido anulado: minora las ventas (700). */
export const CATEGORIA_REEMBOLSOS_TIENDA = 'Reembolsos de la tienda';

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
  /**
   * Sin él, no se tocan las que haya. Con alguna, lo que queda se cuenta en
   * cada talla y `existencias` no se usa. Las que traen `id` son las que ya
   * estaban; las que faltan se borran (los pedidos guardan su nombre copiado).
   */
  tallas?: { id?: number; nombre: string; existencias: number | null; existenciasLeidas?: number | null }[];
  /**
   * Lo que quedaba al abrir la ficha (también en cada talla). Las ventas
   * descuentan mientras tanto: con él se sabe si lo que llega es un cambio
   * de quien edita o un número viejo (ver `existenciasAlGuardar`).
   */
  existenciasLeidas?: number | null;
  /** Sin ellos, no se tocan. */
  categoriaId?: number | null;
  destacado?: boolean;
}

/** Las tallas, en su orden, para enseñarlas y para comprobar lo que queda. */
export const conTallas = { tallas: { orderBy: [{ orden: 'asc' as const }, { id: 'asc' as const }] } };

/** Lo que se guarda de un producto: las fotos de más, limpias. Las tallas van aparte. */
/**
 * Lo que se guarda en «Quedan», sin pisar lo vendido mientras la ficha
 * estaba abierta: se abre con 5, se venden 2 y, al guardar la descripción,
 * volvían a ser 5 y se vendía lo que no había. Si quien edita no lo tocó,
 * se queda lo que hay ahora; si lo cambió sobre un número que ya no es el
 * de la base, se le pide que lo revise (409).
 */
function existenciasAlGuardar(nuevas: number | null, leidas: number | null | undefined, ahora: number | null, quien: string): number | null {
  if (leidas === undefined || leidas === ahora) return nuevas;
  if (nuevas === leidas) return ahora;
  throw new HttpError(`Mientras editabas cambió lo que queda ${quien}: ahora ${ahora === null ? 'no tiene límite' : `quedan ${ahora}`}. Revísalo y guarda otra vez.`, 409);
}

function datosAGuardar({ fotos, tallas, existenciasLeidas: _leidas, ...d }: DatosProducto) {
  return {
    ...d,
    // Con tallas, lo que queda está en cada una: el del producto no se usa.
    existencias: tallas && tallas.length > 0 ? null : d.existencias,
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


type ProductoConTallas = Prisma.ProductoGetPayload<{ include: typeof conTallas }>;

const tallasDe = (p: ProductoConTallas) => p.tallas.map((t) => ({ id: t.id, nombre: t.nombre, existencias: t.existencias }));

const resumenProducto = (p: ProductoConTallas) => ({
  id: p.id, nombre: p.nombre, descripcion: p.descripcion, precio: Number(p.precio), foto: p.foto, fotos: fotosDe(p.fotos), existencias: p.existencias, activo: p.activo, orden: p.orden,
  tallas: tallasDe(p), categoriaId: p.categoriaId, destacado: p.destacado,
  // Para ordenar la tienda por «Lo más reciente».
  creadoEl: p.createdAt,
});

/** Las categorías, en el orden que les da el CMS. */
const ordenDeCategorias = [{ orden: 'asc' as const }, { nombre: 'asc' as const }, { id: 'asc' as const }];

/** Una categoría que llega con un producto tiene que existir: la pantalla pudo quedarse vieja. */
async function comprobarCategoria(categoriaId: number | null | undefined) {
  if (categoriaId == null) return;
  if (!(await db.categoriaProducto.findUnique({ where: { id: categoriaId }, select: { id: true } }))) {
    throw new HttpError('Esa categoría ya no existe. Recarga la página.', 409);
  }
}

/** Dos categorías no se llaman igual (sin mirar mayúsculas): se filtraría por las dos sin distinguirlas. */
async function comprobarNombreLibre(nombre: string, salvo?: number) {
  const otra = await db.categoriaProducto.findFirst({ where: { nombre, ...(salvo ? { id: { not: salvo } } : {}) }, select: { id: true } });
  if (otra) throw new HttpError(`Ya hay una categoría que se llama «${nombre}».`, 409);
}

/** Un producto con lo que necesita `prepararPedido`: su precio en céntimos y sus tallas. */
export const aLaVenta = (p: ProductoConTallas) => ({
  id: p.id, nombre: p.nombre, centimos: aCentimos(p.precio), activo: p.activo, existencias: p.existencias, tallas: tallasDe(p),
});

/** Una línea de pedido como la ven la web y el CMS: con su talla, si la tiene. */
const lineaVista = (l: { nombre: string; nombreTalla: string | null; precio: Prisma.Decimal; cantidad: number }) => ({
  nombre: l.nombre, talla: l.nombreTalla, precio: Number(l.precio), cantidad: l.cantidad,
});

/**
 * Pone las tallas de un producto como vienen: cambia las que ya estaban (por
 * su `id`), crea las nuevas y borra las que faltan. Un `id` de otro producto
 * no se toca: se trata como nueva.
 */
async function guardarTallas(tx: Prisma.TransactionClient, productoId: number, tallas: NonNullable<DatosProducto['tallas']>) {
  const antes = await tx.tallaProducto.findMany({ where: { productoId }, select: { id: true } });
  const suyas = new Set(antes.map((t) => t.id));
  const quedan = new Set(tallas.flatMap((t) => (t.id !== undefined && suyas.has(t.id) ? [t.id] : [])));
  await tx.tallaProducto.deleteMany({ where: { productoId, id: { notIn: [...quedan] } } });
  const ahora = new Map((await tx.tallaProducto.findMany({ where: { productoId, id: { in: [...quedan] } }, select: { id: true, existencias: true } })).map((t) => [t.id, t.existencias]));
  for (const [orden, t] of tallas.entries()) {
    const existencias = t.id !== undefined && quedan.has(t.id)
      ? existenciasAlGuardar(t.existencias, t.existenciasLeidas, ahora.get(t.id) ?? null, `de la talla ${t.nombre.trim()}`)
      : t.existencias;
    const datosTalla = { nombre: t.nombre.trim(), existencias, orden };
    if (t.id !== undefined && quedan.has(t.id)) await tx.tallaProducto.update({ where: { id: t.id }, data: datosTalla });
    else await tx.tallaProducto.create({ data: { ...datosTalla, productoId } });
  }
}

/** El correo de «pedido pagado», de su plantilla (Emails → «Pedido de la tienda pagado»). */
function correoDePedido(p: { nombre: string; id: number; total: Prisma.Decimal; lineas: { nombre: string; nombreTalla: string | null; precio: Prisma.Decimal; cantidad: number }[] }) {
  return PlantillasCorreoService.correo('pedido_tienda', {
    campos: { nombre: p.nombre, numero: p.id, total: eurosDeCentimos(aCentimos(p.total)) },
    bloques: {
      lineas: datos([
        ...p.lineas.map((l): [string, string] => [`${l.cantidad} × ${esc(nombreConTalla(l.nombre, l.nombreTalla))}`, esc(eurosDeCentimos(aCentimos(l.precio) * l.cantidad))]),
        ['Total', `<strong>${esc(eurosDeCentimos(aCentimos(p.total)))}</strong>`],
      ]),
      secretaria: bloqueDeSecretaria('Dónde y cuándo'),
    },
  });
}

/**
 * Aplica el pago de un pedido: existencias, contabilidad y estado, todo o
 * nada. Lanza HttpError si ya no se puede (y el pago queda como incidencia).
 */
async function aplicarPago(pedidoId: number, metodo: MetodoEnLinea, meta: MetaDeAuditoria, alAplicar?: (tx: Prisma.TransactionClient) => Promise<void>) {
  const categoriaId = await idCategoriaDeRecibos(TipoTransaccion.INGRESO, CATEGORIA_TIENDA);
  // Serializable y con reintento: dos avisos casi a la vez del mismo producto
  // chocan (1020/1213) al descontar, y sin reintento el segundo se quedaba
  // «sin pagar» con el dinero cobrado.
  const pedido = await transactionWithRetry(async (tx) => {
    const p = await tx.pedidoTienda.findUnique({ where: { id: pedidoId }, include: { lineas: true } });
    if (!p) throw new HttpError('El pedido ya no existe.');
    if (p.estado !== EstadoPedido.PENDIENTE_PAGO) throw new HttpError('El pedido ya no estaba pendiente de pago.');
    for (const l of p.lineas) {
      // Sin producto es que se borró con el pedido sin pagar (un intento
      // caducado): no se cobra lo que ya no existe.
      if (l.productoId === null) throw new HttpError(`«${nombreConTalla(l.nombre, l.nombreTalla)}» ya no está a la venta.`);
      // La talla se borró con el pedido en el banco: sin ella, el descuento
      // caía sobre el producto (sin límite cuando cuenta por tallas) y se
      // cobraba sin comprobar nada.
      if (l.tallaId === null && l.nombreTalla !== null) throw new HttpError(`La talla ${l.nombreTalla} de «${l.nombre}» ya no está a la venta.`);
      // Condicionado: con dos pedidos del último que queda, solo uno se lo
      // lleva. Con talla, se descuenta de la talla. Sin límite no se
      // descuenta: `decrement` sobre null deja null.
      const hay = { OR: [{ existencias: null }, { existencias: { gte: l.cantidad } }] };
      const quitado = l.tallaId !== null
        ? await tx.tallaProducto.updateMany({ where: { id: l.tallaId, ...hay }, data: { existencias: { decrement: l.cantidad } } })
        : await tx.producto.updateMany({ where: { id: l.productoId, ...hay }, data: { existencias: { decrement: l.cantidad } } });
      if (quitado.count === 0) throw new HttpError(`«${nombreConTalla(l.nombre, l.nombreTalla)}» se agotó mientras se pagaba.`);
    }
    const apunte = await tx.transaccion.create({
      data: {
        tipo: TipoTransaccion.INGRESO, categoriaId, concepto: `Tienda: pedido n.º ${pedidoId}`,
        importe: p.total, fecha: new Date(), metodoPago: metodo as MetodoPago,
      },
    });
    // El pedido guarda su apunte: así la contabilidad sabe que no es manual.
    // El aviso del banco cierra aquí su pago: lo aplicado y el pago, a la vez.
    await alAplicar?.(tx);
    return tx.pedidoTienda.update({
      where: { id: pedidoId },
      data: { estado: EstadoPedido.PAGADO, metodo: metodo as MetodoPago, pagadoEl: new Date(), transaccionId: apunte.id },
      include: { lineas: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await AuditoriaService.log(ACCIONES_AUDITORIA.TIENDA_PEDIDO_PAGADO, meta, 'pedido', pedidoId, { despues: { total: pedido.total.toString(), metodo } });
  void correoDePedido(pedido).then(({ asunto, html, uso }) => enviarCorreo(pedido.email, asunto, html, { uso })).catch(console.error);
}

registrarOrigenDePago(OrigenPago.TIENDA, {
  aplicar: aplicarPago,
  correo: async (id) => (await db.pedidoTienda.findUnique({ where: { id }, select: { email: true } }))?.email ?? null,
  cancelar: async (id) => { await db.pedidoTienda.updateMany({ where: { id, estado: EstadoPedido.PENDIENTE_PAGO }, data: { estado: EstadoPedido.CANCELADO } }); },
  // Resolver una incidencia ya es solo de Tesorería (y el pedido está sin cobrar).
  anular: async (id, meta) => { await TiendaService.anular(id, meta, { puedeReembolsar: true }); },
});

/**
 * Los pedidos cuyo pago cobró el banco y quedó como incidencia sin resolver:
 * el dinero está, el pedido no. Sin `ids`, todos: se parte de los pagos
 * (pocos, e indexados por estado) y no de los pedidos PENDIENTE_PAGO, que
 * crecen con cada carrito que se abandona en la página del banco.
 */
async function conPagoEnIncidencia(ids?: number[]): Promise<Set<number>> {
  if (ids?.length === 0) return new Set();
  const pagos = await db.pagoEnLinea.findMany({
    where: { origen: OrigenPago.TIENDA, referenciaId: ids ? { in: ids } : { not: null }, estado: EstadoPagoEnLinea.INCIDENCIA, resueltaEl: null },
    select: { referenciaId: true },
  });
  return new Set(pagos.map((p) => p.referenciaId!));
}

export class TiendaService {
  /** Lo que se vende, para la web pública: solo lo activo. */
  static async catalogo() {
    const productos = await db.producto.findMany({ where: { activo: true }, include: conTallas, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }, { id: 'asc' }] });
    // Solo las que tienen algo a la venta: un filtro que no enseña nada sobra.
    const categorias = await db.categoriaProducto.findMany({
      where: { productos: { some: { activo: true } } }, select: { id: true, nombre: true }, orderBy: ordenDeCategorias,
    });
    return {
      productos: productos.map(resumenProducto),
      categorias,
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
    const catalogo = await db.producto.findMany({ where: { id: { in: ids } }, include: conTallas });
    const preparado = prepararPedido(datosCompra.lineas, catalogo.map(aLaVenta));
    if ('problema' in preparado) throw new HttpError(preparado.problema, 409);

    const pedido = await db.pedidoTienda.create({
      data: {
        token: crypto.randomBytes(16).toString('hex'),
        nombre: datosCompra.nombre.trim(), email: datosCompra.email.trim().toLowerCase(), telefono: datosCompra.telefono.trim(),
        total: new Prisma.Decimal(preparado.centimos).div(100),
        lineas: { create: preparado.lineas.map((l) => ({ productoId: l.productoId, tallaId: l.tallaId, nombre: l.nombre, nombreTalla: l.talla, precio: new Prisma.Decimal(l.centimos).div(100), cantidad: l.cantidad })) },
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
      lineas: p.lineas.map(lineaVista),
      // Cobrado pero sin poder completarse (se agotó mientras pagaba): la
      // pantalla no debe decir «el banco aún no ha confirmado el pago».
      pagoConIncidencia: (await conPagoEnIncidencia([p.id])).has(p.id),
    };
  }

  // --- La gestión, desde el CMS ---

  static async productos() {
    const lista = await db.producto.findMany({ include: conTallas, orderBy: [{ activo: 'desc' }, { orden: 'asc' }, { nombre: 'asc' }, { id: 'asc' }] });
    return lista.map(resumenProducto);
  }

  static async crearProducto(d: DatosProducto) {
    await comprobarCategoria(d.categoriaId);
    return resumenProducto(await db.$transaction(async (tx) => {
      const p = await tx.producto.create({ data: datosAGuardar(d) });
      if (d.tallas) await guardarTallas(tx, p.id, d.tallas);
      return tx.producto.findUniqueOrThrow({ where: { id: p.id }, include: conTallas });
    }));
  }

  static async actualizarProducto(id: number, d: DatosProducto) {
    if (!(await db.producto.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundError('Producto no encontrado.');
    await comprobarCategoria(d.categoriaId);
    return resumenProducto(await db.$transaction(async (tx) => {
      // Si ya cuenta por tallas y no se mandan (una pantalla vieja), sigue
      // contando por talla: el `existencias` que llega no se usa.
      const yaTiene = d.tallas === undefined && (await tx.tallaProducto.count({ where: { productoId: id } })) > 0;
      const datos = datosAGuardar(d);
      if (datos.existencias !== null) {
        const actual = await tx.producto.findUniqueOrThrow({ where: { id }, select: { existencias: true } });
        datos.existencias = existenciasAlGuardar(datos.existencias, d.existenciasLeidas, actual.existencias, 'del producto');
      }
      await tx.producto.update({ where: { id }, data: { ...datos, ...(yaTiene ? { existencias: null } : {}) } });
      if (d.tallas) await guardarTallas(tx, id, d.tallas);
      return tx.producto.findUniqueOrThrow({ where: { id }, include: conTallas });
    }));
  }


  /** Con pedidos, no se borra (los pedidos lo nombran): se retira de la venta. */
  static async borrarProducto(id: number) {
    // Los pedidos cancelados y los intentos caducados no lo atan.
    const usado = await db.pedidoTiendaLinea.count({
      where: {
        productoId: id,
        pedido: { estado: { not: EstadoPedido.CANCELADO }, NOT: { estado: EstadoPedido.PENDIENTE_PAGO, createdAt: { lt: intentosVigentesDesde() } } },
      },
    });
    if (usado > 0) {
      await db.producto.update({ where: { id }, data: { activo: false } });
      return { message: 'Tiene pedidos: se ha retirado de la venta en vez de borrarlo.' };
    }
    await db.producto.deleteMany({ where: { id } });
    return { message: 'Producto borrado.' };
  }

  // --- Las categorías ---

  static async categorias() {
    const lista = await db.categoriaProducto.findMany({ orderBy: ordenDeCategorias, include: { _count: { select: { productos: true } } } });
    return lista.map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden, productos: c._count.productos }));
  }

  /** Una nueva va al final: las primeras son las que se ven sin abrir «Más». */
  static async crearCategoria(nombre: string) {
    const limpio = nombre.trim();
    await comprobarNombreLibre(limpio);
    const ultima = await db.categoriaProducto.aggregate({ _max: { orden: true } });
    const c = await db.categoriaProducto.create({ data: { nombre: limpio, orden: (ultima._max.orden ?? -1) + 1 } });
    return { id: c.id, nombre: c.nombre, orden: c.orden, productos: 0 };
  }

  static async renombrarCategoria(id: number, nombre: string) {
    const limpio = nombre.trim();
    if (!(await db.categoriaProducto.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundError('Categoría no encontrada.');
    await comprobarNombreLibre(limpio, id);
    const c = await db.categoriaProducto.update({ where: { id }, data: { nombre: limpio }, include: { _count: { select: { productos: true } } } });
    return { id: c.id, nombre: c.nombre, orden: c.orden, productos: c._count.productos };
  }

  /**
   * Pone el orden de todas de una vez. Las que no vengan (otra pantalla creó
   * una mientras tanto) quedan detrás, en el orden que tenían.
   */
  static async ordenarCategorias(ids: number[]) {
    await db.$transaction(async (tx) => {
      const todas = await tx.categoriaProducto.findMany({ orderBy: ordenDeCategorias, select: { id: true } });
      const existentes = new Set(todas.map((c) => c.id));
      const enOrden = [...ids.filter((id) => existentes.has(id)), ...todas.map((c) => c.id).filter((id) => !ids.includes(id))];
      for (const [orden, id] of enOrden.entries()) await tx.categoriaProducto.update({ where: { id }, data: { orden } });
    });
    return TiendaService.categorias();
  }

  /** Sus productos no se borran: se quedan sin categoría y salen solo en «Todo». */
  static async borrarCategoria(id: number) {
    const r = await db.categoriaProducto.deleteMany({ where: { id } });
    if (r.count === 0) throw new NotFoundError('Categoría no encontrada.');
    return { message: 'Categoría borrada. Sus productos siguen a la venta, sin categoría.' };
  }

  static async pedidos(estado?: EstadoPedido) {
    // Sin filtro, los que no se pagaron no salen, salvo los cobrados con
    // incidencia: el banco tiene el dinero y hay que devolverlo o anularlos.
    const enIncidencia = estado ? [] : [...await conPagoEnIncidencia()];
    const lista = await db.pedidoTienda.findMany({
      where: estado ? { estado } : { OR: [{ estado: { not: EstadoPedido.PENDIENTE_PAGO } }, { id: { in: enIncidencia } }] },
      include: { lineas: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    const conIncidencia = await conPagoEnIncidencia(lista.filter((p) => p.estado === EstadoPedido.PENDIENTE_PAGO).map((p) => p.id));
    return lista.map((p) => ({
      id: p.id, nombre: p.nombre, email: p.email, telefono: p.telefono, estado: p.estado, total: Number(p.total), metodo: p.metodo,
      creadoEl: p.createdAt, pagadoEl: p.pagadoEl, entregadoEl: p.entregadoEl, canceladoEl: p.canceladoEl,
      pagoConIncidencia: conIncidencia.has(p.id),
      lineas: p.lineas.map(lineaVista),
    }));
  }

  /**
   * Anula un pedido: el cobrado con incidencia (se agotó mientras pagaba) o
   * el desistimiento de los 14 días de las Condiciones de compra. Pasa a
   * CANCELADO y, si llegó a cobrarse (pagado o entregado), vuelven las
   * existencias, como al anular una venta en mano, y se apunta el reembolso
   * como gasto: el ingreso se queda, porque el dinero entró y salió (y puede
   * ser de un ejercicio ya cerrado). Devolver el dinero al comprador es cosa
   * del banco o de Secretaría; esto deja la tienda y la contabilidad al día.
   *
   * El cobrado solo lo anula quien lleva Contabilidad (`puedeReembolsar`):
   * el gasto que apunta no se puede tocar después y el pedido CANCELADO no
   * tiene vuelta atrás, así que Secretaría, que no entra en Contabilidad,
   * dejaba un reembolso que nadie podía corregir. El no cobrado no apunta
   * nada y lo sigue anulando cualquiera de la tienda.
   */
  static async anular(id: number, meta: MetaDeAuditoria | undefined, { puedeReembolsar }: { puedeReembolsar: boolean }) {
    const categoriaId = await idCategoriaDeRecibos(TipoTransaccion.GASTO, CATEGORIA_REEMBOLSOS_TIENDA);
    const { antes, reembolso } = await transactionWithRetry(async (tx) => {
      const p = await tx.pedidoTienda.findUnique({ where: { id }, include: { lineas: true } });
      if (!p) throw new NotFoundError('Pedido no encontrado.');
      if (p.estado === EstadoPedido.CANCELADO) throw new HttpError('Ese pedido ya estaba anulado.', 409);
      const cobrado = p.estado === EstadoPedido.PAGADO || p.estado === EstadoPedido.ENTREGADO;
      if (cobrado && !puedeReembolsar) {
        throw new HttpError('Este pedido ya se cobró: anularlo apunta su reembolso en Contabilidad, y eso solo lo puede hacer Tesorería.', 403, { soloTesoreria: true });
      }
      let reembolsoId: number | null = null;
      if (cobrado) {
        for (const l of p.lineas) {
          if (l.productoId === null) continue;
          // Sin límite (null) se queda sin límite. Con talla, vuelve a su
          // talla si aún existe; si se borró, no va al producto (que cuenta por tallas).
          if (l.tallaId !== null) await tx.tallaProducto.updateMany({ where: { id: l.tallaId, existencias: { not: null } }, data: { existencias: { increment: l.cantidad } } });
          else if (l.nombreTalla === null) await tx.producto.updateMany({ where: { id: l.productoId, existencias: { not: null } }, data: { existencias: { increment: l.cantidad } } });
        }
        if (p.transaccionId !== null) {
          const apunte = await tx.transaccion.create({
            data: {
              tipo: TipoTransaccion.GASTO, categoriaId, concepto: `Tienda: reembolso del pedido n.º ${id}`,
              importe: p.total, fecha: new Date(), metodoPago: p.metodo,
            },
          });
          reembolsoId = apunte.id;
        }
      }
      const { count } = await tx.pedidoTienda.updateMany({
        where: { id, estado: p.estado },
        data: { estado: EstadoPedido.CANCELADO, canceladoEl: new Date(), reembolsoId },
      });
      if (count !== 1) throw new HttpError('El pedido acaba de cambiar. Recarga la página.', 409);
      return { antes: p.estado, reembolso: reembolsoId !== null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await AuditoriaService.log(ACCIONES_AUDITORIA.TIENDA_PEDIDO_ANULADO, meta ?? {}, 'pedido', id, { antes: { estado: antes }, despues: { estado: EstadoPedido.CANCELADO, reembolso } });
    return { message: reembolso ? `Pedido n.º ${id} anulado: el reembolso queda apuntado en Contabilidad.` : `Pedido n.º ${id} anulado.` };
  }

  static async entregar(id: number, meta?: MetaDeAuditoria) {
    const r = await db.pedidoTienda.updateMany({ where: { id, estado: EstadoPedido.PAGADO }, data: { estado: EstadoPedido.ENTREGADO, entregadoEl: new Date() } });
    if (r.count === 0) throw new HttpError('Solo se entrega un pedido pagado y sin entregar.', 409);
    await AuditoriaService.log(ACCIONES_AUDITORIA.TIENDA_PEDIDO_ENTREGADO, meta ?? {}, 'pedido', id);
    return { message: `Pedido n.º ${id} entregado.` };
  }
}
