import { diaMadrid, esDiaValido, inicioDiaMadrid } from './contabilidad.js';

/**
 * Reglas de la papeleta de sitio que no necesitan base de datos: cómo se
 * comparan los conceptos de los recibos, la forma de los datos del evento que
 * se imprimen en la papeleta y las fechas de mantenimiento (el concepto y el
 * importe de cada salida están en `salidas.ts`; la cuota es un `Decimal` de la
 * fila de la salida, que ya no se lee de un texto de la configuración). Viven
 * aquí para poder probarlas en cualquier máquina: son las que, cuando se
 * equivocan, cobran de más o mandan a los hermanos a una hora que no es.
 */

// ---------------------------------------------------------------------------
//  Concepto del recibo
// ---------------------------------------------------------------------------

/**
 * Un concepto tal y como lo compara la columna `Recibo.concepto`, que es
 * `utf8mb4_unicode_ci` (comprobado en la base): sin distinguir mayúsculas ni
 * tildes, con la ñ igual a la n (la intercalación genérica, no la española) e
 * ignorando los espacios del final pero no los del principio. Si aquí se
 * comparase distinto que en la base, un concepto «libre» según esta función
 * chocaría con la clave única al insertarlo.
 */
export function claveConcepto(concepto: string): string {
  return concepto
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // tildes, diéresis y la virgulilla de la ñ
    .toLowerCase()
    .replace(/\s+$/u, '');
}

// ---------------------------------------------------------------------------
//  Datos del evento impresos en la papeleta
// ---------------------------------------------------------------------------

/**
 * Fecha, hora y puerta de la salida tal como se imprimen en la papeleta y en
 * el correo. Salen de la fila de la salida (ver `leerDatosEvento`).
 */
export interface DatosEvento {
  fechaSalida: string;
  horaSalida: string;
  accesoPuerta: string;
}

// ---------------------------------------------------------------------------
//  Fechas de mantenimiento
// ---------------------------------------------------------------------------

/**
 * El instante hasta el que se procesan ausencias, o `null` si lo pedido no
 * vale. Cuentan los turnos que ya habían terminado en ese instante.
 *
 * - Sin fecha: ahora mismo.
 * - Un día `AAAA-MM-DD`: el principio de ese día en Madrid, es decir, «hasta
 *   el día anterior incluido». Leído con `new Date` sería la medianoche UTC,
 *   las 02:00 de Madrid en verano: entre las 00:00 y las 02:00 el día de hoy
 *   parecía futuro y daba 400, y el resto del día el límite caía dos horas
 *   tarde. El día sirve si no es posterior a hoy en Madrid.
 * - Un instante completo (ISO con hora): ese instante, si no es futuro.
 *
 * Una fecha futura marcaba NO_PRESENTADO a hermanos cuya cita aún no había
 * llegado y les mandaba el correo de «no vino»; una ilegible acababa en
 * `Invalid Date` y en un 500.
 */
export function instanteLimiteAusencias(texto: string | undefined, ahora: Date = new Date()): Date | null {
  if (texto === undefined) return ahora;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    if (!esDiaValido(texto) || texto > diaMadrid(ahora)) return null;
    return inicioDiaMadrid(texto);
  }
  const instante = new Date(texto);
  if (Number.isNaN(instante.getTime()) || instante.getTime() > ahora.getTime()) return null;
  return instante;
}

/** `true` si el texto es una fecha que JavaScript entiende. */
export function esFechaValida(texto: string): boolean {
  return !Number.isNaN(new Date(texto).getTime());
}

// ---------------------------------------------------------------------------
//  Turnos de reparto
// ---------------------------------------------------------------------------

/**
 * El día de Madrid al que pertenece la `fecha` de un turno. Un `AAAA-MM-DD` es
 * ese día tal cual (`new Date` lo leería como medianoche UTC, que en Madrid ya
 * es ese mismo día, pero así no depende de ello); un instante, el día que es
 * en Madrid. Sirve igual para la fecha que llega del cliente y para la que ya
 * está guardada.
 */
export function diaDelTurno(fecha: string | Date): string | null {
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return esDiaValido(fecha) ? fecha : null;
  const instante = fecha instanceof Date ? fecha : new Date(fecha);
  return Number.isNaN(instante.getTime()) ? null : diaMadrid(instante);
}

const conFormatoEspanol = (dia: string) => dia.split('-').reverse().join('/');

/**
 * Por qué no vale un turno, o `null` si vale.
 *
 * Las horas de un turno son instantes completos y tienen que caer el día del
 * turno en Madrid: procesar ausencias decide por `horaFin` si un turno ya
 * terminó. Una hora sobre una fecha ficticia (el 1 de enero de 1970, o el día
 * de antes por un desfase de zona) haría que un turno de esta tarde pareciera
 * terminado desde siempre, y a sus hermanos les llegaría el «no viniste» antes
 * de tener ocasión de venir. Se compara en Madrid, no en UTC: las 00:30 del
 * día 15 en Madrid son todavía el 14 en UTC.
 */
export function motivoTurnoInvalido(fecha: string | Date, horaInicio: Date, horaFin: Date): string | null {
  const dia = diaDelTurno(fecha);
  if (!dia) return 'La fecha del turno no es un día válido.';
  if (Number.isNaN(horaInicio.getTime()) || Number.isNaN(horaFin.getTime())) return 'Las horas del turno no son válidas.';
  if (diaMadrid(horaInicio) !== dia) return `La hora de inicio tiene que ser del mismo día que el turno (${conFormatoEspanol(dia)}).`;
  if (diaMadrid(horaFin) !== dia) return `La hora de fin tiene que ser del mismo día que el turno (${conFormatoEspanol(dia)}).`;
  if (horaFin.getTime() <= horaInicio.getTime()) return 'La hora de fin debe ser posterior a la hora de inicio.';
  return null;
}
