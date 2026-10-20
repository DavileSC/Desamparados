/**
 * Las plantillas de los correos, sin base de datos ni HTML: qué usos hay, qué
 * campos y bloques admite cada uno, de qué piezas se compone un correo y qué
 * impide guardarlo.
 *
 * Una plantilla es una lista de piezas de una paleta cerrada (texto, lista,
 * recuadro, oración, botón, foto, separador y los bloques que pone la web).
 * Cerrada a propósito: cada pieza tiene una sola forma de pintarse, probada en
 * Gmail, Outlook y el móvil, y quien escribe no puede romper la maqueta.
 * Dentro del texto, `{{clave}}` es un campo que se rellena con los datos de
 * cada correo; el editor lo enseña como una pastilla con su nombre.
 *
 * Los textos originales del catálogo (`shared/usos-de-correo.json`) siguen en
 * el formato de texto de antes, que se escribe a mano sin saber HTML, y las
 * plantillas guardadas antes de las piezas también: `leerCuerpo` los pasa a
 * piezas al leerlos.
 *
 * - Párrafos separados por una línea en blanco; un salto simple, salto de línea.
 * - `**negrita**`.
 * - Un bloque cuyas líneas empiezan por «- » es una lista.
 * - Un bloque cuyas líneas empiezan por «> » es un recuadro; si su primera
 *   línea va entera en negrita, es el título del recuadro.
 * - Un bloque que es solo `[[clave]]` es un bloque fijo que pone el sistema
 *   (la papeleta, el enlace, la tabla del pedido…).
 */
import catalogo from '../../../shared/usos-de-correo.json' with { type: 'json' };

export interface CampoDeUso { clave: string; etiqueta: string; ayuda: string; ejemplo?: string }
export interface BloqueDeUso { clave: string; ayuda: string; obligatorio?: boolean }
/** El texto original de un uso, tal como se escribe en el catálogo. */
export interface TextoDePlantilla { asunto: string; titulo: string; cuerpo: string; despedida: string }

/** Un trozo de texto con su formato. `texto` puede llevar saltos de línea y campos. */
export interface Trozo { texto: string; negrita?: boolean; cursiva?: boolean; enlace?: string }
export type Linea = Trozo[];

export type PiezaDeTexto = { tipo: 'parrafo'; trozos: Linea } | { tipo: 'lista'; elementos: Linea[] };
export type Pieza =
  | PiezaDeTexto
  | { tipo: 'recuadro'; titulo: string; piezas: PiezaDeTexto[] }
  | { tipo: 'oracion'; trozos: Linea }
  | { tipo: 'boton'; texto: string; enlace: string }
  | { tipo: 'foto'; src: string; alt: string; pie: string }
  | { tipo: 'separador' }
  | { tipo: 'fijo'; clave: string };

/** Una plantilla tal como se edita y se guarda. */
export interface PlantillaDeCorreo {
  asunto: string;
  /** Lo que la bandeja enseña junto al asunto. Vacío, el primer párrafo. */
  resumen: string;
  titulo: string;
  contenido: Pieza[];
  despedida: string;
}

interface UsoDelCatalogo {
  clave: string;
  grupo: string;
  nombre: string;
  descripcion: string;
  antetitulo: string;
  firma: string;
  libre?: boolean;
  campos: CampoDeUso[];
  bloques: BloqueDeUso[];
  porDefecto: TextoDePlantilla;
}

export interface UsoDeCorreo extends Omit<UsoDelCatalogo, 'porDefecto'> {
  /** Las plantillas libres no van con ningún correo automático: son para empezar un aviso. */
  libre?: boolean;
  /** El texto original, ya en piezas: es lo que sale sin plantilla en uso. */
  porDefecto: PlantillaDeCorreo;
}

export type ClaveDeUso =
  | 'contrasena_recuperar' | 'contrasena_cuenta_nueva' | 'primer_acceso_invitacion' | 'contrasena_cambiada' | 'doble_factor_bloqueado'
  | 'cuenta_bancaria_cambiada'
  | 'solicitud_recibida' | 'solicitud_no_tramitada' | 'alta_aprobada' | 'solicitud_rechazada'
  | 'baja' | 'baja_impago' | 'apertura'
  | 'papeleta_sin_recoger' | 'cita_manana' | 'donativo_gracias' | 'apadrinamiento' | 'pedido_tienda' | 'certificado_donativos'
  | 'cargo_domiciliado' | 'justificante_pago' | 'pago_devuelto'
  | 'pesame' | 'sufragio' | 'libre';

// ------------------------------------------------------------ la lectura del formato de texto

const FIJO = /^\[\[([a-z_]+)\]\]$/;

/** Un cuerpo en el formato de texto, pieza a pieza. */
export function leerCuerpo(cuerpo: string): Pieza[] {
  const trozos = cuerpo.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return trozos.map(leerBloque);
}

function leerBloque(texto: string): Pieza {
  const lineas = texto.split('\n').map((l) => l.trimEnd());
  const fijo = FIJO.exec(texto.trim());
  if (fijo) return { tipo: 'fijo', clave: fijo[1] };
  if (lineas.every((l) => l.startsWith('>'))) {
    const dentro = lineas.map((l) => l.replace(/^>\s?/, ''));
    const primera = /^\*\*(.+)\*\*$/.exec(dentro[0]?.trim() ?? '');
    const resto = primera ? dentro.slice(1) : dentro;
    // Dentro de un recuadro solo hay texto y listas: un recuadro anidado o un
    // bloque fijo se quedan como el texto que eran.
    const piezas = resto.length ? leerCuerpo(resto.join('\n')).map((p): PiezaDeTexto => (p.tipo === 'parrafo' || p.tipo === 'lista' ? p : { tipo: 'parrafo', trozos: [{ texto: textoPlano(p) }] })) : [];
    return { tipo: 'recuadro', titulo: primera ? primera[1].trim() : '', piezas };
  }
  if (lineas.every((l) => /^-\s+/.test(l))) return { tipo: 'lista', elementos: lineas.map((l) => leerLinea(l.replace(/^-\s+/, ''))) };
  return { tipo: 'parrafo', trozos: leerLinea(lineas.join('\n')) };
}

/** Una línea en trozos de texto y de negrita. */
export function leerLinea(linea: string): Linea {
  const trozos: Linea = [];
  const re = /\*\*(.+?)\*\*/gs;
  let desde = 0;
  for (const m of linea.matchAll(re)) {
    if (m.index! > desde) trozos.push({ texto: linea.slice(desde, m.index) });
    trozos.push({ texto: m[1], negrita: true });
    desde = m.index! + m[0].length;
  }
  if (desde < linea.length) trozos.push({ texto: linea.slice(desde) });
  return trozos;
}

const textoDeLinea = (l: Linea) => l.map((t) => t.texto).join('');

/** El texto de una pieza, sin formato: para el resumen y para convertir lo que no cabe. */
export function textoPlano(p: Pieza): string {
  switch (p.tipo) {
    case 'parrafo': case 'oracion': return textoDeLinea(p.trozos);
    case 'lista': return p.elementos.map(textoDeLinea).join('\n');
    case 'recuadro': return [p.titulo, ...p.piezas.map(textoPlano)].filter(Boolean).join('\n');
    case 'boton': return p.texto;
    case 'foto': return p.pie;
    case 'separador': return '';
    case 'fijo': return `[[${p.clave}]]`;
  }
}

/** Del formato de texto del catálogo a una plantilla en piezas. */
export const dePlantillaDeTexto = (t: TextoDePlantilla, resumen = ''): PlantillaDeCorreo => ({
  asunto: t.asunto, resumen, titulo: t.titulo, contenido: leerCuerpo(t.cuerpo), despedida: t.despedida,
});

export const USOS: UsoDeCorreo[] = (catalogo.usos as UsoDelCatalogo[]).map((u) => ({ ...u, porDefecto: dePlantillaDeTexto(u.porDefecto) }));
export const CAMPOS_COMUNES: CampoDeUso[] = catalogo.comunes;

export function usoDe(clave: string): UsoDeCorreo | undefined {
  return USOS.find((u) => u.clave === clave);
}

/** Cambia cada `{{campo}}` por su valor. Lo que no se conoce se queda vacío (la revisión ya lo avisó al guardar). */
export const rellenar = (texto: string, campos: Record<string, string>) =>
  texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, clave: string) => campos[clave] ?? '');

// ------------------------------------------------------------ los enlaces y las fotos

/**
 * Un enlace que se puede poner en un correo: una página de la web (`/hermanos`),
 * una dirección segura o un correo. Nada de `javascript:` ni de `http://`, que
 * los lectores de correo marcan como peligroso.
 */
export function enlaceValido(enlace: string): boolean {
  const e = enlace.trim();
  if (/^\/(?!\/)[^\s]*$/.test(e)) return true;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(e)) return true;
  try {
    const url = new URL(e);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Las fotos de un correo son subidas del CMS y nada más: `componer` las adjunta
 * leyéndolas del disco por su nombre, así que una ruta que no tenga esta forma
 * no llega nunca a un `path.join`.
 */
export const RUTA_DE_FOTO = /^\/storage\/public\/([a-f0-9]{32}\.(?:jpe?g|png|webp))$/i;

// ------------------------------------------------------------ la revisión

/** Todos los textos de una plantilla en que puede haber campos. */
function textosDe(p: PlantillaDeCorreo): string[] {
  const deLinea = (l: Linea) => l.map((t) => t.texto);
  const dePieza = (x: Pieza): string[] => {
    switch (x.tipo) {
      case 'parrafo': case 'oracion': return deLinea(x.trozos);
      case 'lista': return x.elementos.flatMap(deLinea);
      case 'recuadro': return [x.titulo, ...x.piezas.flatMap(dePieza)];
      case 'boton': return [x.texto];
      case 'foto': return [x.alt, x.pie];
      default: return [];
    }
  };
  return [p.asunto, p.resumen, p.titulo, p.despedida, ...p.contenido.flatMap(dePieza)];
}

const tieneTexto = (x: Pieza): boolean => {
  switch (x.tipo) {
    case 'separador': return false;
    case 'fijo': case 'foto': return true;
    default: return textoPlano(x).trim() !== '';
  }
};

/** Todos los enlaces de una plantilla: los del texto y los de los botones. */
function enlacesDe(p: PlantillaDeCorreo): string[] {
  const deLinea = (l: Linea) => l.flatMap((t) => (t.enlace === undefined ? [] : [t.enlace]));
  const dePieza = (x: Pieza): string[] => {
    switch (x.tipo) {
      case 'parrafo': case 'oracion': return deLinea(x.trozos);
      case 'lista': return x.elementos.flatMap(deLinea);
      case 'recuadro': return x.piezas.flatMap(dePieza);
      default: return [];
    }
  };
  return p.contenido.flatMap(dePieza);
}

/**
 * Lo que impide guardar una plantilla: campos o bloques que ese correo no
 * tiene (un error de escritura que dejaría un hueco), bloques obligatorios
 * que faltan (una papeleta sin la papeleta), enlaces que no llevan a ningún
 * sitio o textos vacíos.
 */
export function problemasDePlantilla(uso: UsoDeCorreo, p: PlantillaDeCorreo): string[] {
  const problemas: string[] = [];
  if (!p.asunto.trim()) problemas.push('Falta el asunto.');
  if (!uso.libre && !p.titulo.trim()) problemas.push('Falta el título.');
  if (!p.contenido.some(tieneTexto)) problemas.push('Falta el texto.');

  const campos = new Map([...CAMPOS_COMUNES, ...uso.campos].map((c) => [c.clave, c]));
  const desconocidos = new Set<string>();
  for (const texto of textosDe(p)) {
    for (const m of texto.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) if (!campos.has(m[1])) desconocidos.add(m[1]);
  }
  for (const c of desconocidos) problemas.push(`Este correo no tiene el dato «${c}»: quítalo del texto.`);

  const bloques = new Map(uso.bloques.map((b) => [b.clave, b]));
  const usados = new Map<string, number>();
  for (const x of p.contenido) if (x.tipo === 'fijo') usados.set(x.clave, (usados.get(x.clave) ?? 0) + 1);
  for (const [clave, veces] of usados) {
    if (!bloques.has(clave)) problemas.push(`Este correo no tiene el bloque «${clave}»: quítalo.`);
    else if (veces > 1) problemas.push(`«${bloques.get(clave)!.ayuda}» está puesto ${veces} veces: va una sola.`);
  }
  for (const b of uso.bloques) if (b.obligatorio && !usados.has(b.clave)) problemas.push(`Falta un bloque que no puede faltar: ${b.ayuda.charAt(0).toLowerCase()}${b.ayuda.slice(1)}.`);

  for (const x of p.contenido) {
    if (x.tipo === 'boton') {
      if (!x.texto.trim()) problemas.push('Hay un botón sin texto.');
      if (!enlaceValido(x.enlace)) problemas.push(`El botón «${x.texto.trim() || 'sin texto'}» no lleva a ninguna dirección válida.`);
    }
    if (x.tipo === 'foto' && !RUTA_DE_FOTO.test(x.src)) problemas.push('Hay una foto sin subir.');
  }
  if (enlacesDe(p).some((e) => !enlaceValido(e))) problemas.push('Hay un enlace en el texto que no lleva a ninguna dirección válida.');
  return problemas;
}

/** Hasta aquí se lee el asunto entero en la bandeja del móvil. */
export const ASUNTO_CORTO = 60;

/**
 * Lo que conviene mirar pero no impide guardar: se enseña en el repaso, al
 * lado de lo que está bien.
 */
export function avisosDePlantilla(p: PlantillaDeCorreo): string[] {
  const avisos: string[] = [];
  if (p.asunto.trim().length > ASUNTO_CORTO) avisos.push(`El asunto pasa de ${ASUNTO_CORTO} letras: en el móvil se corta.`);
  const sinDescripcion = p.contenido.filter((x) => x.tipo === 'foto' && !x.alt.trim()).length;
  if (sinDescripcion) avisos.push(sinDescripcion === 1 ? 'La foto no tiene descripción: quien no cargue imágenes verá un hueco.' : `${sinDescripcion} fotos no tienen descripción: quien no cargue imágenes verá huecos.`);
  return avisos;
}

/** El texto para la bandeja: el escrito o, sin él, el primer párrafo que no es el saludo. */
export function resumenDe(p: Pick<PlantillaDeCorreo, 'resumen' | 'contenido'>, campos: Record<string, string>, largo = 140): string {
  const primero = p.contenido.find((x) => x.tipo === 'parrafo' && !/^\{\{\s*saludo\s*\}\}$/.test(textoPlano(x).trim()));
  const fuente = p.resumen.trim() || (primero ? textoPlano(primero) : '');
  const texto = rellenar(fuente, campos).replace(/\s+/g, ' ').trim();
  return texto.length > largo ? `${texto.slice(0, largo - 1).trimEnd()}…` : texto;
}

// ------------------------------------------------------------ lo que se guarda

const trozoLimpio = (t: Trozo): Trozo => ({
  texto: t.texto.replace(/\r\n?/g, '\n'),
  ...(t.negrita ? { negrita: true } : {}),
  ...(t.cursiva ? { cursiva: true } : {}),
  ...(t.enlace !== undefined ? { enlace: t.enlace.trim() } : {}),
});
const lineaLimpia = (l: Linea): Linea => l.filter((t) => t.texto !== '').map(trozoLimpio);

function piezaDeTextoLimpia(x: PiezaDeTexto): PiezaDeTexto {
  return x.tipo === 'parrafo' ? { tipo: 'parrafo', trozos: lineaLimpia(x.trozos) } : { tipo: 'lista', elementos: x.elementos.map(lineaLimpia).filter((l) => l.length) };
}

/**
 * La plantilla con solo lo que se conoce: cada pieza rehecha campo a campo
 * (sin claves de más que viajen en el JSON), los textos recortados y las
 * listas sin elementos vacíos.
 */
export function plantillaLimpia(p: PlantillaDeCorreo): PlantillaDeCorreo {
  const contenido = p.contenido.map((x): Pieza => {
    switch (x.tipo) {
      case 'parrafo': case 'lista': return piezaDeTextoLimpia(x);
      case 'oracion': return { tipo: 'oracion', trozos: lineaLimpia(x.trozos) };
      case 'recuadro': return { tipo: 'recuadro', titulo: x.titulo.trim(), piezas: x.piezas.map(piezaDeTextoLimpia) };
      case 'boton': return { tipo: 'boton', texto: x.texto.trim(), enlace: x.enlace.trim() };
      case 'foto': return { tipo: 'foto', src: x.src.trim(), alt: x.alt.trim(), pie: x.pie.trim() };
      case 'separador': return { tipo: 'separador' };
      case 'fijo': return { tipo: 'fijo', clave: x.clave };
    }
  });
  return { asunto: p.asunto.trim(), resumen: p.resumen.trim(), titulo: p.titulo.trim(), contenido, despedida: p.despedida.trim() };
}
