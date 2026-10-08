/**
 * La lotería del Grupo: los sorteos, sus talonarios y lo que se apunta en la
 * contabilidad.
 *
 * Dos apuntes, y los dos salen solos de aquí (en Contabilidad no se pueden
 * tocar a mano, ver `TransaccionService.apunteManual`):
 * · la compra de los décimos, un gasto («Compra de lotería» → 600);
 * · la liquidación de cada talonario, un ingreso con lo vendido («Lotería y
 *   rifas» → 722). La partida doble los recoge como cualquier otro apunte.
 *
 * Lo que va impreso en las participaciones (números, precio, lo que juega,
 * cuántas por talonario) no se cambia en cuanto hay talonarios: los ya
 * impresos dirían otra cosa. Tampoco lo que da el importe de la compra
 * mientras esté apuntada.
 */
import { MetodoPago, Prisma, TipoTransaccion, type SorteoLoteria, type TalonarioLoteria } from '@prisma/client';
import db from '../../config/db.js';
import { HttpError, NotFoundError } from '../../utils/error.handle.js';
import { aCentimos } from '../../domain/sepa.js';
import {
  maximoDeParticipaciones, numerosDe, participacionesDelTalonario, premioPorParticipacion, type Reparto,
} from '../../domain/loteria.js';
import { idCategoriaDeRecibos } from '../recibos/comunes.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from '../auditoria.service.js';
import { participacionesEnPdf } from './participaciones-pdf.js';

export const CATEGORIA_VENTA = 'Lotería y rifas';
export const CATEGORIA_COMPRA = 'Compra de lotería';
/** Las participaciones de un PDF: más, y el servidor pequeño se queda sin memoria. */
export const MAX_PARTICIPACIONES_PDF = 2000;
export const MAX_TALONARIOS_DE_UNA_VEZ = 500;

export interface DatosSorteo {
  nombre: string;
  fecha: string;
  numeros: string[];
  precioDecimo: number;
  decimos: number;
  precioParticipacion: number;
  jugado: number;
  porTalonario: number;
  leyenda: string;
}

export interface Entrega {
  desde: number;
  hasta: number;
  responsable: string | null;
  telefono: string | null;
}

const aEuros = (centimos: number) => new Prisma.Decimal(centimos).div(100);
const dia = (d: Date) => d.toISOString().slice(0, 10);

/** El sorteo en céntimos, para las cuentas de domain/loteria.ts. */
type ConReparto = Pick<SorteoLoteria, 'decimos' | 'precioDecimo' | 'precioParticipacion' | 'jugado' | 'porTalonario'> & { numeros: unknown };

function repartoDe(s: ConReparto): Reparto {
  return {
    numeros: numerosDe(s.numeros), decimos: s.decimos, precioDecimo: aCentimos(s.precioDecimo),
    precioParticipacion: aCentimos(s.precioParticipacion), jugado: aCentimos(s.jugado), porTalonario: s.porTalonario,
  };
}

function talonarioParaElCms(t: TalonarioLoteria, s: SorteoLoteria) {
  const { desde, hasta } = participacionesDelTalonario(t.numero, s.porTalonario);
  return {
    id: t.id, numero: t.numero, desde, hasta, responsable: t.responsable, telefono: t.telefono, entregadoEl: t.entregadoEl,
    vendidas: t.vendidas, metodoPago: t.metodoPago, liquidadoEl: t.liquidadoEl,
    importe: t.vendidas === null ? null : (t.vendidas * aCentimos(s.precioParticipacion)) / 100,
  };
}

async function resumen(s: SorteoLoteria & { talonarios: TalonarioLoteria[]; compra: { importe: Prisma.Decimal; fecha: Date; metodoPago: MetodoPago | null } | null }) {
  const r = repartoDe(s);
  const liquidados = s.talonarios.filter((t) => t.liquidadoEl);
  const vendidas = liquidados.reduce((n, t) => n + (t.vendidas ?? 0), 0);
  const premio = premioPorParticipacion(r);
  return {
    id: s.id, nombre: s.nombre, fecha: dia(s.fecha),
    numeros: r.numeros.map((n) => ({ numero: n.numero, premio: n.premio === null ? null : n.premio / 100 })),
    precioDecimo: r.precioDecimo / 100, decimos: s.decimos, precioParticipacion: r.precioParticipacion / 100, jugado: r.jugado / 100,
    porTalonario: s.porTalonario, leyenda: s.leyenda,
    compra: s.compra ? { importe: Number(s.compra.importe), fecha: dia(s.compra.fecha), metodoPago: s.compra.metodoPago } : null,
    maximoDeParticipaciones: maximoDeParticipaciones(r),
    talonarios: s.talonarios.length,
    entregados: s.talonarios.filter((t) => t.responsable && !t.liquidadoEl).length,
    liquidados: liquidados.length,
    vendidas,
    recaudado: (vendidas * r.precioParticipacion) / 100,
    premioPorParticipacion: premio / 100,
    premiosVendidos: (premio * vendidas) / 100,
  };
}

const conTodo = { talonarios: { orderBy: { numero: 'asc' } }, compra: { select: { importe: true, fecha: true, metodoPago: true } } } as const;

async function sorteoOError(id: number) {
  const s = await db.sorteoLoteria.findUnique({ where: { id }, include: conTodo });
  if (!s) throw new NotFoundError('Ese sorteo ya no existe.');
  return s;
}

function exigirRepartoPosible(r: Reparto, talonarios: number) {
  if (r.jugado > r.precioParticipacion) throw new HttpError('Una participación no puede jugar más de lo que cuesta.');
  if (talonarios * r.porTalonario > maximoDeParticipaciones(r)) {
    throw new HttpError(`Con esos décimos solo caben ${maximoDeParticipaciones(r)} participaciones, y hay ${talonarios * r.porTalonario} en talonarios.`, 409);
  }
}

function datosDeSorteo(d: DatosSorteo, premios: (number | null)[] = []) {
  if (new Set(d.numeros).size !== d.numeros.length) throw new HttpError('Hay un número repetido.');
  return {
  nombre: d.nombre.trim(), fecha: new Date(`${d.fecha}T00:00:00Z`),
  numeros: d.numeros.map((numero, i) => ({ numero, premio: premios[i] ?? null })),
  precioDecimo: aEuros(aCentimos(d.precioDecimo)), decimos: d.decimos,
  precioParticipacion: aEuros(aCentimos(d.precioParticipacion)), jugado: aEuros(aCentimos(d.jugado)),
    porTalonario: d.porTalonario, leyenda: d.leyenda.trim(),
  };
}

export class LoteriaService {
  static async sorteos() {
    const lista = await db.sorteoLoteria.findMany({ include: conTodo, orderBy: [{ fecha: 'desc' }, { id: 'desc' }] });
    return Promise.all(lista.map(resumen));
  }

  static async sorteo(id: number) {
    const s = await sorteoOError(id);
    return { ...(await resumen(s)), lista: s.talonarios.map((t) => talonarioParaElCms(t, s)) };
  }

  static async crear(d: DatosSorteo) {
    const datos = datosDeSorteo(d);
    exigirRepartoPosible(repartoDe(datos), 0);
    const s = await db.sorteoLoteria.create({ data: datos });
    return this.sorteo(s.id);
  }

  static async actualizar(id: number, d: DatosSorteo) {
    const antes = await sorteoOError(id);
    const r0 = repartoDe(antes);
    // Los premios se quedan con su número aunque se reordenen los números.
    const premios = d.numeros.map((n) => r0.numeros.find((x) => x.numero === n)?.premio ?? null);
    const datos = datosDeSorteo(d, premios);
    const r1 = repartoDe(datos);
    const mismosNumeros = r0.numeros.map((n) => n.numero).join() === r1.numeros.map((n) => n.numero).join();
    if (antes.talonarios.length > 0 && (!mismosNumeros || r0.precioParticipacion !== r1.precioParticipacion || r0.jugado !== r1.jugado || r0.porTalonario !== r1.porTalonario)) {
      throw new HttpError('Ya hay talonarios: los números, el precio, lo que juega cada participación y cuántas lleva cada talonario ya no se pueden cambiar.', 409);
    }
    if (antes.compraId !== null && (!mismosNumeros || r0.decimos !== r1.decimos || r0.precioDecimo !== r1.precioDecimo)) {
      throw new HttpError('La compra de los décimos ya está apuntada: deshazla antes de cambiar los números, los décimos o su precio.', 409);
    }
    exigirRepartoPosible(r1, antes.talonarios.length);
    await db.sorteoLoteria.update({ where: { id }, data: datos });
    return this.sorteo(id);
  }

  /** Lo que gana un décimo de cada número (en euros, o null si no tocó o no se sabe), en el orden de los números. */
  static async premios(id: number, premios: (number | null)[], meta: MetaDeAuditoria) {
    const s = await sorteoOError(id);
    const numeros = numerosDe(s.numeros);
    if (premios.length !== numeros.length) throw new HttpError('Hace falta un premio (o ninguno) por cada número.');
    await db.sorteoLoteria.update({
      where: { id },
      data: { numeros: numeros.map((n, i) => ({ numero: n.numero, premio: premios[i] === null ? null : aCentimos(premios[i]!) })) },
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.LOTERIA_PREMIOS, meta, 'sorteoLoteria', id, { premios });
    return this.sorteo(id);
  }

  /** Solo sin nada apuntado ni repartido: si no, se perdería el rastro del dinero. */
  static async borrar(id: number) {
    const s = await sorteoOError(id);
    if (s.compraId !== null || s.talonarios.some((t) => t.responsable || t.liquidadoEl)) {
      throw new HttpError('Este sorteo ya tiene la compra apuntada o talonarios repartidos: no se puede borrar.', 409);
    }
    await db.sorteoLoteria.delete({ where: { id } });
    return { message: 'Sorteo borrado.' };
  }

  // --- La compra de los décimos ---

  static async apuntarCompra(id: number, metodoPago: MetodoPago, meta: MetaDeAuditoria) {
    const categoriaId = await idCategoriaDeRecibos(TipoTransaccion.GASTO, CATEGORIA_COMPRA);
    const s = await sorteoOError(id);
    const r = repartoDe(s);
    const total = r.numeros.length * r.decimos * r.precioDecimo;
    await db.$transaction(async (tx) => {
      const apunte = await tx.transaccion.create({
        data: {
          tipo: TipoTransaccion.GASTO, categoriaId, importe: aEuros(total), metodoPago, fecha: new Date(),
          concepto: `${s.nombre}: compra de ${r.numeros.length * r.decimos} décimos (${r.numeros.map((n) => n.numero).join(', ')})`.slice(0, 191),
        },
      });
      // Condicionado: con dos clics a la vez, solo uno apunta la compra.
      const { count } = await tx.sorteoLoteria.updateMany({ where: { id, compraId: null }, data: { compraId: apunte.id } });
      if (count !== 1) throw new HttpError('La compra de este sorteo ya estaba apuntada.', 409);
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.LOTERIA_COMPRA, meta, 'sorteoLoteria', id, { importe: total / 100, metodoPago });
    return this.sorteo(id);
  }

  static async deshacerCompra(id: number, meta: MetaDeAuditoria) {
    const s = await sorteoOError(id);
    if (s.compraId === null) throw new HttpError('La compra de este sorteo no está apuntada.', 409);
    const compraId = s.compraId;
    await db.$transaction(async (tx) => {
      // Condicionado a la compra que se leyó: si entre tanto otro la deshizo
      // (y quizá la volvió a apuntar), esto no se lleva por delante la nueva.
      const { count } = await tx.sorteoLoteria.updateMany({ where: { id, compraId }, data: { compraId: null } });
      if (count !== 1) throw new HttpError('La compra de este sorteo ha cambiado mientras tanto. Recarga la página.', 409);
      await tx.transaccion.delete({ where: { id: compraId } });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.LOTERIA_COMPRA_DESHACER, meta, 'sorteoLoteria', id);
    return this.sorteo(id);
  }

  // --- Los talonarios ---

  /** Añade `cantidad` talonarios a continuación del último. */
  static async crearTalonarios(id: number, cantidad: number) {
    const s = await sorteoOError(id);
    exigirRepartoPosible(repartoDe(s), s.talonarios.length + cantidad);
    const ultimo = s.talonarios.at(-1)?.numero ?? 0;
    await db.talonarioLoteria.createMany({ data: Array.from({ length: cantidad }, (_, i) => ({ sorteoId: id, numero: ultimo + i + 1 })) });
    return this.sorteo(id);
  }

  /** Solo el último y sin repartir: así la numeración no se queda con huecos. */
  static async borrarTalonario(talonarioId: number) {
    const t = await db.talonarioLoteria.findUnique({ where: { id: talonarioId } });
    if (!t) throw new NotFoundError('Ese talonario ya no existe.');
    const ultimo = await db.talonarioLoteria.findFirst({ where: { sorteoId: t.sorteoId }, orderBy: { numero: 'desc' } });
    if (ultimo?.id !== t.id || t.responsable || t.liquidadoEl) throw new HttpError('Solo se puede quitar el último talonario, y si no se ha dado a nadie.', 409);
    await db.talonarioLoteria.delete({ where: { id: talonarioId } });
    return this.sorteo(t.sorteoId);
  }

  /**
   * Da los talonarios del `desde` al `hasta` a alguien (o los recoge, con
   * responsable null). Los ya liquidados no se tocan: son cuentas cerradas.
   */
  static async entregar(id: number, e: Entrega, meta: MetaDeAuditoria) {
    await sorteoOError(id);
    const responsable = e.responsable?.trim() || null;
    const where = { sorteoId: id, numero: { gte: e.desde, lte: e.hasta }, liquidadoEl: null };
    const { count } = await db.talonarioLoteria.updateMany({
      where,
      data: responsable
        ? { responsable, telefono: e.telefono?.trim() || null, entregadoEl: new Date() }
        : { responsable: null, telefono: null, entregadoEl: null },
    });
    if (count === 0) throw new HttpError('En ese tramo no hay talonarios sin liquidar.', 409);
    await AuditoriaService.log(ACCIONES_AUDITORIA.LOTERIA_ENTREGA, meta, 'sorteoLoteria', id, { desde: e.desde, hasta: e.hasta, responsable, talonarios: count });
    return this.sorteo(id);
  }

  /** Cierra un talonario: las vendidas se cobran y se apuntan; las demás vuelven a Secretaría. */
  static async liquidar(talonarioId: number, vendidas: number, metodoPago: MetodoPago | null, meta: MetaDeAuditoria) {
    const t = await db.talonarioLoteria.findUnique({ where: { id: talonarioId }, include: { sorteo: true } });
    if (!t) throw new NotFoundError('Ese talonario ya no existe.');
    if (vendidas > t.sorteo.porTalonario) throw new HttpError(`El talonario tiene ${t.sorteo.porTalonario} participaciones.`);
    if (vendidas > 0 && !metodoPago) throw new HttpError('Di cómo se ha pagado lo vendido.');
    const importe = vendidas * aCentimos(t.sorteo.precioParticipacion);
    const categoriaId = importe > 0 ? await idCategoriaDeRecibos(TipoTransaccion.INGRESO, CATEGORIA_VENTA) : null;
    await db.$transaction(async (tx) => {
      const apunte = categoriaId === null ? null : await tx.transaccion.create({
        data: {
          tipo: TipoTransaccion.INGRESO, categoriaId, importe: aEuros(importe), metodoPago, fecha: new Date(),
          concepto: `${t.sorteo.nombre}: talonario n.º ${t.numero}, ${vendidas} vendidas${t.responsable ? ` (${t.responsable})` : ''}`.slice(0, 191),
        },
      });
      const { count } = await tx.talonarioLoteria.updateMany({
        where: { id: talonarioId, liquidadoEl: null },
        data: { vendidas, metodoPago: vendidas > 0 ? metodoPago : null, liquidadoEl: new Date(), transaccionId: apunte?.id ?? null },
      });
      if (count !== 1) throw new HttpError('Este talonario ya estaba liquidado.', 409);
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.LOTERIA_LIQUIDAR, meta, 'talonarioLoteria', talonarioId, { numero: t.numero, vendidas, importe: importe / 100, metodoPago });
    return this.sorteo(t.sorteoId);
  }

  /** Para corregir una liquidación mal hecha: quita el ingreso y el talonario vuelve a estar en la calle. */
  static async deshacerLiquidacion(talonarioId: number, meta: MetaDeAuditoria) {
    const t = await db.talonarioLoteria.findUnique({ where: { id: talonarioId } });
    if (!t) throw new NotFoundError('Ese talonario ya no existe.');
    if (!t.liquidadoEl) throw new HttpError('Este talonario no está liquidado.', 409);
    await db.$transaction(async (tx) => {
      // Condicionado a la liquidación que se leyó: si entre tanto otro la
      // deshizo y se volvió a liquidar, esto no borra la nueva ni deja su
      // ingreso suelto en la contabilidad.
      const { count } = await tx.talonarioLoteria.updateMany({
        where: { id: talonarioId, liquidadoEl: t.liquidadoEl, transaccionId: t.transaccionId },
        data: { vendidas: null, metodoPago: null, liquidadoEl: null, transaccionId: null },
      });
      if (count !== 1) throw new HttpError('La liquidación de este talonario ha cambiado mientras tanto. Recarga la página.', 409);
      if (t.transaccionId !== null) await tx.transaccion.deleteMany({ where: { id: t.transaccionId } });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.LOTERIA_LIQUIDAR_DESHACER, meta, 'talonarioLoteria', talonarioId, { numero: t.numero, vendidas: t.vendidas });
    return this.sorteo(t.sorteoId);
  }

  /** Las participaciones para imprimir, de los talonarios `desde` a `hasta`. */
  static async pdf(id: number, desde: number, hasta: number) {
    const s = await sorteoOError(id);
    const talonarios = s.talonarios.filter((t) => t.numero >= desde && t.numero <= hasta).map((t) => t.numero);
    if (talonarios.length === 0) throw new NotFoundError('En ese tramo no hay talonarios.');
    if (talonarios.length * s.porTalonario > MAX_PARTICIPACIONES_PDF) {
      throw new HttpError(`Son demasiadas de una vez: imprime como mucho ${Math.floor(MAX_PARTICIPACIONES_PDF / s.porTalonario)} talonarios por archivo.`);
    }
    return participacionesEnPdf({ ...repartoDe(s), nombre: s.nombre, fecha: s.fecha, leyenda: s.leyenda, totalTalonarios: s.talonarios.length }, talonarios);
  }
}
