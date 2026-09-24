import { diaMadrid, esDiaValido, inicioDiaMadrid } from './contabilidad.js';

/**
 * Reglas de la papeleta de sitio que no necesitan base de datos: cómo se lee
 * un precio de la configuración, cómo se comparan los conceptos de los
 * recibos y qué datos del evento se imprimen en la papeleta (el concepto y
 * el importe de cada salida están en `salidas.ts`). Viven aquí para poder
 * probarlas en cualquier máquina: son las que, cuando se equivocan, cobran de
 * más o mandan a los hermanos a una hora que no es.
 */

// ---------------------------------------------------------------------------
//  Precios
// ---------------------------------------------------------------------------

// Hasta ocho cifras enteras y dos decimales, con punto o con coma: es lo que
// cabe en `Decimal(10, 2)` y lo que escribe cualquiera en España («12,50»).
// Sin signo a propósito: un «-5» no es un precio, es un error de tecleo que
// antes acababa en un ingreso negativo en contabilidad.
const IMPORTE = /^\d{1,8}(?:[.,]\d{1,2})?$/;

/**
 * Convierte un importe escrito a mano en número, o `null` si no es un
 * importe válido. «0» es válido: una papeleta gratuita es una decisión de la
 * Junta, no un olvido.
 */
export function parsearImporte(texto: string): number | null {
  const limpio = texto.trim();
  if (!IMPORTE.test(limpio)) return null;
  const valor = Number(limpio.replace(',', '.'));
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
}

export type LecturaPrecio =
  | { ok: true; valor: number; configurado: boolean }
  | { ok: false; crudo: string };

/**
 * Lee un precio de la tabla `Configuracion`.
 *
 * El valor por defecto se usa SOLO si la clave no está configurada (no existe
 * o está en blanco). Antes se hacía `Number(valor) || 30`, que convertía en
 * 30 € tanto un «0» como un «12,50» —`Number('12,50')` es `NaN`—: la mesa
 * cobraba un precio que nadie había puesto. Un valor configurado que no se
 * entiende no se sustituye en silencio: se devuelve como error para que la
 * inscripción se detenga y alguien lo corrija.
 */
export function leerPrecio(crudo: string | null | undefined, porDefecto: number): LecturaPrecio {
  if (crudo === null || crudo === undefined || crudo.trim() === '') {
    return { ok: true, valor: porDefecto, configurado: false };
  }
  const valor = parsearImporte(crudo);
  return valor === null ? { ok: false, crudo } : { ok: true, valor, configurado: true };
}

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

/** Claves de `Configuracion` con los datos de la salida. */
export const CLAVES_EVENTO = {
  fecha: 'procesion_fecha',
  hora: 'procesion_hora',
  acceso: 'procesion_acceso',
} as const;

export interface DatosEvento {
  fechaSalida: string;
  horaSalida: string;
  accesoPuerta: string;
}

const EVENTO_POR_DEFECTO: DatosEvento = {
  // El Sábado de Pasión es cuando sale este Grupo Parroquial.
  fechaSalida: 'Sábado de Pasión',
  horaSalida: '19:30h',
  accesoPuerta: 'Consultar en secretaría',
};

function primerValor(...candidatos: (string | null | undefined)[]): string | undefined {
  return candidatos.find((c): c is string => typeof c === 'string' && c.trim() !== '')?.trim();
}

/**
 * Fecha, hora y puerta de la salida, de una sola fuente para las dos formas de
 * sacar la papeleta (cobro en tesorería e inscripción en mesa). Antes la mesa
 * llevaba escrito «Viernes Santo, 19:00, Casa Grupo Parroquial» mientras
 * tesorería leía `PROCESION_*`: el mismo año, dos papeletas con dos horas.
 *
 * Orden: tabla `Configuracion` (editable sin redesplegar) → variables
 * `PROCESION_FECHA/HORA/ACCESO` del entorno → valores por defecto.
 */
export function datosEvento(
  config: Partial<Record<(typeof CLAVES_EVENTO)[keyof typeof CLAVES_EVENTO], string | null | undefined>>,
  env: Record<string, string | undefined> = process.env,
): DatosEvento {
  return {
    fechaSalida: primerValor(config[CLAVES_EVENTO.fecha], env.PROCESION_FECHA) ?? EVENTO_POR_DEFECTO.fechaSalida,
    horaSalida: primerValor(config[CLAVES_EVENTO.hora], env.PROCESION_HORA) ?? EVENTO_POR_DEFECTO.horaSalida,
    accesoPuerta: primerValor(config[CLAVES_EVENTO.acceso], env.PROCESION_ACCESO) ?? EVENTO_POR_DEFECTO.accesoPuerta,
  };
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
