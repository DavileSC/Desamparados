/**
 * La ropa de la procesión en el ropero: prestar a quien sale la túnica y el
 * capirote o la faraona que le da la mesa, recogerlos si se anula y
 * recibirlos de vuelta después de la salida: todo lo prestado se devuelve.
 *
 * Todo corre dentro de la transacción de quien llama (la inscripción, la
 * corrección de una papeleta, la anulación): o se presta la ropa y se emite
 * la papeleta, o ninguna de las dos cosas.
 */
import { EstadoPrenda, Prisma, TipoPrenda } from '@prisma/client';
import { HttpError, NotFoundError } from '../../utils/error.handle.js';
import { normalizarNumeroPrenda, tallaDeTunica, type TunicaLibre } from '../../domain/mesa-procesion.js';
import db from '../../config/db.js';

type Tx = Prisma.TransactionClient;
export type TipoRopa = 'TUNICA' | 'CAPIROTE' | 'FARAONA';

/** «La túnica 145-31…»: el tipo, con su artículo. */
export const NOMBRE_ROPA: Record<TipoRopa, string> = { TUNICA: 'La túnica', CAPIROTE: 'El capirote', FARAONA: 'La faraona' };

export interface RopaPedida {
  tipo: TipoRopa;
  numero: string;
  /** No está en el ropero y se da de alta al prestarla. */
  crear?: boolean;
}

/**
 * Presta a `hermanoId` cada prenda pedida. Si la persona tenía otra del
 * mismo tipo sin devolver, esa vuelve al ropero: se lleva una túnica cada
 * vez, y la de antes la entrega en la mesa al recoger la nueva.
 *
 * Una prenda que consta en el lavado se puede prestar: el reparto es meses
 * después de la devolución y ya estará lavada aunque nadie lo marcara. Se
 * niega, con un mensaje para la mesa, si la prenda no está en el ropero
 * (salvo que se pida darla de alta), si la tiene otra persona, o si está en
 * el taller (rota) o de baja.
 */
export async function prestarRopaEnTransaccion(tx: Tx, hermanoId: number, pedidas: RopaPedida[]) {
  for (const pedida of pedidas) {
    const numero = normalizarNumeroPrenda(pedida.numero);
    const tipo = pedida.tipo as TipoPrenda;
    const nombre = `${NOMBRE_ROPA[pedida.tipo]} ${numero}`;

    let prenda = await tx.prenda.findUnique({
      where: { tipo_numero: { tipo, numero } },
      include: { hermano: { select: { nombre: true, apellidos: true } } },
    });
    if (!prenda) {
      if (!pedida.crear) throw new NotFoundError(`${nombre} no está en el ropero.`);
      prenda = await tx.prenda.create({
        data: { tipo, numero, talla: pedida.tipo === 'TUNICA' ? tallaDeTunica(numero) : null },
        include: { hermano: { select: { nombre: true, apellidos: true } } },
      });
    }

    if (prenda.estado === EstadoPrenda.BAJA) throw new HttpError(`${nombre} está dada de baja en el ropero.`, 409);
    if (prenda.estado === EstadoPrenda.TALLER) throw new HttpError(`${nombre} está en el taller, para arreglar.`, 409);
    if (prenda.estado === EstadoPrenda.PRESTADA && prenda.hermanoId !== hermanoId) {
      const quien = prenda.hermano ? `${prenda.hermano.nombre} ${prenda.hermano.apellidos}` : 'otra persona';
      throw new HttpError(`${nombre} la tiene ${quien}.`, 409);
    }

    // La que tenía del mismo tipo, de vuelta al ropero.
    await tx.prenda.updateMany({
      where: { tipo, hermanoId, estado: EstadoPrenda.PRESTADA, id: { not: prenda.id } },
      data: { estado: EstadoPrenda.DISPONIBLE, hermanoId: null, fechaAsignacion: null },
    });

    // Condicionada al estado leído: si otra mesa la presta a la vez, una de las dos lo sabe.
    const { count } = await tx.prenda.updateMany({
      where: {
        id: prenda.id,
        OR: [{ estado: { in: [EstadoPrenda.DISPONIBLE, EstadoPrenda.LAVADO] } }, { estado: EstadoPrenda.PRESTADA, hermanoId }],
      },
      data: { estado: EstadoPrenda.PRESTADA, hermanoId, fechaAsignacion: new Date() },
    });
    if (count !== 1) throw new HttpError(`${nombre} acaba de cambiar en el ropero. Vuelve a intentarlo.`, 409);
  }
}

/** El campo de la papeleta donde va cada tipo de prenda. */
export const CAMPO_DE_ROPA = { TUNICA: 'numTunicaAsignada', CAPIROTE: 'numCapiroteAsignado', FARAONA: 'numFaraonaAsignada' } as const;

/**
 * Una prenda va en una sola papeleta de cada salida: dos nazarenos no llevan
 * la misma túnica en la misma procesión. El ropero solo dice cómo está hoy
 * (después de la salida todo vuelve y queda libre), así que se mira también
 * en las papeletas de ese año. `papeletaId` es la que se corrige, que no
 * choca consigo misma.
 */
export async function comprobarQueNoVaEnOtraPapeleta(
  tx: Tx,
  donde: { year: number; salidaId: number; papeletaId?: number },
  ropa: Partial<Record<(typeof CAMPO_DE_ROPA)[TipoRopa], string | null>>,
) {
  for (const tipo of Object.keys(CAMPO_DE_ROPA) as TipoRopa[]) {
    const campo = CAMPO_DE_ROPA[tipo];
    const numero = ropa[campo];
    if (!numero) continue;
    const otra = await tx.papeletaSitio.findFirst({
      where: { year: donde.year, salidaId: donde.salidaId, [campo]: numero, ...(donde.papeletaId && { id: { not: donde.papeletaId } }) },
      select: { hermano: { select: { nombre: true, apellidos: true } } },
    });
    if (otra) throw new HttpError(`${NOMBRE_ROPA[tipo]} ${numero} ya va en la papeleta de ${otra.hermano.nombre} ${otra.hermano.apellidos} de ${donde.year}.`, 409);
  }
}

/** Devuelve al ropero las prendas de una papeleta que sigan prestadas a esa persona. */
export async function recogerRopaEnTransaccion(
  tx: Tx,
  hermanoId: number,
  papeleta: { numTunicaAsignada: string | null; numCapiroteAsignado: string | null; numFaraonaAsignada: string | null },
) {
  const prendas: { tipo: TipoPrenda; numero: string }[] = [];
  if (papeleta.numTunicaAsignada) prendas.push({ tipo: TipoPrenda.TUNICA, numero: papeleta.numTunicaAsignada });
  if (papeleta.numCapiroteAsignado) prendas.push({ tipo: TipoPrenda.CAPIROTE, numero: papeleta.numCapiroteAsignado });
  if (papeleta.numFaraonaAsignada) prendas.push({ tipo: TipoPrenda.FARAONA, numero: papeleta.numFaraonaAsignada });
  if (prendas.length === 0) return;

  await tx.prenda.updateMany({
    where: { hermanoId, estado: EstadoPrenda.PRESTADA, OR: prendas },
    data: { estado: EstadoPrenda.DISPONIBLE, hermanoId: null, fechaAsignacion: null },
  });
}

/** La ropa que pide una inscripción de la mesa, lista para el ropero. */
export function ropaPedida(data: {
  origenTunica?: string;
  numTunicaAsignada?: string | null;
  numCapiroteAsignado?: string | null;
  numFaraonaAsignada?: string | null;
  crearPrendas?: TipoRopa[];
}): RopaPedida[] {
  const crear = new Set(data.crearPrendas ?? []);
  const pedidas: RopaPedida[] = [];
  if (data.origenTunica === 'ROPERO' && data.numTunicaAsignada?.trim()) {
    pedidas.push({ tipo: 'TUNICA', numero: data.numTunicaAsignada, crear: crear.has('TUNICA') });
  }
  if (data.numCapiroteAsignado?.trim()) pedidas.push({ tipo: 'CAPIROTE', numero: data.numCapiroteAsignado, crear: crear.has('CAPIROTE') });
  if (data.numFaraonaAsignada?.trim()) pedidas.push({ tipo: 'FARAONA', numero: data.numFaraonaAsignada, crear: crear.has('FARAONA') });
  return pedidas;
}

/**
 * Dónde va una prenda que se devuelve: la túnica, siempre al lavado (se
 * lavan todas, sin excepción); lo demás, al ropero. Lo que vuelve roto, al
 * taller, para arreglarlo.
 */
export function estadoAlDevolver(tipo: TipoPrenda, rota: boolean): EstadoPrenda {
  if (rota) return EstadoPrenda.TALLER;
  return tipo === TipoPrenda.TUNICA ? EstadoPrenda.LAVADO : EstadoPrenda.DISPONIBLE;
}

/**
 * Las túnicas que se pueden proponer ahora: disponibles en el ropero y que no
 * van ya en la papeleta de otro de esta salida (la regla con que la mesa las
 * da). Para proponer la de su talla a quien no tiene ninguna. El ropero va por
 * salida y año: dos salidas con ropa llevan cada una su reparto de túnicas.
 */
export async function tunicasLibres(cliente: Tx | typeof db, year: number, salidaId: number): Promise<TunicaLibre[]> {
  const [libres, enPapeletas] = await Promise.all([
    cliente.prenda.findMany({ where: { tipo: 'TUNICA', estado: 'DISPONIBLE' }, select: { numero: true, talla: true }, orderBy: { numero: 'asc' } }),
    cliente.papeletaSitio.findMany({ where: { year, salidaId, numTunicaAsignada: { not: null } }, select: { numTunicaAsignada: true } }),
  ]);
  const ocupadas = new Set(enPapeletas.map((p) => p.numTunicaAsignada));
  return libres.filter((t) => !ocupadas.has(t.numero));
}
