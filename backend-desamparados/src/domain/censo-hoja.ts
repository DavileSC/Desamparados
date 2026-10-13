import { type } from 'arktype';
import { dni as dniSchema, esIbanValido, normalizarIban } from '../config/common';
import { componerApellidos, partirApellidos } from './apellidos';
import { esDiaValido } from './contabilidad';

/**
 * El censo en una hoja de cálculo: las columnas que se exportan y las que se
 * reconocen al importar, y cómo se lee cada fila.
 *
 * Lo que trae otra corporación es su Excel de siempre, con sus títulos («Nº»,
 * «NIF», «Localidad», «F. alta»…). Por eso cada columna admite varios nombres,
 * sin tildes ni mayúsculas, y lo que se exporta usa los títulos de aquí, que
 * se vuelven a importar tal cual.
 *
 * Todo puro: lo que depende de la base (DNI ya en el censo, número ocupado)
 * lo comprueba el servicio.
 */

const COLUMNAS = [
  { clave: 'numeroHermano', titulo: 'Número', otros: ['n', 'no', 'num', 'numero de hermano', 'n de hermano', 'n hermano', 'numero hermano'] },
  { clave: 'nombre', titulo: 'Nombre', otros: [] },
  { clave: 'primerApellido', titulo: 'Primer apellido', otros: ['apellido 1', 'apellido1', '1 apellido', '1er apellido'] },
  { clave: 'segundoApellido', titulo: 'Segundo apellido', otros: ['apellido 2', 'apellido2', '2 apellido'] },
  { clave: 'apellidos', titulo: 'Apellidos', otros: [] },
  { clave: 'dni', titulo: 'DNI', otros: ['nif', 'nie', 'dni nie', 'documento'] },
  { clave: 'fechaNacimiento', titulo: 'Fecha de nacimiento', otros: ['nacimiento', 'f nacimiento', 'fecha nacimiento', 'fecha nac'] },
  { clave: 'sexo', titulo: 'Sexo', otros: [] },
  { clave: 'telefono', titulo: 'Teléfono', otros: ['movil', 'telefono movil', 'tlf', 'tfno'] },
  { clave: 'email', titulo: 'Correo', otros: ['email', 'e mail', 'correo electronico', 'mail'] },
  { clave: 'direccion', titulo: 'Dirección', otros: ['domicilio', 'calle'] },
  { clave: 'poblacion', titulo: 'Población', otros: ['localidad', 'municipio', 'ciudad'] },
  { clave: 'codigoPostal', titulo: 'Código postal', otros: ['cp', 'c p', 'codigo postal'] },
  { clave: 'provincia', titulo: 'Provincia', otros: [] },
  { clave: 'fechaAlta', titulo: 'Fecha de alta', otros: ['alta', 'f alta', 'fecha alta', 'fecha de ingreso', 'ingreso'] },
  { clave: 'fechaBaja', titulo: 'Fecha de baja', otros: ['baja', 'f baja', 'fecha baja'] },
  { clave: 'iban', titulo: 'IBAN', otros: ['cuenta', 'cuenta bancaria', 'ccc', 'numero de cuenta'] },
  { clave: 'estado', titulo: 'Estado', otros: ['situacion'] },
] as const;

export type ClaveColumna = (typeof COLUMNAS)[number]['clave'];

/** Lo que sale al exportar, en este orden. Sin la cuenta: el censo no enseña los datos bancarios. */
export const COLUMNAS_EXPORTACION: ClaveColumna[] = [
  'numeroHermano', 'nombre', 'primerApellido', 'segundoApellido', 'dni', 'fechaNacimiento', 'sexo',
  'telefono', 'email', 'direccion', 'poblacion', 'codigoPostal', 'provincia', 'fechaAlta', 'fechaBaja', 'estado',
];

export const tituloDe = (clave: ClaveColumna) => COLUMNAS.find((c) => c.clave === clave)!.titulo;

/** «F. de Alta» → «f de alta», «N.I.F.» → «nif»: sin tildes, sin puntos ni signos, en minúsculas. */
function normalizarTitulo(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[º°ª.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const POR_TITULO = new Map<string, ClaveColumna>(
  COLUMNAS.flatMap((c) => [c.titulo, c.clave, ...c.otros].map((t) => [normalizarTitulo(t), c.clave] as [string, ClaveColumna])),
);

/** Qué columna es cada una de la cabecera. `null` si no se reconoce (se ignora). */
export function detectarColumnas(cabecera: unknown[]): (ClaveColumna | null)[] {
  const vistas = new Set<ClaveColumna>();
  return cabecera.map((celda) => {
    const clave = POR_TITULO.get(normalizarTitulo(texto(celda))) ?? null;
    // Una columna repetida (dos «Teléfono») vale la primera: la otra se ignora.
    if (!clave || vistas.has(clave)) return null;
    vistas.add(clave);
    return clave;
  });
}

// --- Valores de las celdas -----------------------------------------------

/** Lo que haya en una celda, como texto limpio. */
export function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return diaUtc(valor);
  return String(valor).replace(/\s+/g, ' ').trim();
}

const diaUtc = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Una fecha de la hoja → 'AAAA-MM-DD'. Excel la da como fecha; un CSV, como
 * «15/03/1990», «15-3-90» o «1990-03-15». Con dos cifras de año, las que
 * pasan del año en curso son del siglo pasado.
 */
export function leerFecha(valor: unknown, hoy: string): string | null {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : diaUtc(valor);
  const t = texto(valor);
  if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return fechaSiValida(m[1], m[2], m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  let anio = m[3];
  if (anio.length === 2) {
    const corto = Number(hoy.slice(2, 4));
    anio = `${Number(anio) > corto ? '19' : '20'}${anio}`;
  }
  return fechaSiValida(anio, m[2], m[1]);
}

function fechaSiValida(anio: string, mes: string, dia: string): string | null {
  const iso = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  return esDiaValido(iso) ? iso : null;
}

const SEXOS: Record<string, 'HOMBRE' | 'MUJER'> = { h: 'HOMBRE', hombre: 'HOMBRE', v: 'HOMBRE', varon: 'HOMBRE', m: 'MUJER', mujer: 'MUJER' };
const esCorreo = (t: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);

// --- Una fila ------------------------------------------------------------

export interface FichaImportada {
  fila: number;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  dni: string | null;
  fechaNacimiento: string;
  sexo: 'HOMBRE' | 'MUJER' | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  poblacion: string | null;
  codigoPostal: string | null;
  provincia: string | null;
  fechaAlta: string;
  fechaBaja: string | null;
  iban: string | null;
  numeroHermano: number | null;
}

type ResultadoFila = { ficha: FichaImportada } | { fila: number; errores: string[] };

/**
 * Lee una fila con las columnas ya detectadas. Junta todos los errores de la
 * fila a la vez: quien corrige el Excel lo hace de una pasada.
 */
export function leerFila(valores: unknown[], columnas: (ClaveColumna | null)[], fila: number, hoy: string): ResultadoFila {
  const celda = (clave: ClaveColumna) => {
    const i = columnas.indexOf(clave);
    return i === -1 ? undefined : valores[i];
  };
  const opcional = (clave: ClaveColumna, maximo = 150) => texto(celda(clave)).slice(0, maximo) || null;
  const errores: string[] = [];

  const nombre = texto(celda('nombre'));
  if (!nombre) errores.push('Falta el nombre.');

  let apellidos = componerApellidos(opcional('primerApellido'), opcional('segundoApellido'));
  if (!apellidos.primerApellido) apellidos = partirApellidos(opcional('apellidos'));
  if (!apellidos.primerApellido) errores.push('Faltan los apellidos.');

  const textoNacimiento = celda('fechaNacimiento');
  const fechaNacimiento = leerFecha(textoNacimiento, hoy);
  if (!fechaNacimiento) errores.push(texto(textoNacimiento) ? `La fecha de nacimiento «${texto(textoNacimiento)}» no se entiende.` : 'Falta la fecha de nacimiento.');
  else if (fechaNacimiento > hoy) errores.push('La fecha de nacimiento es posterior a hoy.');

  const textoDni = texto(celda('dni'));
  let dni: string | null = null;
  if (textoDni) {
    const leido = dniSchema(textoDni);
    if (leido instanceof type.errors) errores.push(`El DNI «${textoDni}» no es válido (revisa la letra).`);
    else dni = leido;
  }

  const email = opcional('email')?.toLowerCase() ?? null;
  if (email && !esCorreo(email)) errores.push(`El correo «${email}» no es válido.`);

  const textoSexo = normalizarTitulo(texto(celda('sexo')));
  const sexo = textoSexo ? SEXOS[textoSexo] ?? null : null;
  if (textoSexo && !sexo) errores.push(`El sexo «${texto(celda('sexo'))}» no se entiende (Hombre o Mujer).`);

  const textoAlta = celda('fechaAlta');
  const fechaAlta = texto(textoAlta) ? leerFecha(textoAlta, hoy) : hoy;
  if (!fechaAlta) errores.push(`La fecha de alta «${texto(textoAlta)}» no se entiende.`);
  else if (fechaAlta > hoy) errores.push('La fecha de alta es posterior a hoy.');

  const textoBaja = celda('fechaBaja');
  const fechaBaja = texto(textoBaja) ? leerFecha(textoBaja, hoy) : null;
  if (texto(textoBaja) && !fechaBaja) errores.push(`La fecha de baja «${texto(textoBaja)}» no se entiende.`);
  else if (fechaBaja && fechaAlta && fechaBaja < fechaAlta) errores.push('La fecha de baja es anterior a la de alta.');
  const estado = normalizarTitulo(texto(celda('estado')));
  if (!fechaBaja && (estado === 'baja' || estado === 'de baja')) errores.push('Está de baja, pero falta la fecha de baja.');

  const textoIban = texto(celda('iban'));
  let iban: string | null = null;
  if (textoIban) {
    const limpio = normalizarIban(textoIban);
    if (!esIbanValido(limpio)) errores.push('La cuenta no es un IBAN válido (revisa los dígitos de control).');
    else iban = limpio;
  }

  const textoNumero = texto(celda('numeroHermano'));
  const numeroHermano = textoNumero ? Number(textoNumero) : null;
  if (textoNumero && !(Number.isInteger(numeroHermano) && numeroHermano! > 0)) errores.push(`El número «${textoNumero}» no es un número de hermano.`);

  if (errores.length > 0) return { fila, errores };
  return {
    ficha: {
      fila, nombre: nombre.slice(0, 100), primerApellido: apellidos.primerApellido!, segundoApellido: apellidos.segundoApellido,
      dni, fechaNacimiento: fechaNacimiento!, sexo,
      telefono: opcional('telefono', 30), email, direccion: opcional('direccion', 191), poblacion: opcional('poblacion', 100),
      codigoPostal: opcional('codigoPostal', 10), provincia: opcional('provincia', 100),
      fechaAlta: fechaAlta!, fechaBaja, iban, numeroHermano,
    },
  };
}

/**
 * Las repeticiones dentro del propio fichero: el mismo DNI o el mismo número
 * dos veces, o la misma persona sin DNI (nombre, apellidos y nacimiento). La
 * segunda aparición es la que se queda fuera.
 */
export function quitarRepetidas(fichas: FichaImportada[]): { fichas: FichaImportada[]; errores: { fila: number; errores: string[] }[] } {
  const dnis = new Map<string, number>();
  const numeros = new Map<number, number>();
  const personas = new Map<string, number>();
  const buenas: FichaImportada[] = [];
  const errores: { fila: number; errores: string[] }[] = [];
  for (const f of fichas) {
    const persona = `${normalizarTitulo(f.nombre)}|${normalizarTitulo(`${f.primerApellido} ${f.segundoApellido ?? ''}`)}|${f.fechaNacimiento}`;
    const motivo = f.dni && dnis.has(f.dni) ? `El DNI ${f.dni} ya está en la fila ${dnis.get(f.dni)}.`
      : f.numeroHermano && numeros.has(f.numeroHermano) ? `El número ${f.numeroHermano} ya está en la fila ${numeros.get(f.numeroHermano)}.`
        : !f.dni && personas.has(persona) ? `Parece la misma persona de la fila ${personas.get(persona)}.`
          : null;
    if (motivo) { errores.push({ fila: f.fila, errores: [motivo] }); continue; }
    if (f.dni) dnis.set(f.dni, f.fila);
    if (f.numeroHermano) numeros.set(f.numeroHermano, f.fila);
    personas.set(persona, f.fila);
    buenas.push(f);
  }
  return { fichas: buenas, errores };
}

/** La clave con la que se reconoce a una persona sin DNI en el censo. */
export const clavePersona = (nombre: string, apellidos: string, fechaNacimiento: string) =>
  `${normalizarTitulo(nombre)}|${normalizarTitulo(apellidos)}|${fechaNacimiento}`;

// --- CSV -----------------------------------------------------------------

/**
 * Un CSV a filas de celdas. El separador se adivina por la cabecera: Excel en
 * español guarda con «;», otros programas con «,». Admite comillas y saltos
 * de línea dentro de ellas.
 */
export function leerCsv(contenido: string): string[][] {
  const limpio = contenido.replace(/^\uFEFF/, '');
  const primera = limpio.split(/\r?\n/, 1)[0] ?? '';
  const separador = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === separador) { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += c;
  }
  if (celda !== '' || fila.length > 0) { fila.push(celda); filas.push(fila); }
  // La «'» que pone `escribirCsv` delante de lo que parece una fórmula se
  // quita al volver a leerlo: un censo exportado e importado queda igual.
  return filas
    .filter((f) => f.some((c) => c.trim() !== ''))
    .map((f) => f.map((c) => (c.startsWith("'") && EMPIEZA_COMO_FORMULA.test(c.slice(1)) ? c.slice(1) : c)));
}

/**
 * Lo que Excel o LibreOffice leen como fórmula al abrir un CSV. Una dirección
 * escrita en el alta como «=HIPERVINCULO(…)» se ejecutaba en el ordenador de
 * Secretaría al abrir el censo exportado.
 */
const EMPIEZA_COMO_FORMULA = /^[=+\-@\t\r]/;

/**
 * Filas a CSV para Excel en español: «;», comillas cuando hacen falta y BOM
 * para las tildes. Un texto que empieza como una fórmula lleva delante «'», la
 * marca de «esto es texto» de las hojas de cálculo. Solo los textos: un número
 * de verdad (negativo incluido) no es una fórmula, y el censo no exporta
 * importes. El xlsx no lo necesita porque escribe cada celda como texto.
 */
export function escribirCsv(filas: (string | number | null)[][]): string {
  const celda = (v: string | number | null) => {
    const t = v === null ? '' : typeof v === 'string' && EMPIEZA_COMO_FORMULA.test(v) ? `'${v}` : String(v);
    return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return `\uFEFF${filas.map((f) => f.map(celda).join(';')).join('\r\n')}\r\n`;
}
