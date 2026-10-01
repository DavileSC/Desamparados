/**
 * Cuándo es cada salida y qué días de reparto le corresponden. Puro: lo usa
 * el plazo, la mesa y los turnos con la fila de `Salida` ya leída.
 *
 * Dos clases de fecha, porque así las tienen las corporaciones: las de
 * Semana Santa se mueven con la Pascua (el Sábado de Pasión es −8) y las de
 * Gloria o el Rosario las fija la Junta cada año con un acto de la Agenda.
 */
import { deArticulo, type Articulo } from './articulos.js';

export type ReglaFecha =
  | { fecha: 'PASCUA'; diasDesdePascua: number }
  | { fecha: 'MANUAL'; acto: string | null };

/** Domingo de Resurrección, `AAAA-MM-DD` (Meeus/Butcher, calendario gregoriano). */
export function pascua(anio: number): string {
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
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia)).toISOString().slice(0, 10);
}

export function sumarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** El día de una fecha en Madrid: un acto a las 00:30 del día 17 es del 17, no del 16 en UTC. */
export function diaMadrid(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(fecha);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const diaLargo = (dia: string) => `${Number(dia.slice(8, 10))} de ${MESES[Number(dia.slice(5, 7)) - 1]} de ${dia.slice(0, 4)}`;

export function fechaDeSalida(regla: ReglaFecha, anio: number): string | null {
  if (regla.fecha === 'PASCUA') return sumarDias(pascua(anio), regla.diasDesdePascua);
  return regla.acto && Number(regla.acto.slice(0, 4)) === anio ? regla.acto : null;
}

/** La primera fecha de la salida que no ha pasado: el mismo día todavía cuenta. */
export function proximaFecha(regla: ReglaFecha, hoy: string): string | null {
  if (regla.fecha === 'MANUAL') return regla.acto && regla.acto >= hoy ? regla.acto : null;
  const anio = Number(hoy.slice(0, 4));
  const deEste = fechaDeSalida(regla, anio)!;
  return deEste >= hoy ? deEste : fechaDeSalida(regla, anio + 1);
}

/**
 * El año de la salida que se está preparando: el de su próxima fecha. A mano
 * y ya pasada, la del año siguiente, aunque todavía no tenga fecha.
 */
export function anioDeLaSalida(regla: ReglaFecha, hoy: string): number {
  const proxima = proximaFecha(regla, hoy);
  if (proxima) return Number(proxima.slice(0, 4));
  if (regla.fecha === 'MANUAL' && regla.acto) return Number(regla.acto.slice(0, 4)) + 1;
  return Number(hoy.slice(0, 4));
}

/**
 * Por qué un día de reparto no vale, o `null`. Un reparto es para la próxima
 * salida y tiene que caer antes de ella: así la papeleta se cuenta en el año
 * de esa salida, aunque el reparto sea en otoño del año anterior.
 */
export function motivoRepartoFueraDeTemporada(dia: string, regla: ReglaFecha, hoy: string, nombre: string, articulo: Articulo): string | null {
  const proxima = proximaFecha(regla, hoy);
  if (!proxima) return `${nombre} todavía no tiene fecha. Pon antes la fecha de la salida en la Agenda.`;
  if (dia < proxima) return null;
  return `El reparto ${deArticulo(articulo, nombre)} tiene que ser antes de la salida, que es el ${diaLargo(proxima)}.`;
}
