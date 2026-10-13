/**
 * La venta en mano de la tienda: quien se lleva algo en Secretaría sin pasar
 * por la web, y el efectivo que después se lleva al banco.
 *
 * El Grupo no tiene mostrador: vende de vez en cuando, guarda el efectivo y
 * lo ingresa en la cuenta más tarde. Por eso no hay caja que abrir ni que
 * cerrar. Cada venta descuenta existencias y apunta su ingreso en la
 * contabilidad en el acto, en la categoría de la tienda en línea (el efectivo
 * va a Caja y la tarjeta o el Bizum a Bancos en la partida doble). Lo que se
 * ingresa en el banco pasa de Caja a Bancos y se resta de lo que queda por
 * ingresar.
 *
 * Las ventas de antes, de cuando había caja, siguen aquí con la suya; las de
 * una caja ya cerrada no se anulan (estaban contadas en su arqueo).
 */
import { MetodoPago, Prisma, TipoTransaccion } from '@prisma/client';
import db from '../config/db.js';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { transactionWithRetry } from '../utils/transaction-retry.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { idCategoriaDeRecibos } from './recibos/comunes.js';
import { CATEGORIA_TIENDA, aLaVenta, conTallas } from './tienda.service.js';
import { aCentimos } from '../domain/sepa.js';
import { diaMadrid, inicioDiaMadrid } from '../domain/contabilidad.js';
import { prepararVenta, type LineaDeCaja, type MetodoDeCaja } from '../domain/caja.js';
import { nombreConTalla } from '../domain/tienda.js';
import { eurosDeCentimos } from '../utils/euros.js';

const aEuros = (centimos: number) => new Prisma.Decimal(centimos).div(100);

/** Cuántas ventas recientes se enseñan, y cuántos ingresos. */
const VENTAS_A_LA_VISTA = 50;
const INGRESOS_A_LA_VISTA = 20;

async function nombreDe(meta: MetaDeAuditoria) {
  if (!meta.userId) return null;
  const u = await db.user.findUnique({ where: { id: meta.userId }, select: { nombre: true, apellidos: true } });
  return u ? `${u.nombre} ${u.apellidos ?? ''}`.trim().slice(0, 120) : null;
}

/**
 * Lo cobrado en efectivo (sin las anuladas) menos lo ingresado en el banco, en
 * céntimos. Dentro de una transacción si se va a apuntar o anular algo.
 */
async function efectivoPorIngresar(tx: Prisma.TransactionClient | typeof db = db) {
  const [vendido, ingresado] = await Promise.all([
    tx.cajaVenta.aggregate({ where: { metodo: MetodoPago.EFECTIVO, anuladaEl: null }, _sum: { total: true } }),
    tx.ingresoEfectivoTienda.aggregate({ _sum: { importe: true } }),
  ]);
  return aCentimos(vendido._sum.total ?? 0) - aCentimos(ingresado._sum.importe ?? 0);
}

export class CajaService {
  /** Las últimas ventas en mano, los últimos ingresos en el banco y el efectivo que queda por ingresar. */
  static async estado() {
    const [ventas, ingresos, pendiente] = await Promise.all([
      db.cajaVenta.findMany({
        include: { lineas: true, sesion: { select: { cerradaEl: true } } },
        orderBy: [{ vendidaEl: 'desc' }, { id: 'desc' }], take: VENTAS_A_LA_VISTA,
      }),
      db.ingresoEfectivoTienda.findMany({ orderBy: [{ fecha: 'desc' }, { id: 'desc' }], take: INGRESOS_A_LA_VISTA }),
      efectivoPorIngresar(),
    ]);
    return {
      efectivoPorIngresar: pendiente / 100,
      ventas: ventas.map((v) => ({
        id: v.id, total: Number(v.total), metodo: v.metodo, vendidaEl: v.vendidaEl, vendedor: v.vendedor,
        anuladaEl: v.anuladaEl, anuladaPor: v.anuladaPor,
        // Las de una caja ya cerrada estaban contadas en su arqueo: no se tocan.
        anulable: v.anuladaEl === null && !v.sesion?.cerradaEl,
        lineas: v.lineas.map((l) => ({ productoId: l.productoId, nombre: l.nombre, talla: l.nombreTalla, precio: Number(l.precio), cantidad: l.cantidad })),
      })),
      ingresos: ingresos.map((i) => ({ id: i.id, fecha: diaMadrid(i.fecha), importe: Number(i.importe), nota: i.nota, apuntadoPor: i.apuntadoPor })),
    };
  }

  /** Apunta una venta en mano: existencias, contabilidad y venta, todo o nada. */
  static async vender(lineas: LineaDeCaja[], metodo: MetodoDeCaja, meta: MetaDeAuditoria) {
    const vendedor = await nombreDe(meta);
    const categoriaId = await idCategoriaDeRecibos(TipoTransaccion.INGRESO, CATEGORIA_TIENDA);
    const venta = await db.$transaction(async (tx) => {
      const ids = lineas.flatMap((l) => ('productoId' in l ? [l.productoId] : []));
      const catalogo = await tx.producto.findMany({ where: { id: { in: ids } }, include: conTallas });
      const preparada = prepararVenta(lineas, catalogo.map(aLaVenta));
      if ('problema' in preparada) throw new HttpError(preparada.problema, 409);

      for (const l of preparada.lineas) {
        if (l.productoId === null) continue;
        // Condicionado, como en la tienda en línea: con el último en dos
        // sitios, solo uno se lo lleva. Con talla, se descuenta de la talla.
        const hay = { OR: [{ existencias: null }, { existencias: { gte: l.cantidad } }] };
        const quitado = l.tallaId !== null
          ? await tx.tallaProducto.updateMany({ where: { id: l.tallaId, ...hay }, data: { existencias: { decrement: l.cantidad } } })
          : await tx.producto.updateMany({ where: { id: l.productoId, ...hay }, data: { existencias: { decrement: l.cantidad } } });
        if (quitado.count === 0) throw new HttpError(`«${nombreConTalla(l.nombre, l.talla)}» se acaba de agotar.`, 409);
      }
      const creada = await tx.cajaVenta.create({
        data: {
          total: aEuros(preparada.centimos), metodo: metodo as MetodoPago, vendedor,
          lineas: { create: preparada.lineas.map((l) => ({ productoId: l.productoId, tallaId: l.tallaId, nombre: l.nombre, nombreTalla: l.talla, precio: aEuros(l.centimos), cantidad: l.cantidad })) },
        },
      });
      const apunte = await tx.transaccion.create({
        data: {
          tipo: TipoTransaccion.INGRESO, categoriaId, concepto: `Tienda, venta en mano n.º ${creada.id}`,
          importe: aEuros(preparada.centimos), fecha: new Date(), metodoPago: metodo as MetodoPago,
        },
      });
      return tx.cajaVenta.update({ where: { id: creada.id }, data: { transaccionId: apunte.id } });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.CAJA_VENDER, meta, 'cajaVenta', venta.id, { despues: { total: venta.total.toString(), metodo } });
    return { ventaId: venta.id, total: Number(venta.total), estado: await CajaService.estado() };
  }

  /** Deshace una venta en mano: vuelven las existencias y se quita el apunte. */
  static async anular(ventaId: number, meta: MetaDeAuditoria) {
    const anuladaPor = await nombreDe(meta);
    // Serializable: lo que queda por ingresar es una suma de filas que otro
    // puede estar cambiando; sin aislamiento, dos operaciones a la vez lo
    // dejaban en negativo (y la partida doble pasaba de más de Caja a Bancos).
    const venta = await transactionWithRetry(async (tx) => {
      const v = await tx.cajaVenta.findUnique({ where: { id: ventaId }, include: { lineas: true, sesion: { select: { cerradaEl: true } } } });
      if (!v) throw new NotFoundError('Esa venta no existe.');
      if (v.anuladaEl) throw new HttpError('Esa venta ya estaba anulada.', 409);
      if (v.sesion?.cerradaEl) throw new HttpError('Esa venta es de una caja ya cerrada: corrígela con un apunte en Contabilidad.', 409);
      // Si ese efectivo ya consta llevado al banco, quitar la venta dejaría
      // ingresado más de lo vendido: primero hay que corregir el ingreso.
      if (v.metodo === MetodoPago.EFECTIVO && (await efectivoPorIngresar(tx)) < aCentimos(v.total)) {
        throw new HttpError('Ese efectivo ya consta ingresado en el banco. Borra antes el ingreso que lo incluye y vuelve a apuntarlo sin esta venta.', 409);
      }
      for (const l of v.lineas) {
        if (l.productoId === null) continue;
        // Sin límite (null) se queda sin límite: `increment` sobre null deja
        // null. Con talla, vuelve a su talla (si aún existe).
        if (l.tallaId !== null) await tx.tallaProducto.updateMany({ where: { id: l.tallaId, existencias: { not: null } }, data: { existencias: { increment: l.cantidad } } });
        else await tx.producto.updateMany({ where: { id: l.productoId, existencias: { not: null } }, data: { existencias: { increment: l.cantidad } } });
      }
      if (v.transaccionId !== null) await tx.transaccion.deleteMany({ where: { id: v.transaccionId } });
      return tx.cajaVenta.update({ where: { id: ventaId }, data: { anuladaEl: new Date(), anuladaPor, transaccionId: null } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await AuditoriaService.log(ACCIONES_AUDITORIA.CAJA_ANULAR, meta, 'cajaVenta', ventaId, { antes: { total: venta.total.toString(), metodo: venta.metodo } });
    return CajaService.estado();
  }

  /**
   * Apunta el efectivo llevado al banco. No puede pasar de lo que queda por
   * ingresar: si se ingresa a la vez dinero de otra cosa, aquí va solo lo de la tienda.
   */
  static async ingresar(fecha: string, importe: number, nota: string | null, meta: MetaDeAuditoria) {
    const apuntadoPor = await nombreDe(meta);
    const centimos = Math.round(importe * 100);
    if (fecha > diaMadrid(new Date())) throw new HttpError('La fecha del ingreso no puede ser futura.');
    // Serializable, como al anular: dos ingresos a la vez de los últimos 50 €
    // leían los dos que quedaban 50 y apuntaban 100.
    const ingreso = await transactionWithRetry(async (tx) => {
      const pendiente = await efectivoPorIngresar(tx);
      if (centimos > pendiente) {
        throw new HttpError(pendiente <= 0
          ? 'No queda efectivo de la tienda por ingresar.'
          : `Solo quedan ${eurosDeCentimos(pendiente)} de la tienda por ingresar. Si llevas también dinero de otra cosa, apunta aquí solo lo de la tienda.`, 409);
      }
      return tx.ingresoEfectivoTienda.create({ data: { fecha: inicioDiaMadrid(fecha), importe: aEuros(centimos), nota: nota?.trim() || null, apuntadoPor } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await AuditoriaService.log(ACCIONES_AUDITORIA.TIENDA_INGRESO_BANCO, meta, 'ingresoEfectivoTienda', ingreso.id, { despues: { fecha, importe } });
    return CajaService.estado();
  }

  /** Quita un ingreso apuntado por error: ese efectivo vuelve a quedar por ingresar. */
  static async borrarIngreso(id: number, meta: MetaDeAuditoria) {
    const ingreso = await db.ingresoEfectivoTienda.findUnique({ where: { id } });
    if (!ingreso) throw new NotFoundError('Ese ingreso no existe.');
    await db.ingresoEfectivoTienda.delete({ where: { id } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.TIENDA_INGRESO_BORRAR, meta, 'ingresoEfectivoTienda', id, { antes: { fecha: diaMadrid(ingreso.fecha), importe: Number(ingreso.importe) } });
    return CajaService.estado();
  }
}
