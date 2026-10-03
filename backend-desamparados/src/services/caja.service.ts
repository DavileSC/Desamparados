/**
 * La caja de la tienda: lo que se vende en persona, con su apertura y su
 * cierre del día.
 *
 * Solo hay una caja abierta a la vez. Cada venta descuenta existencias y
 * apunta su ingreso en la contabilidad en el acto, en la categoría de la
 * tienda en línea (el efectivo va a Caja y la tarjeta o el Bizum a Bancos en
 * la partida doble, por el método). Anular una venta solo se puede con la
 * caja abierta: después ya está contada y se corrige con un apunte a mano.
 */
import { MetodoPago, Prisma, TipoTransaccion } from '@prisma/client';
import db from '../config/db.js';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { idCategoriaDeRecibos } from './recibos/comunes.js';
import { CATEGORIA_TIENDA, aLaVenta, conTallas } from './tienda.service.js';
import { aCentimos } from '../domain/sepa.js';
import { prepararVenta, resumenDeCaja, type LineaDeCaja, type MetodoDeCaja } from '../domain/caja.js';
import { nombreConTalla } from '../domain/tienda.js';


const aEuros = (centimos: number) => new Prisma.Decimal(centimos).div(100);

async function nombreDe(meta: MetaDeAuditoria) {
  if (!meta.userId) return null;
  const u = await db.user.findUnique({ where: { id: meta.userId }, select: { nombre: true, apellidos: true } });
  return u ? `${u.nombre} ${u.apellidos ?? ''}`.trim().slice(0, 120) : null;
}

const conVentas = { ventas: { include: { lineas: true }, orderBy: [{ vendidaEl: 'desc' as const }, { id: 'desc' as const }] } };
type SesionConVentas = Prisma.CajaSesionGetPayload<{ include: typeof conVentas }>;

/** La sesión como la ve la pantalla: sus ventas y sus cuentas, en euros. */
function aVista(s: SesionConVentas) {
  const resumen = resumenDeCaja(aCentimos(s.fondoInicial), s.ventas.map((v) => ({ metodo: v.metodo, centimos: aCentimos(v.total), anulada: v.anuladaEl !== null })));
  return {
    id: s.id,
    abiertaEl: s.abiertaEl, abiertaPor: s.abiertaPor, fondoInicial: Number(s.fondoInicial),
    cerradaEl: s.cerradaEl, cerradaPor: s.cerradaPor,
    efectivoEsperado: s.efectivoEsperado === null ? resumen.efectivoEsperado / 100 : Number(s.efectivoEsperado),
    efectivoContado: s.efectivoContado === null ? null : Number(s.efectivoContado),
    observaciones: s.observaciones,
    resumen: {
      ventas: resumen.ventas, anuladas: resumen.anuladas, total: resumen.total / 100,
      porMetodo: { EFECTIVO: resumen.porMetodo.EFECTIVO / 100, TARJETA: resumen.porMetodo.TARJETA / 100, BIZUM: resumen.porMetodo.BIZUM / 100 },
    },
    ventas: s.ventas.map((v) => ({
      id: v.id, total: Number(v.total), metodo: v.metodo, vendidaEl: v.vendidaEl, vendedor: v.vendedor,
      anuladaEl: v.anuladaEl, anuladaPor: v.anuladaPor,
      lineas: v.lineas.map((l) => ({ productoId: l.productoId, nombre: l.nombre, talla: l.nombreTalla, precio: Number(l.precio), cantidad: l.cantidad })),
    })),
  };
}

export type VistaDeCaja = ReturnType<typeof aVista>;

export class CajaService {
  /** La caja abierta (o null) y las últimas cerradas. */
  static async estado() {
    const [abierta, cerradas] = await Promise.all([
      db.cajaSesion.findFirst({ where: { cerradaEl: null }, include: conVentas, orderBy: { id: 'desc' } }),
      db.cajaSesion.findMany({ where: { cerradaEl: { not: null } }, include: conVentas, orderBy: [{ cerradaEl: 'desc' }, { id: 'desc' }], take: 20 }),
    ]);
    return {
      abierta: abierta ? aVista(abierta) : null,
      cerradas: cerradas.map((s) => {
        const v = aVista(s);
        // En el historial, las cuentas; las ventas una a una solo de la abierta.
        return { ...v, ventas: [] };
      }),
    };
  }

  static async abrir(fondoInicial: number, meta: MetaDeAuditoria) {
    const abiertaPor = await nombreDe(meta);
    const sesion = await db.$transaction(async (tx) => {
      const ya = await tx.cajaSesion.findFirst({ where: { cerradaEl: null }, select: { id: true } });
      if (ya) throw new HttpError('Ya hay una caja abierta: ciérrala antes de abrir otra.', 409);
      return tx.cajaSesion.create({ data: { fondoInicial: aEuros(Math.round(fondoInicial * 100)), abiertaPor } });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.CAJA_ABRIR, meta, 'cajaSesion', sesion.id, { despues: { fondoInicial } });
    return CajaService.estado();
  }

  /** Cobra una venta en la caja abierta: existencias, contabilidad y venta, todo o nada. */
  static async vender(lineas: LineaDeCaja[], metodo: MetodoDeCaja, meta: MetaDeAuditoria) {
    const vendedor = await nombreDe(meta);
    const categoriaId = await idCategoriaDeRecibos(TipoTransaccion.INGRESO, CATEGORIA_TIENDA);
    const venta = await db.$transaction(async (tx) => {
      const sesion = await tx.cajaSesion.findFirst({ where: { cerradaEl: null }, select: { id: true } });
      if (!sesion) throw new HttpError('La caja está cerrada: ábrela para vender.', 409);
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
          sesionId: sesion.id, total: aEuros(preparada.centimos), metodo: metodo as MetodoPago, vendedor,
          lineas: { create: preparada.lineas.map((l) => ({ productoId: l.productoId, tallaId: l.tallaId, nombre: l.nombre, nombreTalla: l.talla, precio: aEuros(l.centimos), cantidad: l.cantidad })) },
        },
      });
      const apunte = await tx.transaccion.create({
        data: {
          tipo: TipoTransaccion.INGRESO, categoriaId, concepto: `Caja de la tienda: venta n.º ${creada.id}`,
          importe: aEuros(preparada.centimos), fecha: new Date(), metodoPago: metodo as MetodoPago,
        },
      });
      return tx.cajaVenta.update({ where: { id: creada.id }, data: { transaccionId: apunte.id } });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.CAJA_VENDER, meta, 'cajaVenta', venta.id, { despues: { total: venta.total.toString(), metodo } });
    return { ventaId: venta.id, total: Number(venta.total), estado: await CajaService.estado() };
  }

  /** Deshace una venta de la caja abierta: vuelven las existencias y se quita el apunte. */
  static async anular(ventaId: number, meta: MetaDeAuditoria) {
    const anuladaPor = await nombreDe(meta);
    const venta = await db.$transaction(async (tx) => {
      const v = await tx.cajaVenta.findUnique({ where: { id: ventaId }, include: { lineas: true, sesion: { select: { cerradaEl: true } } } });
      if (!v) throw new NotFoundError('Esa venta no existe.');
      if (v.anuladaEl) throw new HttpError('Esa venta ya estaba anulada.', 409);
      if (v.sesion.cerradaEl) throw new HttpError('La caja de esa venta ya está cerrada: corrígela con un apunte en Contabilidad.', 409);
      for (const l of v.lineas) {
        if (l.productoId === null) continue;
        // Sin límite (null) se queda sin límite: `increment` sobre null deja
        // null. Con talla, vuelve a su talla (si aún existe).
        if (l.tallaId !== null) await tx.tallaProducto.updateMany({ where: { id: l.tallaId, existencias: { not: null } }, data: { existencias: { increment: l.cantidad } } });
        else await tx.producto.updateMany({ where: { id: l.productoId, existencias: { not: null } }, data: { existencias: { increment: l.cantidad } } });
      }
      if (v.transaccionId !== null) await tx.transaccion.deleteMany({ where: { id: v.transaccionId } });
      return tx.cajaVenta.update({ where: { id: ventaId }, data: { anuladaEl: new Date(), anuladaPor, transaccionId: null } });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.CAJA_ANULAR, meta, 'cajaVenta', ventaId, { antes: { total: venta.total.toString(), metodo: venta.metodo } });
    return CajaService.estado();
  }

  /** Cierra la caja con el efectivo contado: queda escrito lo que debía haber y la diferencia. */
  static async cerrar(efectivoContado: number, observaciones: string | null, meta: MetaDeAuditoria) {
    const cerradaPor = await nombreDe(meta);
    const sesion = await db.$transaction(async (tx) => {
      const s = await tx.cajaSesion.findFirst({ where: { cerradaEl: null }, include: conVentas });
      if (!s) throw new HttpError('No hay ninguna caja abierta.', 409);
      const esperado = aVista(s).efectivoEsperado;
      const { count } = await tx.cajaSesion.updateMany({
        where: { id: s.id, cerradaEl: null },
        data: {
          cerradaEl: new Date(), cerradaPor,
          efectivoEsperado: aEuros(Math.round(esperado * 100)), efectivoContado: aEuros(Math.round(efectivoContado * 100)),
          observaciones: observaciones?.trim() || null,
        },
      });
      if (count === 0) throw new HttpError('Otra persona acaba de cerrar la caja.', 409);
      return { id: s.id, esperado };
    });
    const diferencia = Math.round((efectivoContado - sesion.esperado) * 100) / 100;
    await AuditoriaService.log(ACCIONES_AUDITORIA.CAJA_CERRAR, meta, 'cajaSesion', sesion.id, { despues: { esperado: sesion.esperado, contado: efectivoContado, diferencia } });
    return { diferencia, estado: await CajaService.estado() };
  }
}
