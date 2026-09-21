import type { Prisma } from '@prisma/client';
import { claveMesMadrid } from './contabilidad.js';

export interface MovimientoMensual {
  /** 'YYYY-MM' */
  mes: string;
  total: number;
}

export interface PuntoCenso {
  mes: string;
  activos: number;
}

/**
 * Altas del censo desde `desde`: solo hermanos que Secretaría aprobó.
 *
 * Una solicitud pendiente también tiene `fechaAlta` (la del registro), pero no
 * es un alta: está `activo: false` y sin `fechaBaja` (solicitudes.service,
 * getSolicitudesPendientes). Al aprobarla pasa a activa con la fecha de la
 * aprobación. Un hermano aprobado que luego se dio de baja sigue contando: su
 * alta ocurrió, y la serie del censo necesita el alta para compensar su baja.
 */
export function whereAltasAprobadas(desde: Date): Prisma.HermanoWhereInput {
  return { fechaAlta: { gte: desde }, OR: [{ activo: true }, { fechaBaja: { not: null } }] };
}

/**
 * Etiqueta 'YYYY-MM' de una fecha, en el mes de Madrid (no depende de la zona
 * del servidor). Antes era el mes UTC y la contabilidad contaba en meses de
 * Madrid: lo cobrado entre las 00:00 y la 01:00 (o las 02:00 en verano) del día 1
 * caía en un mes en el panel y en otro en la contabilidad.
 */
export function claveMes(fecha: Date): string {
  return claveMesMadrid(fecha);
}

/** Los `cuantos` últimos meses (de Madrid) hasta `hasta`, del más antiguo al más reciente. */
export function ultimosMeses(hasta: Date, cuantos: number): string[] {
  const [anio, mes] = claveMes(hasta).split('-').map(Number);
  const meses: string[] = [];
  for (let i = cuantos - 1; i >= 0; i--) {
    // Aritmética de calendario pura: se construye y se lee en UTC, así que la
    // zona no interviene; Date.UTC resuelve el cruce de año (mes 0 → diciembre).
    const fecha = new Date(Date.UTC(anio, mes - 1 - i, 1));
    meses.push(`${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return meses;
}

/**
 * Reconstruye cuántos hermanos activos había al cierre de cada mes.
 *
 * No se puede consultar directamente: la base de datos solo sabe quién está
 * activo HOY, con su fecha de alta y su fecha de baja. Así que se parte del
 * total actual y se camina hacia atrás:
 *
 *     activos(mes anterior) = activos(mes) - altas(mes) + bajas(mes)
 */
export function serieCensoMensual(
  activosHoy: number,
  altas: MovimientoMensual[],
  bajas: MovimientoMensual[],
  meses: string[],
): PuntoCenso[] {
  const porMes = (lista: MovimientoMensual[]) =>
    new Map(lista.map((m) => [m.mes, m.total]));
  const altasPorMes = porMes(altas);
  const bajasPorMes = porMes(bajas);

  const serie: PuntoCenso[] = new Array(meses.length);
  let acumulado = activosHoy;

  for (let i = meses.length - 1; i >= 0; i--) {
    serie[i] = { mes: meses[i], activos: Math.max(0, acumulado) };
    acumulado = acumulado - (altasPorMes.get(meses[i]) ?? 0) + (bajasPorMes.get(meses[i]) ?? 0);
  }

  return serie;
}
