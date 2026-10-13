/**
 * Lo que comparten las tres puertas de los recibos: la de Tesorería, la del
 * hermano que mira los suyos y la mesa de reparto de la procesión, que emite y
 * devuelve cobros desde su propia transacción.
 *
 * Aquí están las piezas que no son de ninguna en particular: el filtro del
 * listado, la foto que se guarda en la auditoría, las categorías contables de
 * los recibos y los dos pasos que se ejecutan dentro de la transacción de
 * quien llama.
 */
import db from '../../config/db';
import { Cingulo, EstadoCita, EstadoPago, EstadoSolicitud, Prisma, MetodoPago, TipoRecibo, TipoTransaccion } from '@prisma/client';
import { HttpError } from '../../utils/error.handle';
import type { DatosEvento } from '../../domain/datos-procesion.js';
import { anioDeLaSalida, diaMadrid, fechaDeSalida } from '../../domain/fecha-salida.js';
import { reglaDe, type SalidaConActo } from '../procesion/salidas.service.js';
import { palabrasDeBusqueda } from '../../domain/busqueda-texto.js';
import { CATEGORIA_COMISIONES, CATEGORIA_DE_RECIBO, CATEGORIA_DEVOLUCIONES } from '../../domain/contabilidad.js';
import { idsReemitidos } from '../../domain/reemisiones.js';

type Tx = Prisma.TransactionClient;

export const MENSAJE_ESTADO_CAMBIADO = 'El estado del recibo ha cambiado. Recarga la ficha e inténtalo de nuevo.';

// Una cuota en estos estados sigue en pie: impide emitir otra el mismo año.
// EXENTO no está a propósito: la exención es una decisión de la Junta y, si se
// revoca, hay que poder emitirle la cuota (EXENTO es final y no vuelve a
// PENDIENTE). El precio es que Tesorería podría emitírsela por error a un
// exento; se aceptó así en la revisión del 11-09-2026.
export const ESTADOS_CUOTA_VIVA = [EstadoPago.PENDIENTE, EstadoPago.REMESADO, EstadoPago.PAGADO] as const;

/** Lo que se guarda en la auditoría de un recibo: sin objetos Decimal, que no son JSON. */
export function fotoRecibo(r: { estado: EstadoPago; importe: Prisma.Decimal | number; metodoPago?: MetodoPago | null; observaciones?: string | null }) {
  return {
    estado: r.estado,
    importe: String(r.importe),
    metodoPago: r.metodoPago ?? null,
    ...(r.observaciones !== undefined ? { observaciones: r.observaciones } : {})
  };
}

/** Lo que admite el listado de Tesorería, además del año y el estado. */
export interface ConsultaRecibos {
  page?: unknown;
  limit?: unknown;
  /** Hermano (nombre, apellidos o número) o concepto. */
  q?: string;
  tipo?: TipoRecibo;
  orden?: string;
  /** Un recibo concreto, por su número: el enlace desde Contabilidad. */
  recibo?: string;
}

/**
 * Cada palabra en el concepto o en el hermano; un número suelto encuentra
 * además los recibos del hermano con ese número, que es como Tesorería
 * identifica a la gente en la mesa.
 */
function whereBusquedaRecibo(q: string | undefined): Prisma.ReciboWhereInput {
  const palabras = palabrasDeBusqueda(q);
  if (palabras.length === 0) return {};
  const porTexto: Prisma.ReciboWhereInput = {
    AND: palabras.map((p) => ({
      OR: [
        { concepto: { contains: p } },
        { hermano: { is: { nombre: { contains: p } } } },
        { hermano: { is: { apellidos: { contains: p } } } }
      ]
    }))
  };
  const texto = q!.trim();
  return /^\d{1,9}$/.test(texto) ? { OR: [porTexto, { hermano: { is: { numeroHermano: Number(texto) } } }] } : porTexto;
}

/** El filtro del listado de Tesorería; el resumen usa el mismo sin el estado. */
export function whereRecibosAdmin(query: ConsultaRecibos, year?: number, estado?: EstadoPago): Prisma.ReciboWhereInput {
  return {
    ...(year ? { year } : {}),
    ...(estado ? { estado } : {}),
    ...(query.tipo ? { tipo: query.tipo } : {}),
    ...(query.recibo ? { id: Number(query.recibo) } : {}),
    ...whereBusquedaRecibo(query.q)
  };
}

const ZONA = { timeZone: 'Europe/Madrid' } as const;
const formatoDiaLargo = new Intl.DateTimeFormat('es-ES', { ...ZONA, weekday: 'long', day: 'numeric', month: 'long' });
const formatoHora = new Intl.DateTimeFormat('es-ES', { ...ZONA, hour: '2-digit', minute: '2-digit' });
const POR_ANUNCIAR = 'Por anunciar';

/**
 * «19:30h», como sale la hora del acto de la Agenda. El campo de hora del CMS
 * guarda «19:30» y la configuración antigua traía «19:30h»: las dos se
 * imprimen igual. Un texto que no sea una hora se deja como está.
 */
function horaImpresa(hora: string): string {
  const m = /^(\d{1,2}:\d{2})\s*h?$/i.exec(hora);
  return m ? `${m[1]}h` : hora;
}
const EN_SECRETARIA = 'Consultar en secretaría';

/**
 * Fecha, hora y puerta de la salida que se imprimen en la papeleta. Una sola
 * fuente para el cobro en tesorería y la mesa: la fila de la salida. Las de
 * la Pascua calculan su día del año que se prepara y llevan hora y lugar en
 * la fila; las de fecha a mano lo sacan todo del acto de la Agenda que fija
 * Secretaría (ver `SalidasService.fijarFecha`). Lo que falte se dice tal cual:
 * una hora inventada se imprime y ya no se puede corregir.
 *
 * `anio`, el de la papeleta que se imprime: reimprimir una de 2026 en 2027
 * tiene que decir el día de 2026 (o, a mano, «Por anunciar» si el acto
 * enlazado ya es de otro año). Sin él, el año que se prepara.
 */
export function leerDatosEvento(salida: SalidaConActo, anio?: number): DatosEvento {
  if (salida.fecha === 'MANUAL') {
    const { acto } = salida;
    // La fila enlaza solo el acto del último año fijado (`fijarFecha` crea uno
    // por año): reimprimir una papeleta de otro año con él diría un día que no
    // es el suyo, y el suyo ya no se sabe desde aquí.
    const deOtroAnio = acto && anio !== undefined && Number(diaMadrid(acto.startDate).slice(0, 4)) !== anio;
    if (!acto || deOtroAnio) return { fechaSalida: POR_ANUNCIAR, horaSalida: POR_ANUNCIAR, accesoPuerta: EN_SECRETARIA };
    return {
      fechaSalida: formatoDiaLargo.format(acto.startDate),
      horaSalida: horaImpresa(formatoHora.format(acto.startDate)),
      accesoPuerta: acto.location?.trim() || EN_SECRETARIA,
    };
  }
  const regla = reglaDe(salida);
  const dia = fechaDeSalida(regla, anio ?? anioDeLaSalida(regla, diaMadrid(new Date())));
  return {
    // A mediodía UTC, el día es el mismo en Madrid en cualquier época del año.
    fechaSalida: dia ? formatoDiaLargo.format(new Date(`${dia}T12:00:00Z`)) : POR_ANUNCIAR,
    horaSalida: salida.horaSalida?.trim() ? horaImpresa(salida.horaSalida.trim()) : POR_ANUNCIAR,
    accesoPuerta: salida.lugar?.trim() || EN_SECRETARIA,
  };
}

// =================================================================
//  1. GENERACIÓN MASIVA Y EMISIÓN SUELTA (ADMIN)
// =================================================================

/**
 * PAGADO -> DEVUELTO (o REEMBOLSADO) con su asiento de reverso, dentro de la
 * transacción de quien llama. `destino` dice si se sigue debiendo (DEVUELTO, el
 * banco no lo cobró) o si se le devolvió al hermano (REEMBOLSADO): el reverso
 * es el mismo, pero solo el primero es deuda (ver `domain/recibo-estados`).
 * `fecha` es la del asiento: el día en que el banco lo devolvió (la fecha valor
 * del extracto o la que diga Tesorería); con la del clic, una devolución del
 * 30 de diciembre aplicada el 3 de enero caía en el ejercicio siguiente.
 *
 * Es el único camino para retroceder un cobro: lo usan la edición de
 * Tesorería y la anulación de una papeleta en mesa, que antes pasaba el recibo
 * a ANULADO por su cuenta y dejaba el ingreso en contabilidad como si el
 * dinero siguiera en caja.
 *
 * El cambio va condicionado a que siga PAGADO: de dos peticiones a la vez,
 * solo una gana y solo una apunta el reverso.
 *
 * La categoría del reverso llega ya resuelta (`idCategoriaDevoluciones`,
 * fuera de la transacción): ver `idCategoriaDeRecibos`.
 */
export async function devolverCobroEnTransaccion(
  tx: Tx,
  recibo: { id: number; importe: Prisma.Decimal; metodoPago: MetodoPago | null; hermanoId: number },
  categoriaDevolucionesId: number,
  { observaciones, destino = EstadoPago.DEVUELTO, fecha = new Date() }: {
    observaciones?: string;
    destino?: typeof EstadoPago.DEVUELTO | typeof EstadoPago.REEMBOLSADO;
    fecha?: Date;
  } = {}
) {
  const transicion = await tx.recibo.updateMany({
    where: { id: recibo.id, estado: EstadoPago.PAGADO },
    data: { estado: destino, ...(observaciones !== undefined ? { observaciones } : {}) }
  });
  if (transicion.count !== 1) throw new HttpError(MENSAJE_ESTADO_CAMBIADO, 409);

  // El asiento original debe existir antes de registrar un reverso.
  const ingresoOriginal = await tx.transaccion.findFirst({
    where: { reciboId: recibo.id, tipo: TipoTransaccion.INGRESO }
  });
  if (!ingresoOriginal) {
    throw new HttpError('No se puede devolver el recibo porque no tiene asiento contable de ingreso.', 409);
  }

  const conceptoReverso = `Reverso contable recibo #${recibo.id}`;
  const reversoExistente = await tx.transaccion.findFirst({
    where: { reciboId: recibo.id, tipo: TipoTransaccion.GASTO, concepto: conceptoReverso }
  });
  if (reversoExistente) return;

  await tx.transaccion.create({
    data: {
      tipo: TipoTransaccion.GASTO,
      categoriaId: categoriaDevolucionesId,
      concepto: conceptoReverso,
      importe: recibo.importe,
      fecha,
      metodoPago: recibo.metodoPago,
      hermanoId: recibo.hermanoId,
      reciboId: recibo.id
    }
  });
}

/**
 * Deja sin efecto la papeleta de un recibo, si la tiene: cancela su solicitud
 * (si vuelve, pide otra), libera la cita (por si quiere volver otro día) y
 * borra la papeleta, que libera su hueco en la procesión y la clave
 * [hermano, año] para una reinscripción. Lo usan la mesa al anular y Tesorería
 * al devolver o anular el recibo: antes Tesorería dejaba la solicitud RECOGIDA
 * sin papeleta.
 *
 * La ropa no se toca: sigue a su nombre hasta que la devuelva. Las prendas ya
 * van a su nombre; el cíngulo prestado solo constaba en la papeleta, así que
 * pasa a `CinguloSinPapeleta` antes de borrarla.
 * Devuelve la papeleta retirada, o `null` si el recibo no tenía.
 */
export async function retirarPapeletaEnTransaccion(tx: Tx, reciboId: number) {
  const papeleta = await tx.papeletaSitio.findUnique({ where: { reciboId } });
  if (!papeleta) return null;

  if (papeleta.cingulo === Cingulo.PRESTADO) {
    await tx.cinguloSinPapeleta.create({ data: { papeletaId: papeleta.id, hermanoId: papeleta.hermanoId, year: papeleta.year } });
  }
  await tx.solicitud.updateMany({ where: { papeletaId: papeleta.id }, data: { estado: EstadoSolicitud.CANCELADA, citaId: null } });

  if (papeleta.citaId) {
    await tx.cita.updateMany({
      where: { id: papeleta.citaId },
      data: { estado: EstadoCita.CANCELADA }
    });
  }
  await tx.papeletaSitio.delete({ where: { id: papeleta.id } });
  return papeleta;
}

/**
 * Id de una categoría contable de los recibos, creándola la primera vez.
 *
 * Se llama FUERA de la transacción del cobro o la devolución. En MariaDB el
 * `upsert` de Prisma no es atómico (lee y luego inserta): la primera vez que
 * dos cobros o dos devoluciones coinciden, los dos ven la categoría ausente,
 * los dos la insertan y el segundo choca con el índice único [tipo, nombre]
 * (P2002, reproducido con seis a la vez). Dentro de una transacción ese
 * choque tumbaba la operación entera con un «ya existe» que no tenía nada
 * que ver con el recibo, y releer ahí dentro no sirve: la lectura
 * consistente de la transacción no ve la fila que el otro acaba de confirmar.
 * Aquí fuera, el que pierde simplemente relee la que ganó.
 */
export async function idCategoriaDeRecibos(tipo: TipoTransaccion, nombre: string): Promise<number> {
  const clave = { tipo_nombre: { tipo, nombre } };
  try {
    const categoria = await db.categoriaTransaccion.upsert({
      where: clave,
      update: {},
      create: { nombre, tipo }
    });
    return categoria.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const existente = await db.categoriaTransaccion.findUnique({ where: clave, select: { id: true } });
      if (existente) return existente.id;
    }
    throw e;
  }
}

/** Categoría del ingreso de un recibo cobrado, según su tipo (ver `idCategoriaDeRecibos`). */
export function idCategoriaIngresos(tipo: TipoRecibo) {
  return idCategoriaDeRecibos(TipoTransaccion.INGRESO, CATEGORIA_DE_RECIBO[tipo]);
}

/** Categoría de los reversos de recibos devueltos (ver `idCategoriaDeRecibos`). */
export function idCategoriaDevoluciones() {
  return idCategoriaDeRecibos(TipoTransaccion.GASTO, CATEGORIA_DEVOLUCIONES);
}

/** Categoría de la comisión que cobra el banco al devolver un recibo (ver `idCategoriaDeRecibos`). */
export function idCategoriaComisiones() {
  return idCategoriaDeRecibos(TipoTransaccion.GASTO, CATEGORIA_COMISIONES);
}

/**
 * La comisión que cobra el banco por devolver un recibo, como gasto enlazado
 * al recibo, dentro de la transacción de quien llama. Va enlazada para que se
 * vea de dónde sale y para que, como los demás apuntes de recibos, no se
 * toque desde Contabilidad.
 */
export async function apuntarComisionEnTransaccion(
  tx: Tx,
  recibo: { id: number; hermanoId: number; metodoPago: MetodoPago | null },
  importe: number,
  categoriaComisionesId: number,
  fecha: Date = new Date()
) {
  await tx.transaccion.create({
    data: {
      tipo: TipoTransaccion.GASTO,
      categoriaId: categoriaComisionesId,
      concepto: `Comisión del banco por devolver el recibo #${recibo.id}`,
      importe,
      fecha,
      metodoPago: recibo.metodoPago,
      hermanoId: recibo.hermanoId,
      reciboId: recibo.id
    }
  });
}

/**
 * Un devuelto se vuelve a cobrar (o se perdona) emitiendo su reemisión, y eso
 * solo una vez: con una ya emitida, otra cobraría dos veces la misma deuda.
 * Pasó con el pago en línea empezado y la cuota cobrada en la mesa mientras
 * tanto: el aviso del banco emitía «(reemisión 2)» con su ingreso.
 *
 * Va dentro de la transacción de quien cobra, y antes de mirar escribe en la
 * fila del devuelto: dos cobros a la vez del mismo devuelto chocan en esa
 * fila (y el reintento ya ve la reemisión del otro) en vez de emitir dos. Y
 * si aun así se colaran, el índice único de `reemisionDeId` no deja dos.
 */
export async function exigirSinReemision(tx: Tx, r: { id: number; concepto: string }) {
  await tx.recibo.update({ where: { id: r.id }, data: { updatedAt: new Date() } });
  const reemision = await tx.recibo.findUnique({ where: { reemisionDeId: r.id }, select: { id: true } });
  if (reemision) throw new HttpError(MENSAJE_YA_REEMITIDO(r.concepto), 409);
}

export const MENSAJE_YA_REEMITIDO = (concepto: string) => `«${concepto}» ya se volvió a emitir: lo que queda por cobrar es el recibo nuevo. Recarga la ficha.`;

/** De estos devueltos, cuáles ya tienen reemisión (ver `domain/reemisiones`). */
export async function reemitidosDe(devueltos: { id: number }[]): Promise<Set<number>> {
  if (devueltos.length === 0) return new Set();
  const reemisiones = await db.recibo.findMany({
    where: { reemisionDeId: { in: devueltos.map((d) => d.id) } },
    select: { reemisionDeId: true },
  });
  return idsReemitidos(reemisiones);
}

/**
 * Los devueltos que siguen pendientes (sin reemisión), con lo que suman: son
 * dinero por cobrar y lo que Tesorería tiene que reemitir.
 */
export async function devueltosPendientes(where: Prisma.ReciboWhereInput = {}): Promise<{ total: number; importe: number }> {
  const devueltos = await db.recibo.findMany({
    where: { ...where, estado: EstadoPago.DEVUELTO },
    select: { id: true, importe: true },
  });
  const reemitidos = await reemitidosDe(devueltos);
  const pendientes = devueltos.filter((d) => !reemitidos.has(d.id));
  return {
    total: pendientes.length,
    importe: Math.round(pendientes.reduce((s, d) => s + Number(d.importe) * 100, 0)) / 100,
  };
}
