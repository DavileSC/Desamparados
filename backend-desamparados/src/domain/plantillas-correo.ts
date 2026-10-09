/**
 * Las plantillas de los correos, sin base de datos ni HTML: qué usos hay, qué
 * campos y bloques admite cada uno, y cómo se lee el texto que escribe
 * Secretaría.
 *
 * El formato es a propósito pobre, para que se escriba sin saber HTML y no se
 * pueda romper la maqueta:
 *
 * - Párrafos separados por una línea en blanco; un salto simple, salto de línea.
 * - `**negrita**`.
 * - Un bloque cuyas líneas empiezan por «- » es una lista.
 * - Un bloque cuyas líneas empiezan por «> » es un recuadro; si su primera
 *   línea va entera en negrita, es el título del recuadro.
 * - Un bloque que es solo `[[clave]]` es un bloque fijo que pone el sistema
 *   (la papeleta, el enlace, la tabla del pedido…).
 * - `{{clave}}` es un campo que se rellena con los datos de cada correo.
 */
import catalogo from '../../../shared/usos-de-correo.json' with { type: 'json' };

export interface CampoDeUso { clave: string; ayuda: string; ejemplo?: string }
export interface BloqueDeUso { clave: string; ayuda: string; obligatorio?: boolean }
export interface TextoDePlantilla { asunto: string; titulo: string; cuerpo: string; despedida: string }

export interface UsoDeCorreo {
  clave: string;
  grupo: string;
  nombre: string;
  descripcion: string;
  antetitulo: string;
  firma: string;
  /** Las plantillas libres no van con ningún correo automático: son para empezar un aviso. */
  libre?: boolean;
  campos: CampoDeUso[];
  bloques: BloqueDeUso[];
  porDefecto: TextoDePlantilla;
}

export const USOS: UsoDeCorreo[] = catalogo.usos as UsoDeCorreo[];
export const CAMPOS_COMUNES: CampoDeUso[] = catalogo.comunes;

export type ClaveDeUso =
  | 'contrasena_recuperar' | 'contrasena_cuenta_nueva' | 'primer_acceso_invitacion' | 'contrasena_cambiada' | 'doble_factor_bloqueado'
  | 'solicitud_recibida' | 'solicitud_no_tramitada' | 'alta_aprobada' | 'solicitud_rechazada'
  | 'baja' | 'baja_impago' | 'apertura' | 'papeleta'
  | 'papeleta_sin_recoger' | 'donativo_gracias' | 'apadrinamiento' | 'pedido_tienda' | 'certificado_donativos'
  | 'pesame' | 'sufragio' | 'libre';

export function usoDe(clave: string): UsoDeCorreo | undefined {
  return USOS.find((u) => u.clave === clave);
}

// ------------------------------------------------------------ la lectura

export type Trozo = { tipo: 'texto'; texto: string } | { tipo: 'negrita'; texto: string };

export type Bloque =
  | { tipo: 'parrafo'; lineas: string[] }
  | { tipo: 'lista'; elementos: string[] }
  | { tipo: 'recuadro'; titulo: string | null; bloques: Bloque[] }
  | { tipo: 'fijo'; clave: string };

const FIJO = /^\[\[([a-z_]+)\]\]$/;

/** El cuerpo, bloque a bloque. */
export function leerCuerpo(cuerpo: string): Bloque[] {
  const trozos = cuerpo.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return trozos.map(leerBloque);
}

function leerBloque(texto: string): Bloque {
  const lineas = texto.split('\n').map((l) => l.trimEnd());
  const fijo = FIJO.exec(texto.trim());
  if (fijo) return { tipo: 'fijo', clave: fijo[1] };
  if (lineas.every((l) => l.startsWith('>'))) {
    const dentro = lineas.map((l) => l.replace(/^>\s?/, ''));
    const primera = /^\*\*(.+)\*\*$/.exec(dentro[0]?.trim() ?? '');
    const resto = primera ? dentro.slice(1) : dentro;
    return { tipo: 'recuadro', titulo: primera ? primera[1].trim() : null, bloques: resto.length ? leerCuerpo(resto.join('\n')) : [] };
  }
  if (lineas.every((l) => /^-\s+/.test(l))) return { tipo: 'lista', elementos: lineas.map((l) => l.replace(/^-\s+/, '')) };
  return { tipo: 'parrafo', lineas };
}

/** Una línea en trozos de texto y de negrita. */
export function leerLinea(linea: string): Trozo[] {
  const trozos: Trozo[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let desde = 0;
  for (const m of linea.matchAll(re)) {
    if (m.index! > desde) trozos.push({ tipo: 'texto', texto: linea.slice(desde, m.index) });
    trozos.push({ tipo: 'negrita', texto: m[1] });
    desde = m.index! + m[0].length;
  }
  if (desde < linea.length) trozos.push({ tipo: 'texto', texto: linea.slice(desde) });
  return trozos;
}

/** Cambia cada `{{campo}}` por su valor. Lo que no se conoce se queda vacío (la revisión ya lo avisó al guardar). */
export const rellenar = (texto: string, campos: Record<string, string>) =>
  texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, clave: string) => campos[clave] ?? '');

// ------------------------------------------------------------ la revisión

/**
 * Lo que impide guardar una plantilla: campos o bloques que ese correo no
 * tiene (un error de escritura que dejaría un hueco), bloques obligatorios
 * que faltan (una papeleta sin la papeleta) o textos vacíos.
 */
export function problemasDePlantilla(uso: UsoDeCorreo, t: TextoDePlantilla): string[] {
  const problemas: string[] = [];
  if (!t.asunto.trim()) problemas.push('Falta el asunto.');
  if (!uso.libre && !t.titulo.trim()) problemas.push('Falta el título.');
  if (!t.cuerpo.trim()) problemas.push('Falta el texto.');
  const campos = new Set([...CAMPOS_COMUNES, ...uso.campos].map((c) => c.clave));
  const desconocidos = new Set<string>();
  for (const texto of [t.asunto, t.titulo, t.cuerpo, t.despedida]) {
    for (const m of texto.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) if (!campos.has(m[1])) desconocidos.add(m[1]);
  }
  for (const c of desconocidos) problemas.push(`Este correo no tiene el campo {{${c}}}.`);
  const bloques = new Set(uso.bloques.map((b) => b.clave));
  const usados = new Set<string>();
  for (const m of t.cuerpo.matchAll(/\[\[\s*([^\]]*?)\s*\]\]/g)) {
    if (!bloques.has(m[1])) problemas.push(`Este correo no tiene el bloque [[${m[1]}]].`);
    usados.add(m[1]);
  }
  for (const b of uso.bloques) if (b.obligatorio && !usados.has(b.clave)) problemas.push(`Falta el bloque [[${b.clave}]]: ${b.ayuda.charAt(0).toLowerCase()}${b.ayuda.slice(1)}.`);
  // Un bloque fijo dentro de un párrafo no se pinta: tiene que ir solo en su línea, con una línea en blanco antes y después.
  for (const m of t.cuerpo.matchAll(/[^\n]\[\[|\]\][^\n]/g)) { problemas.push('Cada bloque [[…]] va solo, en su propia línea.'); void m; break; }
  return problemas;
}

/** El texto plano del cuerpo, para el resumen que enseñan los buzones junto al asunto. */
export function resumenDe(cuerpo: string, campos: Record<string, string>, largo = 140): string {
  const primero = leerCuerpo(cuerpo).find((b): b is Extract<Bloque, { tipo: 'parrafo' }> => b.tipo === 'parrafo' && !/^\{\{\s*saludo\s*\}\}$/.test(b.lineas.join(' ').trim()));
  const texto = primero ? rellenar(primero.lineas.join(' '), campos).replace(/\*\*/g, '') : '';
  return texto.length > largo ? `${texto.slice(0, largo - 1).trimEnd()}…` : texto;
}
