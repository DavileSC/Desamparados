import { diaMadrid, inicioDiaMadrid } from './contabilidad.js';
import { claveMes, ultimosMeses } from './panel-censo.js';
import { HttpError } from '../utils/error.handle.js';

/**
 * El ejercicio que enseña «Cómo va el año». En la reunión de principios de año
 * la junta mira el ejercicio recién cerrado, cuando el nuevo todavía no tiene
 * datos; el resto del año se mira el que está en curso.
 *
 * `cerrado` no es solo informativo: decide si los meses son los doce naturales
 * del año (ejercicio terminado) o los últimos doce (año en curso, como hasta
 * ahora), y la pantalla lo dice en la cabecera.
 */
interface Ejercicio {
  anio: number;
  cerrado: boolean;
}

/** Antes de 2000 no hay nada que enseñar y un año de cuatro cifras acota el error. */
const ANIO_MINIMO = 2000;

/**
 * Lee y valida `?anio=`. Sin valor (o vacío), el año en curso. Cualquier otra
 * cosa que no sea un año de cuatro cifras entre ANIO_MINIMO y el actual es un
 * 400: es un parámetro de la petición, no un fallo del servidor.
 */
export function leerEjercicio(valor: unknown, hoy: Date): Ejercicio {
  const actual = Number(diaMadrid(hoy).slice(0, 4));
  if (valor === undefined || valor === null || valor === '') {
    return { anio: actual, cerrado: false };
  }

  const texto = String(valor).trim();
  const anio = /^\d{4}$/.test(texto) ? Number(texto) : NaN;
  if (!Number.isInteger(anio) || anio < ANIO_MINIMO || anio > actual) {
    throw new HttpError(`El ejercicio tiene que ser un año entre ${ANIO_MINIMO} y ${actual}.`, 400);
  }

  return { anio, cerrado: anio < actual };
}

/** Los doce meses ('YYYY-MM') que enseña la sección para ese ejercicio. */
export function mesesDelEjercicio({ anio, cerrado }: Ejercicio, hoy: Date): string[] {
  if (!cerrado) return ultimosMeses(hoy, 12);
  return Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);
}

/**
 * Meses que hay que recorrer para reconstruir el censo, del primero que se
 * enseña al mes de hoy.
 *
 * `serieCensoMensual` parte de los activos de HOY y camina hacia atrás: para
 * saber cuántos había al cierre de diciembre de 2025 hacen falta también las
 * altas y bajas de 2026. Con el año en curso coincide con los meses mostrados.
 */
export function mesesParaReconstruir(mesesMostrados: string[], hoy: Date): string[] {
  if (mesesMostrados.length === 0) return [];
  const primero = mesesMostrados[0];
  const mesDeHoy = claveMes(hoy);
  if (primero >= mesDeHoy) return mesesMostrados;

  const [anioPrimero, numeroPrimero] = primero.split('-').map(Number);
  const [anioHoy, numeroHoy] = mesDeHoy.split('-').map(Number);
  const cuantos = (anioHoy - anioPrimero) * 12 + (numeroHoy - numeroPrimero) + 1;
  return ultimosMeses(hoy, cuantos);
}

/** Instante inicial del mes siguiente a 'YYYY-MM', en Madrid. */
function inicioDelMesSiguiente(mes: string): Date {
  const [anio, numero] = mes.split('-').map(Number);
  const siguiente = numero === 12 ? `${anio + 1}-01` : `${anio}-${String(numero + 1).padStart(2, '0')}`;
  return inicioDiaMadrid(`${siguiente}-01`);
}

/** `[desde, hasta)` que cubre por completo esos meses, en horas de Madrid. */
export function rangoDeMeses(meses: string[]): { desde: Date; hasta: Date } {
  return {
    desde: inicioDiaMadrid(`${meses[0]}-01`),
    hasta: inicioDelMesSiguiente(meses[meses.length - 1]),
  };
}

/** `[1 de enero, 1 de enero siguiente)` del ejercicio, en horas de Madrid. */
export function rangoDelEjercicio(anio: number): { desde: Date; hasta: Date } {
  return {
    desde: inicioDiaMadrid(`${anio}-01-01`),
    hasta: inicioDiaMadrid(`${anio + 1}-01-01`),
  };
}
