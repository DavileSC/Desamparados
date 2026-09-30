import { diaMadrid, inicioDiaMadrid } from './contabilidad.js';
import { HttpError } from '../utils/error.handle.js';

/**
 * El periodo de «Datos e informes» y del Informe anual: un año natural, del 1
 * de enero al 31 de diciembre. El Grupo Parroquial lleva así sus cuentas y su
 * vida; nada de cursos de Sábado de Pasión a Sábado de Pasión ni de septiembre
 * a agosto.
 *
 * Con el año en marcha, las cifras son «hasta hoy» y se comparan con el año
 * anterior hasta el mismo día: comparar nueve meses con doce hacía que a mitad
 * de año siempre pareciera que se iba peor.
 */
export interface Periodo {
  /** `2026`: lo que viaja en `?anio=`. */
  clave: string;
  anio: number;
  /** «2026». */
  etiqueta: string;
  /** Primer y último día, en `AAAA-MM-DD` (los dos incluidos). */
  desde: string;
  hasta: string;
  /** Instantes para las consultas: [inicio, fin). */
  inicio: Date;
  fin: Date;
  /** Si hoy cae dentro: las cifras son «hasta hoy», no del año entero. */
  enMarcha: boolean;
  /** Hasta qué día del año anterior se compara (`AAAA-MM-DD`), o `null` si el año ya se cerró y se compara entero. */
  comparaHasta: string | null;
  /** Los doce meses, en `AAAA-MM`. */
  meses: string[];
}

const siguiente = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
};

/** El mismo día un año antes; el 29 de febrero se queda en el 28. */
function unAnioAntes(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a - 1, m, 0)).getUTCDate();
  return `${a - 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

export function periodoDe(anio: number, hoy: Date): Periodo {
  const diaHoy = diaMadrid(hoy);
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;
  const enMarcha = diaHoy >= desde && diaHoy <= hasta;
  return {
    clave: String(anio),
    anio,
    etiqueta: String(anio),
    desde,
    hasta,
    inicio: inicioDiaMadrid(desde),
    fin: inicioDiaMadrid(siguiente(hasta)),
    enMarcha,
    comparaHasta: enMarcha ? unAnioAntes(diaHoy) : null,
    meses: Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`),
  };
}

export const anioDeHoy = (hoy: Date) => Number(diaMadrid(hoy).slice(0, 4));

/** Antes no hay nada que enseñar. */
export const ANIO_MINIMO_DATOS = 2000;

/** Lee `?anio=`. Sin valor, el año en marcha. Un año por venir o mal escrito es un 400. */
export function leerPeriodo(valor: unknown, hoy: Date): Periodo {
  if (valor === undefined || valor === null || valor === '') return periodoDe(anioDeHoy(hoy), hoy);
  const texto = String(valor).trim();
  const anio = Number(texto);
  if (!/^\d{4}$/.test(texto) || anio < ANIO_MINIMO_DATOS || anio > anioDeHoy(hoy)) {
    throw new HttpError('El año tiene que ser uno que ya haya empezado (por ejemplo, 2026).', 400);
  }
  return periodoDe(anio, hoy);
}

/**
 * Con qué se compara: el año anterior entero o, si este va en marcha, el
 * anterior hasta el mismo día (incluido).
 */
export function periodoAnterior(p: Periodo, hoy: Date): { inicio: Date; fin: Date } {
  const antes = periodoDe(p.anio - 1, hoy);
  return { inicio: antes.inicio, fin: p.comparaHasta ? inicioDiaMadrid(siguiente(p.comparaHasta)) : antes.fin };
}

/** Los que se ofrecen en el desplegable: el año en marcha y los cinco anteriores. */
export function periodosDisponibles(hoy: Date): { clave: string; etiqueta: string }[] {
  const actual = anioDeHoy(hoy);
  return Array.from({ length: 6 }, (_, i) => actual - i)
    .filter((a) => a >= ANIO_MINIMO_DATOS)
    .map((a) => ({ clave: String(a), etiqueta: a === actual ? `${a} (en marcha)` : String(a) }));
}
