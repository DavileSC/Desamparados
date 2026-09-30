/**
 * El Sábado de Pasión (la estación de penitencia, ocho días antes de Pascua)
 * y la temporada de reparto de cada salida. Es el mismo cálculo que
 * `domain/sabadoDePasion.ts` del frontend (la cuenta atrás del Inicio).
 *
 * No marca periodos: el Grupo lleva su año del 1 de enero al 31 de diciembre.
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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** «28 de marzo», de un `AAAA-MM-DD`. */
const diaYMes = (dia: string) => `${Number(dia.slice(8, 10))} de ${MESES[Number(dia.slice(5, 7)) - 1]}`;

/** El día anterior a uno dado, en `AAAA-MM-DD`. */
const anterior = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10);
};

/**
 * Por qué un día de reparto (`AAAA-MM-DD`) no vale para su salida, o `null`.
 * El de la Pasión va del 1 de enero a la víspera del Sábado de Pasión de ese
 * año; el del Rosario vespertino, en octubre. La mesa apunta cada papeleta en
 * el año en que se reparte: un reparto de la Pasión en otoño la contaba en la
 * salida que ya pasó.
 */
export function motivoRepartoFueraDeTemporada(dia: string, salida: 'PASION' | 'ROSARIO'): string | null {
  const anio = Number(dia.slice(0, 4));
  if (salida === 'PASION') {
    if (dia < sabadoDePasion(anio)) return null;
    // Pasada la salida, la siguiente es la del año que viene.
    return `El reparto de la Pasión va antes de la salida, dentro del mismo año: para la de ${anio + 1}, pon un día del 1 de enero al ${diaYMes(anterior(sabadoDePasion(anio + 1)))} de ${anio + 1}.`;
  }
  if (Number(dia.slice(5, 7)) === 10) return null;
  const suyo = Number(dia.slice(5, 7)) < 10 ? anio : anio + 1;
  return `El reparto del Rosario vespertino va en octubre: pon un día del 1 al 31 de octubre de ${suyo}.`;
}
