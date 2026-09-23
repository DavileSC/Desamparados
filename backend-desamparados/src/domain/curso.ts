import { inicioDiaMadrid } from './contabilidad.js';

/**
 * El curso del Grupo Parroquial va de un Sábado de Pasión (la estación de
 * penitencia, ocho días antes de Pascua) al siguiente. Es el mismo cálculo que
 * `domain/sabadoDePasion.ts` del frontend, que dibuja el curso con estos actos:
 * si los dos discreparan, en el camino faltarían o sobrarían actos.
 */

/** Domingo de Pascua por el algoritmo de Meeus/Butcher (calendario gregoriano). */
function pascua(anio: number): { mes: number; dia: number } {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return { mes: Math.floor((h + l - 7 * m + 114) / 31), dia: ((h + l - 7 * m + 114) % 31) + 1 };
}

/** Sábado de Pasión de ese año, en `AAAA-MM-DD`. */
export function sabadoDePasion(anio: number): string {
  const { mes, dia } = pascua(anio);
  return new Date(Date.UTC(anio, mes - 1, dia - 8)).toISOString().slice(0, 10);
}

/** El día siguiente a uno dado, en `AAAA-MM-DD`. */
const siguiente = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * El curso en el que cae `diaHoy` (día de Madrid, `AAAA-MM-DD`), como rango de
 * instantes: desde el principio del Sábado de Pasión anterior hasta el final
 * del próximo, los dos incluidos. El mismo día de la estación todavía es del
 * curso que acaba.
 */
export function rangoDelCurso(diaHoy: string): { desde: Date; hasta: Date } {
  const anio = Number(diaHoy.slice(0, 4));
  const deEsteAnio = sabadoDePasion(anio);
  const yaPaso = diaHoy > deEsteAnio;
  const inicio = yaPaso ? deEsteAnio : sabadoDePasion(anio - 1);
  const fin = yaPaso ? sabadoDePasion(anio + 1) : deEsteAnio;
  return { desde: inicioDiaMadrid(inicio), hasta: inicioDiaMadrid(siguiente(fin)) };
}
