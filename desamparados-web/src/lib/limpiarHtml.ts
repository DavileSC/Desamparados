import DOMPurify from 'dompurify'

/**
 * Segunda barrera contra XSS almacenado.
 *
 * El backend ya sanea el HTML de noticias y páginas con `sanitize-html` al
 * crear y al editar (`utils/sanear-html.ts`), y esa sigue siendo la defensa
 * principal. Esta capa existe por si el saneado del servidor fallara —una
 * versión vulnerable, un contenido escrito directamente en la base de datos, un
 * `import` de datos antiguos—: la sesión va en una cookie httpOnly que un script
 * inyectado no puede leer, pero sí podría usarla desde la propia página para
 * actuar en nombre de quien la abriese, administradores incluidos.
 *
 * Las reglas de imágenes y enlaces son las mismas que las del servidor, para que
 * las dos capas coincidan y ningún contenido legítimo se pierda por el camino:
 *  - <img> solo con rutas del propio sitio (`/storage/public/…`, `/images/…`):
 *    una imagen externa avisa a un tercero de cada visita;
 *  - nada de `href="//otro-dominio"`, que se salta la lista de esquemas;
 *  - todo enlace con `target` abre pestaña nueva con `rel="noopener noreferrer"`.
 */
export const ETIQUETAS_PERMITIDAS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'small',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
]

const ATRIBUTOS_PERMITIDOS = ['href', 'src', 'alt', 'title', 'target', 'rel', 'colspan', 'rowspan']

/** Las mismas rutas propias que admite el servidor (`rutaImagenPublica` en portada.schema.ts). */
const IMAGEN_PROPIA = /^\/(?:storage\/public|images)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i

/**
 * Una URL absoluta a una imagen nuestra (`https://…/storage/public/<hex>.jpg`,
 * `http://localhost:3001/…`: lo que da «Copiar dirección de imagen» y lo que
 * guardaban versiones antiguas del CMS) se lee como ruta relativa, igual que hace
 * el servidor al guardar (backend: utils/rutas-propias.ts). Sin esto, las
 * noticias antiguas con esas fotos las perdían al pintarse. Vale cualquier host:
 * con la ruta de una carpeta nuestra, apunta a nuestro sitio y ya no avisa a
 * nadie de la visita. `URL` resuelve los `..` antes de comprobar la ruta.
 */
export function aRutaPropia(src: string): string {
  const limpio = src.trim()
  if (!/^(?:https?:)?\/\//i.test(limpio)) return src
  try {
    const { pathname } = new URL(limpio, 'http://relativo.invalid')
    return IMAGEN_PROPIA.test(pathname) ? pathname : src
  } catch {
    return src
  }
}

// Los ganchos de DOMPurify son globales a su instancia: se registran una vez, y
// este módulo es el único que la usa.

// Antes de comprobar el esquema: una URL absoluta a una foto nuestra pasa a relativa.
DOMPurify.addHook('uponSanitizeAttribute', (nodo, datos) => {
  if (nodo.nodeName === 'IMG' && datos.attrName === 'src') datos.attrValue = aRutaPropia(datos.attrValue)
})

DOMPurify.addHook('afterSanitizeAttributes', (nodo) => {
  if (nodo.nodeName === 'IMG' && !IMAGEN_PROPIA.test(nodo.getAttribute('src') ?? '')) {
    nodo.parentNode?.removeChild(nodo)
    return
  }
  if (nodo.nodeName === 'A') {
    if (nodo.hasAttribute('target')) {
      nodo.setAttribute('target', '_blank')
      nodo.setAttribute('rel', 'noopener noreferrer')
    } else {
      // Sin target, un `rel` puesto a mano no aporta y podría ser `opener`.
      nodo.removeAttribute('rel')
    }
  }
})

export function limpiarHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ETIQUETAS_PERMITIDAS,
    ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
    // Bloquea javascript:, data: y demás esquemas ejecutables en href/src, y
    // también `//otro-dominio`: una barra sí (ruta propia), dos no.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/(?!\/)|#)/i,
    // DOMPurify pasa por esa expresión el valor de TODO atributo que no tenga
    // por seguro, no solo href y src: sin esto se comía `target="_blank"` (y con
    // él la pestaña nueva) y los `colspan` de las tablas. Ninguno de los cuatro
    // puede llevar una URL ejecutable.
    ADD_URI_SAFE_ATTR: ['target', 'rel', 'colspan', 'rowspan'],
    // Ojo: `USE_PROFILES` NO puede usarse aquí. DOMPurify lo trata como
    // alternativa excluyente a `ALLOWED_TAGS`, no como refuerzo: al activarlo,
    // la lista blanca de arriba se ignora y vuelven a colarse etiquetas como
    // <form>. La lista blanca ya deja fuera svg y math por sí sola.
  })
}
