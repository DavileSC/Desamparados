import sanitizeHtml from 'sanitize-html';
import { aRutaPropia, esImagenPropia } from './rutas-propias.js';

/**
 * Saneado del HTML que se escribe en el CMS (noticias y páginas). Es la defensa
 * principal contra XSS almacenado; la del navegador (desamparados-web,
 * `lib/sanitizeHtml.ts`) es la segunda barrera y aplica estas mismas reglas de
 * imágenes y enlaces: si se cambia una, hay que cambiar la otra.
 *
 * Antes se usaban los valores por defecto de sanitize-html, que dejan pasar:
 *  - `<img src="https://tracker…">`: una imagen externa en una noticia avisa a
 *    un tercero de cada visita (IP y navegador de quien la lee);
 *  - `href="//otro-dominio"`: relativo al protocolo, se salta la lista de
 *    esquemas y parece un enlace interno;
 *  - `target="_blank"` sin `rel`: la página abierta puede redirigir la nuestra
 *    con `window.opener` (tabnabbing).
 */

/**
 * Las etiquetas y los atributos, IGUALES a los de la web (`ETIQUETAS_PERMITIDAS`
 * y `ATRIBUTOS_PERMITIDOS` en desamparados-web/src/lib/sanitizeHtml.ts): con
 * listas distintas, lo que el servidor guarda la web lo pintaba de otra manera
 * (las celdas combinadas y los `title` se perdían aquí y no allí).
 * `test/contenido-cms.test.ts` lee el fichero de la web y avisa si se separan.
 */
export const ETIQUETAS_CMS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'small',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
];

export const ATRIBUTOS_CMS: Record<string, string[]> = {
  '*': ['title'],
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};

const OPCIONES_CONTENIDO: sanitizeHtml.IOptions = {
  allowedTags: ETIQUETAS_CMS,
  allowedAttributes: ATRIBUTOS_CMS,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // Una imagen solo puede ser una ruta del propio sitio: ningún esquema.
  allowedSchemesByTag: { img: [] },
  allowProtocolRelative: false,
  transformTags: {
    // Una URL absoluta a una imagen nuestra («Copiar dirección de imagen», o lo
    // que guardaban versiones antiguas del CMS) pasa a ruta relativa ANTES de
    // filtrar. Si no, la <img> se quitaba al guardar y su fichero, sin nadie
    // que lo mencionara, se borraba del disco (ver utils/rutas-propias.ts).
    img: (tagName, attribs) => (attribs.src
      ? { tagName, attribs: { ...attribs, src: aRutaPropia(attribs.src, esImagenPropia) } }
      : { tagName, attribs }),
    // Con `target` siempre abre pestaña nueva y siempre sin acceso a esta. El
    // `rel` que traiga el editor se descarta para que no pueda deshacerlo
    // (`rel="opener"`).
    a: (tagName, attribs) => {
      const { target, rel: _rel, ...resto } = attribs;
      return target
        ? { tagName, attribs: { ...resto, target: '_blank', rel: 'noopener noreferrer' } }
        : { tagName, attribs: resto };
    },
  },
  // Una <img> sin una ruta propia válida se quita entera: sin `src` no pinta nada.
  exclusiveFilter: (frame) => frame.tag === 'img' && !esImagenPropia(frame.attribs.src ?? ''),
};

export function sanearContenidoCms(contenido: string): string {
  return sanitizeHtml(contenido, OPCIONES_CONTENIDO);
}

/**
 * Deshace el escapado de sanitize-html. Solo aparecen estas cinco: el
 * analizador ya decodifica el resto (`&nbsp;`, `&eacute;`…) al leer el texto.
 * `&amp;` va la última para no decodificar dos veces «&amp;lt;».
 */
function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&amp;/g, '&');
}

/**
 * El extracto de una noticia es texto plano: la web lo pinta como texto, no
 * como HTML. Saneado con sanitize-html a secas, «Cultos & Misa» se guardaba
 * como «Cultos &amp; Misa» y así se veía en la portada.
 *
 * Se quitan las etiquetas, se decodifican las entidades y se descartan los
 * ángulos que queden (de un «&lt;script&gt;» escrito a mano): un extracto no
 * los necesita, y así el valor guardado sigue siendo inofensivo aunque algún día
 * se pinte como HTML por descuido.
 *
 * Es idempotente: pasarlo dos veces da lo mismo. Por eso se aplica también al
 * leer, para arreglar los extractos guardados antes con `&amp;`.
 */
export function extractoPlano(extracto: string): string {
  const sinEtiquetas = sanitizeHtml(extracto, { allowedTags: [], allowedAttributes: {} });
  return decodificarEntidades(sinEtiquetas).replace(/[<>]/g, '');
}
