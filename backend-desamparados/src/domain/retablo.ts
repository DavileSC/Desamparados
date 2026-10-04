/**
 * El retablo del Inicio del CMS: qué foto toca hoy y a qué cuenta atrás.
 * Puro: el servicio le pasa los ajustes guardados y el día de hoy en Madrid.
 *
 * La web tiene su gemela en `desamparados-web/src/domain/tiemposDelRetablo.ts`
 * para pintar la barra del año mientras se edita; quien decide es esta.
 */
import { pascua, sumarDias } from './fecha-salida.js';

/** Los tiempos que se calculan solos cada año. */
export const TIEMPOS_CALCULADOS = ['cuaresma', 'semana-santa', 'navidad'] as const;
export type TiempoCalculado = (typeof TIEMPOS_CALCULADOS)[number];

/** La foto y el punto que nunca se recorta, en %. */
export interface Encuadre {
  foto: string;
  x: number;
  y: number;
}

/** Un tiempo con su foto: uno de los calculados, o unas fechas a mano (`MM-DD`). */
export type TiempoDelRetablo = Encuadre & (
  | { tiempo: TiempoCalculado }
  | { tiempo: 'a-mano'; nombre: string; desde: string; hasta: string }
);

/** Hasta qué cuenta el retablo. */
export type CuentaAtras =
  | { tipo: 'proxima' }
  | { tipo: 'salida'; salidaId: number }
  | { tipo: 'acto'; eventoId: number }
  | { tipo: 'ninguna' };

/** Sin nada guardado, como era antes: la próxima salida. */
export const CUENTA_POR_DEFECTO: CuentaAtras = { tipo: 'proxima' };

/** Cuántos tiempos caben además del de todo el año. */
export const MAX_TIEMPOS = 8;

/** Un tramo de días, los dos incluidos, en `AAAA-MM-DD`. */
export interface Tramo {
  desde: string;
  hasta: string;
}

/**
 * Las fechas de un tiempo que empieza en el año `anio`. La Navidad y las
 * fechas a mano que dan la vuelta (del 15-12 al 15-01) acaban al año siguiente.
 */
export function tramoDelTiempo(t: TiempoDelRetablo, anio: number): Tramo {
  switch (t.tiempo) {
    case 'cuaresma': {
      const domingo = pascua(anio);
      // Del Miércoles de Ceniza (46 días antes) al Domingo de Resurrección.
      return { desde: sumarDias(domingo, -46), hasta: domingo };
    }
    case 'semana-santa': {
      const domingo = pascua(anio);
      // Del Domingo de Ramos al de Resurrección.
      return { desde: sumarDias(domingo, -7), hasta: domingo };
    }
    case 'navidad':
      return { desde: `${anio}-12-24`, hasta: `${anio + 1}-01-06` };
    case 'a-mano':
      return { desde: `${anio}-${t.desde}`, hasta: `${t.hasta < t.desde ? anio + 1 : anio}-${t.hasta}` };
  }
}

const DIA_EN_MS = 24 * 60 * 60 * 1000;
const duracion = (r: Tramo) => (Date.parse(r.hasta) - Date.parse(r.desde)) / DIA_EN_MS;

/**
 * El tiempo que manda hoy, o `null` si no toca ninguno (la foto de todo el
 * año). Si caen varios, el más corto: la Semana Santa va dentro de la
 * Cuaresma y tiene que ganarle. A igual duración, el primero de la lista.
 */
export function tiempoDeHoy<T extends TiempoDelRetablo>(tiempos: readonly T[], hoy: string): T | null {
  const anio = Number(hoy.slice(0, 4));
  let elegido: { t: T; dias: number } | null = null;
  for (const t of tiempos) {
    // Los que dan la vuelta al año pueden haber empezado el año anterior.
    const tramo = [tramoDelTiempo(t, anio - 1), tramoDelTiempo(t, anio)].find((r) => r.desde <= hoy && hoy <= r.hasta);
    if (!tramo) continue;
    const dias = duracion(tramo);
    if (!elegido || dias < elegido.dias) elegido = { t, dias };
  }
  return elegido?.t ?? null;
}

/** `MM-DD` que existe en algún año (el 29 de febrero vale). */
export function esDiaDelAnio(valor: string): boolean {
  const m = /^(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const mes = Number(m[1]);
  const dia = Number(m[2]);
  const diasDelMes = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasDelMes[mes - 1];
}

/** Días que faltan de `hoy` a `fecha` (las dos `AAAA-MM-DD`); 0 el mismo día. */
export const diasHasta = (hoy: string, fecha: string) => Math.round((Date.parse(fecha) - Date.parse(hoy)) / DIA_EN_MS);
