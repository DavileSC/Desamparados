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
import { EstadoCita, EstadoPago, Prisma, MetodoPago, TipoRecibo, TipoTransaccion } from '@prisma/client';
import { HttpError } from '../../utils/error.handle';
import { CLAVES_EVENTO, datosEvento, type DatosEvento } from '../../domain/datos-procesion.js';
import { palabrasDeBusqueda } from '../../domain/busqueda-texto.js';
import { CATEGORIA_COMISIONES, CATEGORIA_DE_RECIBO, CATEGORIA_DEVOLUCIONES } from '../../domain/contabilidad.js';

export type Tx = Prisma.TransactionClient;

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
export function whereBusquedaRecibo(q: string | undefined): Prisma.ReciboWhereInput {
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

/**
 * Fecha, hora y puerta de la salida que se imprimen en la papeleta. Una sola
 * fuente para el cobro en tesorería y la inscripción en mesa; el orden de
 * preferencia está en `domain/datos-procesion.ts`.
 */
export async function leerDatosEvento(): Promise<DatosEvento> {
  const filas = await db.configuracion.findMany({
    where: { key: { in: Object.values(CLAVES_EVENTO) } }
  });
  return datosEvento(Object.fromEntries(filas.map((f) => [f.key, f.value])));
}

// =================================================================
//  1. GENERACIÓN MASIVA Y EMISIÓN SUELTA (ADMIN)
// =================================================================

/**
 * PAGADO -> DEVUELTO con su asiento de reverso, dentro de la transacción de
 * quien llama. Es el único camino para retroceder un cobro: lo usan la
 * edición de Tesorería y la anulación de una papeleta en mesa, que antes
 * pasaba el recibo a ANULADO por su cuenta y dejaba el ingreso en contabilidad
 * como si el dinero siguiera en caja.
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
  observaciones?: string
) {
  const transicion = await tx.recibo.updateMany({
    where: { id: recibo.id, estado: EstadoPago.PAGADO },
    data: { estado: EstadoPago.DEVUELTO, ...(observaciones !== undefined ? { observaciones } : {}) }
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
      fecha: new Date(),
      metodoPago: recibo.metodoPago,
      hermanoId: recibo.hermanoId,
      reciboId: recibo.id
    }
  });
}

/**
 * Deja sin efecto la papeleta de un recibo, si la tiene: libera la cita (por
 * si el hermano quiere volver otro día) y borra la papeleta, que libera su
 * hueco en la procesión y la clave [hermano, año] para una reinscripción.
 * Devuelve la papeleta retirada, o `null` si el recibo no tenía.
 */
export async function retirarPapeletaEnTransaccion(tx: Tx, reciboId: number) {
  const papeleta = await tx.papeletaSitio.findUnique({ where: { reciboId } });
  if (!papeleta) return null;

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
  categoriaComisionesId: number
) {
  await tx.transaccion.create({
    data: {
      tipo: TipoTransaccion.GASTO,
      categoriaId: categoriaComisionesId,
      concepto: `Comisión del banco por devolver el recibo #${recibo.id}`,
      importe,
      fecha: new Date(),
      metodoPago: recibo.metodoPago,
      hermanoId: recibo.hermanoId,
      reciboId: recibo.id
    }
  });
}
