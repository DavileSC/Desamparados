/**
 * El Modelo 182 (declaración informativa de donativos) sin base de datos: a
 * quién se declara, con qué porcentaje y cómo se escribe el fichero que se
 * sube a la Sede de la Agencia Tributaria.
 *
 * El formato es el del diseño de registro oficial (ejercicio 2024 en
 * adelante): líneas de 250 caracteres, una del declarante (tipo 1) y una por
 * declarado y porcentaje (tipo 2); números a la derecha con ceros,
 * textos a la izquierda con blancos, en mayúsculas y sin tildes.
 */
import { naturalezaDelNif } from './nif.js';

/**
 * Los porcentajes de la Ley 49/2002 (art. 19 y 20) desde 2024 (RDL 6/2023).
 * Si cambian, se cambian aquí: el fichero solo lleva el porcentaje.
 *
 * Personas físicas: 80 % de los primeros 250 €, 40 % del resto (45 % si es
 * donante recurrente). En el fichero va el del tramo que pasa de 250 €, o el
 * 80 % si no llega (lo dice así el diseño de registro). Entidades: 40 %
 * (50 % si es recurrente).
 */
const PORCENTAJES = {
  fisicaHasta250: 80,
  fisica: 40,
  fisicaRecurrente: 45,
  juridica: 40,
  juridicaRecurrente: 50,
  /** El tramo de las personas físicas que va al 80 %, en céntimos. */
  tramoCentimos: 250_00,
} as const;

/** Lo pagado por un donante en un ejercicio, de una de las procedencias. */
export interface Aportacion {
  nif: string;
  /** El NIF de su padre, madre o tutor, si es menor de 14 años. */
  nifRepresentante: string | null;
  /** Como lo pide Hacienda: primer apellido, segundo apellido y nombre. */
  apellidosYNombre: string;
  /** Como se escribe en el certificado: «Ana Ruiz Gil». */
  nombre: string;
  codigoPostal: string | null;
  /** Adonde mandarle el certificado, si se sabe. */
  email: string | null;
  /**
   * La cuenta de la web de la que sale, en los recibos de hermanos. Los pagos
   * en línea no la tienen: solo el correo que se dio al pagar.
   */
  userId?: number;
  centimos: number;
  /** El día (AAAA-MM-DD): decide el ejercicio. */
  fecha: string;
  concepto: string;
}

export interface Declarado {
  nif: string;
  nifRepresentante: string | null;
  apellidosYNombre: string;
  nombre: string;
  email: string | null;
  /** Dos cifras, o null si no hay código postal del que sacarla. */
  provincia: string | null;
  naturaleza: 'F' | 'J' | 'E';
  centimos: number;
  porcentaje: number;
  recurrente: boolean;
  aportaciones: Aportacion[];
}

const anioDe = (a: Aportacion) => Number(a.fecha.slice(0, 4));

/**
 * Las provincias se numeran igual que empiezan los códigos postales (01
 * Álava… 29 Málaga… 52 Melilla), así que el código postal basta.
 */
export function provinciaDelCodigoPostal(cp: string | null): string | null {
  const m = /^(\d{2})\d{3}$/.exec(cp?.trim() ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 52 ? m[1] : null;
}

/**
 * Recurrente: dio en los dos ejercicios anteriores, y en cada uno lo mismo o
 * más que en el anterior a él. Por eso hacen falta tres ejercicios hacia atrás.
 */
export function esRecurrente(porAnio: Map<number, number>, ejercicio: number): boolean {
  const a1 = porAnio.get(ejercicio - 1) ?? 0;
  const a2 = porAnio.get(ejercicio - 2) ?? 0;
  const a3 = porAnio.get(ejercicio - 3) ?? 0;
  return a1 > 0 && a2 > 0 && a1 >= a2 && a2 >= a3;
}

export function porcentajeDe(naturaleza: 'F' | 'J' | 'E', centimos: number, recurrente: boolean): number {
  // Las entidades en atribución de rentas no deducen: lo hacen sus socios, personas físicas.
  if (naturaleza === 'J') return recurrente ? PORCENTAJES.juridicaRecurrente : PORCENTAJES.juridica;
  if (centimos <= PORCENTAJES.tramoCentimos) return PORCENTAJES.fisicaHasta250;
  return recurrente ? PORCENTAJES.fisicaRecurrente : PORCENTAJES.fisica;
}

/**
 * Los declarados de un ejercicio. Llegan las aportaciones de ese año y de
 * los tres anteriores (para saber si es recurrente); se junta todo lo de un
 * mismo NIF, venga de donde venga, y el nombre y la provincia salen de la
 * última aportación, que es la que tiene los datos al día.
 */
export function declaradosDelEjercicio(aportaciones: Aportacion[], ejercicio: number): Declarado[] {
  const porNif = new Map<string, Aportacion[]>();
  for (const a of aportaciones) porNif.set(a.nif, [...(porNif.get(a.nif) ?? []), a]);

  const declarados: Declarado[] = [];
  for (const [nif, todas] of porNif) {
    const delAnio = todas.filter((a) => anioDe(a) === ejercicio).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (delAnio.length === 0) continue;
    const porAnio = new Map<number, number>();
    for (const a of todas) porAnio.set(anioDe(a), (porAnio.get(anioDe(a)) ?? 0) + a.centimos);
    const centimos = porAnio.get(ejercicio)!;
    if (centimos <= 0) continue;
    const ultima = delAnio[delAnio.length - 1];
    const naturaleza = naturalezaDelNif(nif);
    const recurrente = esRecurrente(porAnio, ejercicio);
    declarados.push({
      nif,
      nifRepresentante: naturaleza === 'F' ? ultima.nifRepresentante : null,
      apellidosYNombre: ultima.apellidosYNombre,
      nombre: ultima.nombre,
      email: delAnio.map((a) => a.email).filter(Boolean).pop() ?? null,
      provincia: provinciaDelCodigoPostal(delAnio.map((a) => a.codigoPostal).filter(Boolean).pop() ?? null),
      naturaleza,
      centimos,
      porcentaje: porcentajeDe(naturaleza, centimos, recurrente),
      recurrente,
      aportaciones: delAnio,
    });
  }
  return declarados.sort((a, b) => a.apellidosYNombre.localeCompare(b.apellidosYNombre, 'es') || a.nif.localeCompare(b.nif));
}

// ------------------------------------------------------------- el fichero

/** «Muñoz Pérez» → «MUÑOZ PEREZ»: sin tildes ni signos, en mayúsculas. La Ñ y la Ç se quedan. */
export function textoAeat(texto: string): string {
  return texto
    .toUpperCase()
    .replace(/Ñ/g, '\u0001').replace(/Ç/g, '\u0002')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'Ñ').replace(/\u0002/g, 'Ç')
    .replace(/[^A-Z0-9ÑÇ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Primer apellido, segundo y nombre, como pide el campo de Hacienda (`apellidos` ya lleva los dos en orden). */
export const apellidosYNombre = (p: { apellidos: string; nombre: string }) => textoAeat(`${p.apellidos} ${p.nombre}`);

const alfa = (texto: string, largo: number) => textoAeat(texto).slice(0, largo).padEnd(largo, ' ');
const num = (n: number | string, largo: number) => String(n).padStart(largo, '0').slice(-largo);
/** Un NIF a la derecha, con ceros delante (así lo pide el diseño). En blanco si no hay. */
const nifCampo = (nif: string | null) => (nif ? num(nif, 9) : ' '.repeat(9));
/** Céntimos → parte entera y dos decimales, sin coma. */
const importe = (centimos: number, enteros: number) => num(Math.floor(centimos / 100), enteros) + num(centimos % 100, 2);
const porcentajeCampo = (p: number) => num(Math.floor(p), 3) + num(Math.round((p % 1) * 100), 2);

interface Declarante {
  nif: string;
  denominacion: string;
  /** Nueve cifras. */
  telefono: string;
  /** La persona con quien hablar: apellidos y nombre. */
  contacto: string;
  /** Trece cifras: lo pone el declarante, empezando por 182. */
  justificante: string;
}

function registroDeclarante(d: Declarante, ejercicio: number, declarados: Declarado[]): string {
  const total = declarados.reduce((s, x) => s + x.centimos, 0);
  const linea =
    '1' + '182' + num(ejercicio, 4) + nifCampo(d.nif) + alfa(d.denominacion, 40) + 'T' +
    num(d.telefono.replace(/\D/g, ''), 9) + alfa(d.contacto, 40) + num(d.justificante, 13) +
    '  ' + num(0, 13) + num(declarados.length, 9) + importe(total, 13) +
    // Naturaleza 1: entidad beneficiaria del mecenazgo (Título III de la Ley 49/2002).
    '1' + ' '.repeat(77) + ' '.repeat(13);
  return linea;
}

function registroDeclarado(d: Declarante, ejercicio: number, x: Declarado): string {
  return (
    '2' + '182' + num(ejercicio, 4) + nifCampo(d.nif) + nifCampo(x.nif) + nifCampo(x.nifRepresentante) +
    alfa(x.apellidosYNombre, 40) + num(x.provincia ?? '99', 2) +
    // Clave A: donativos no incluidos en actividades prioritarias de mecenazgo.
    'A' + porcentajeCampo(x.porcentaje) + importe(x.centimos, 11) +
    ' ' + // en especie: no
    '00' + num(0, 5) + // sin deducción autonómica
    x.naturaleza + ' ' + num(0, 4) + ' ' + ' '.repeat(20) +
    (x.recurrente ? '1' : '2') +
    ' '.repeat(9) + ' '.repeat(40) + ' '.repeat(69)
  );
}

/** El fichero entero: CRLF entre líneas, como lo espera la Sede. */
export function ficheroModelo182(d: Declarante, ejercicio: number, declarados: Declarado[]): string {
  const lineas = [registroDeclarante(d, ejercicio, declarados), ...declarados.map((x) => registroDeclarado(d, ejercicio, x))];
  for (const l of lineas) if (l.length !== 250) throw new Error(`Línea del Modelo 182 de ${l.length} caracteres en vez de 250.`);
  return lineas.join('\r\n') + '\r\n';
}

/** El número de justificante que se propone: 182, el ejercicio y un 1 al final. */
export const justificantePorDefecto = (ejercicio: number) => `182${ejercicio}${'1'.padStart(6, '0')}`;
