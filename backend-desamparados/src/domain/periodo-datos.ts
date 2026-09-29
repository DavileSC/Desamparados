import { diaMadrid, inicioDiaMadrid } from './contabilidad.js';
import { sabadoDePasion } from './curso.js';
import { HttpError } from '../utils/error.handle.js';

/**
 * El periodo de «Datos e informes»: un curso (de un Sábado de Pasión al
 * siguiente) o un ejercicio (del 1 de enero al 31 de diciembre).
 *
 * Los cursos no se pisan: el curso 2025–2026 empieza el día DESPUÉS del Sábado
 * de Pasión de 2025 y termina con el de 2026, incluido. La estación de ese día
 * cierra el curso, así que se cuenta en el que acaba, no en el que empieza. Es
 * distinto del camino del Inicio (`rangoDelCurso`), que enseña los dos sábados
 * porque dibuja, no suma.
 */
export interface Periodo {
  /** `curso-2025` o `ejercicio-2026`: lo que viaja en `?periodo=`. */
  clave: string;
  tipo: 'curso' | 'ejercicio';
  /** El año en que empieza. */
  anio: number;
  /** «Curso 2025–2026», «Ejercicio 2026». */
  etiqueta: string;
  /** Primer y último día, en `AAAA-MM-DD` (los dos incluidos). */
  desde: string;
  hasta: string;
  /** Instantes para las consultas: [inicio, fin). */
  inicio: Date;
  fin: Date;
  /** Si hoy cae dentro: las cifras son «hasta hoy», no del periodo entero. */
  enCurso: boolean;
  /** La salida del Sábado de Pasión que le toca: la que cierra el curso, o la del año. */
  anioPasion: number;
  /** El Rosario vespertino de octubre que cae dentro. */
  anioRosario: number;
  /** Los meses que recorre, en `AAAA-MM`. */
  meses: string[];
}

const siguiente = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
};

function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = [];
  let [a, m] = desde.split('-').map(Number);
  const [af, mf] = hasta.split('-').map(Number);
  while (a < af || (a === af && m <= mf)) {
    meses.push(`${a}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; a += 1; }
  }
  return meses;
}

export function periodoDe(tipo: 'curso' | 'ejercicio', anio: number, hoy: Date): Periodo {
  const diaHoy = diaMadrid(hoy);
  const desde = tipo === 'curso' ? siguiente(sabadoDePasion(anio)) : `${anio}-01-01`;
  const hasta = tipo === 'curso' ? sabadoDePasion(anio + 1) : `${anio}-12-31`;
  return {
    clave: `${tipo}-${anio}`,
    tipo,
    anio,
    etiqueta: tipo === 'curso' ? `Curso ${anio}–${anio + 1}` : `Ejercicio ${anio}`,
    desde,
    hasta,
    inicio: inicioDiaMadrid(desde),
    fin: inicioDiaMadrid(siguiente(hasta)),
    enCurso: diaHoy >= desde && diaHoy <= hasta,
    anioPasion: tipo === 'curso' ? anio + 1 : anio,
    anioRosario: anio,
    meses: mesesEntre(desde, hasta),
  };
}

/** El curso en el que cae hoy, por el año en que empezó. */
export function cursoDeHoy(hoy: Date): number {
  const diaHoy = diaMadrid(hoy);
  const anio = Number(diaHoy.slice(0, 4));
  return diaHoy > sabadoDePasion(anio) ? anio : anio - 1;
}

/** Antes no hay nada que enseñar. */
export const ANIO_MINIMO_DATOS = 2000;

/**
 * Lee `?periodo=`. Sin valor, el curso en marcha. Cualquier otra cosa que no
 * sea `curso-AAAA` o `ejercicio-AAAA` de un año con sentido es un 400.
 */
export function leerPeriodo(valor: unknown, hoy: Date): Periodo {
  if (valor === undefined || valor === null || valor === '') return periodoDe('curso', cursoDeHoy(hoy), hoy);
  const coincide = /^(curso|ejercicio)-(\d{4})$/.exec(String(valor).trim());
  const tipo = coincide?.[1] as 'curso' | 'ejercicio' | undefined;
  const anio = Number(coincide?.[2]);
  const tope = tipo === 'curso' ? cursoDeHoy(hoy) : Number(diaMadrid(hoy).slice(0, 4));
  if (!tipo || anio < ANIO_MINIMO_DATOS || anio > tope) {
    throw new HttpError('El periodo tiene que ser un curso o un ejercicio que ya haya empezado (por ejemplo, curso-2025 o ejercicio-2026).', 400);
  }
  return periodoDe(tipo, anio, hoy);
}

/** El mismo tipo de periodo, un año antes: para comparar. */
export const periodoAnterior = (p: Periodo, hoy: Date) => periodoDe(p.tipo, p.anio - 1, hoy);

/** Los que se ofrecen en el desplegable: el curso y el ejercicio en marcha y los cinco anteriores de cada uno. */
export function periodosDisponibles(hoy: Date): { clave: string; etiqueta: string }[] {
  const curso = cursoDeHoy(hoy);
  const ejercicio = Number(diaMadrid(hoy).slice(0, 4));
  const lista = (tipo: 'curso' | 'ejercicio', desde: number) =>
    Array.from({ length: 6 }, (_, i) => desde - i)
      .filter((a) => a >= ANIO_MINIMO_DATOS)
      .map((a) => ({ clave: `${tipo}-${a}`, etiqueta: tipo === 'curso' ? `Curso ${a}–${a + 1}` : `Ejercicio ${a}` }));
  return [...lista('curso', curso), ...lista('ejercicio', ejercicio)];
}
