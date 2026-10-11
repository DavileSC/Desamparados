/**
 * Los cíngulos del ropero. Son todos iguales: no van numerados, se cuentan.
 * El Grupo apunta cuántos tiene (se compran o se hacen más cuando faltan) y
 * cada papeleta dice qué pasó con el suyo: se lo llevó prestado, se le debe
 * porque no quedaban, lleva el suyo o no lleva. Como el resto de la ropa,
 * el prestado se devuelve siempre después de la salida.
 */
import { Cingulo, Prisma } from '@prisma/client';
import db from '../../config/db.js';
import { HttpError } from '../../utils/error.handle.js';

type Cliente = Prisma.TransactionClient | typeof db;

/** La clave de Configuracion con los cíngulos que tiene el Grupo. */
export const CLAVE_CINGULOS = 'cingulos_total';

/** Lo que la mesa puede elegir al dar la ropa (DEVUELTO lo pone la devolución). */
export type CinguloEnMesa = Exclude<Cingulo, 'DEVUELTO'>;

interface RecuentoDeCingulos {
  /** Los que tiene el Grupo. */
  total: number;
  /** Prestados y sin devolver, de este año o de otros. */
  prestados: number;
  /** Los que quedan en el ropero para prestar. */
  enElRopero: number;
  /** A quien se le deben porque no quedaban. */
  debidos: number;
}

/** Cuántos tiene el Grupo, según la configuración (0 si nadie lo ha apuntado). */
async function totalDeCingulos(cliente: Cliente = db): Promise<number> {
  const fila = await cliente.configuracion.findUnique({ where: { key: CLAVE_CINGULOS } });
  const n = Number(fila?.value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export async function recuentoDeCingulos(cliente: Cliente = db): Promise<RecuentoDeCingulos> {
  const [total, enPapeleta, sueltos, debidos] = await Promise.all([
    totalDeCingulos(cliente),
    cliente.papeletaSitio.count({ where: { cingulo: Cingulo.PRESTADO } }),
    cliente.cinguloSinPapeleta.count(),
    cliente.papeletaSitio.count({ where: { cingulo: Cingulo.DEBIDO } }),
  ]);
  const prestados = enPapeleta + sueltos;
  return { total, prestados, debidos, enElRopero: Math.max(total - prestados, 0) };
}

/** Quien tiene algún cíngulo sin devolver, en su papeleta o en una anulada. */
export const CON_CINGULO_SIN_DEVOLVER: Prisma.HermanoWhereInput = {
  OR: [{ papeletas: { some: { cingulo: Cingulo.PRESTADO } } }, { cingulosSueltos: { some: {} } }],
};

/**
 * Los cíngulos sin devolver, de cualquier salida y año (de esos hermanos, o
 * de todos): los de sus papeletas y los de papeletas que se anularon.
 * `papeletaId` es por lo que la mesa los devuelve (`devolverCingulosEnTransaccion`).
 */
export async function cingulosSinDevolverDe(cliente: Cliente, hermanoIds?: number[]): Promise<{ papeletaId: number; year: number; hermanoId: number }[]> {
  const deQuien = hermanoIds ? { hermanoId: { in: hermanoIds } } : {};
  const [enPapeleta, sueltos] = await Promise.all([
    cliente.papeletaSitio.findMany({ where: { ...deQuien, cingulo: Cingulo.PRESTADO }, select: { id: true, year: true, hermanoId: true } }),
    cliente.cinguloSinPapeleta.findMany({ where: deQuien, select: { papeletaId: true, year: true, hermanoId: true } }),
  ]);
  return [...enPapeleta.map(({ id, ...c }) => ({ papeletaId: id, ...c })), ...sueltos].sort((a, b) => b.year - a.year);
}

/**
 * Da por devueltos los cíngulos de `papeletaIds` que tenga `hermanoId`, estén
 * en su papeleta o en una anulada. Devuelve cuántos había.
 */
export async function devolverCingulosEnTransaccion(tx: Prisma.TransactionClient, hermanoId: number, papeletaIds: number[]) {
  const enPapeleta = await tx.papeletaSitio.updateMany({
    where: { id: { in: papeletaIds }, hermanoId, cingulo: Cingulo.PRESTADO },
    data: { cingulo: Cingulo.DEVUELTO },
  });
  const sueltos = await tx.cinguloSinPapeleta.deleteMany({ where: { papeletaId: { in: papeletaIds }, hermanoId } });
  return enPapeleta.count + sueltos.count;
}

/**
 * Presta un cíngulo a quien tiene la papeleta `papeletaId`. Si le quedaba
 * uno sin devolver de otra papeleta, cuenta como que lo trae y se lleva
 * este: tiene uno, no dos. Se niega si no queda ninguno en el ropero.
 */
export async function prestarCinguloEnTransaccion(tx: Prisma.TransactionClient, hermanoId: number, papeletaId: number | null) {
  await tx.papeletaSitio.updateMany({
    where: { hermanoId, cingulo: Cingulo.PRESTADO, ...(papeletaId !== null && { id: { not: papeletaId } }) },
    data: { cingulo: Cingulo.DEVUELTO },
  });
  await tx.cinguloSinPapeleta.deleteMany({ where: { hermanoId } });
  const { enElRopero } = await recuentoDeCingulos(tx);
  if (enElRopero <= 0) {
    throw new HttpError('No quedan cíngulos en el ropero: marca «Se le debe» y se le da cuando los haya.', 409);
  }
}

/** Cambia cuántos cíngulos tiene el Grupo. No puede bajar de los que hay prestados. */
export async function cambiarTotalDeCingulos(total: number) {
  return db.$transaction(async (tx) => {
    const antes = await recuentoDeCingulos(tx);
    if (total < antes.prestados) {
      throw new HttpError(`Hay ${antes.prestados} cíngulos prestados sin devolver: el total no puede ser menor.`, 409);
    }
    await tx.configuracion.upsert({
      where: { key: CLAVE_CINGULOS },
      create: { key: CLAVE_CINGULOS, value: String(total) },
      update: { value: String(total) },
    });
    return { antes: antes.total, despues: await recuentoDeCingulos(tx) };
  });
}
