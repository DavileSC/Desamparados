import DOMPurify from 'dompurify'

/**
 * Segunda barrera contra XSS almacenado.
 *
 * El backend ya sanea el HTML de noticias y páginas con `sanitize-html` al
 * crear y al editar, y esa sigue siendo la defensa principal. Esta capa existe
 * porque el token de sesión vive en `localStorage`: si el saneado del servidor
 * fallara —una versión vulnerable, un contenido escrito directamente en la base
 * de datos, un `import` de datos antiguos— el coste no sería una noticia mal
 * pintada, sino la sesión de cualquiera que la abriese, administradores
 * incluidos.
 *
 * La lista blanca es deliberadamente la misma que la del servidor
 * (`news.service.ts`), para que las dos capas coincidan y ningún contenido
 * legítimo se pierda por el camino.
 */
const ETIQUETAS_PERMITIDAS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'small',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
]

const ATRIBUTOS_PERMITIDOS = ['href', 'src', 'alt', 'title', 'target', 'rel', 'colspan', 'rowspan']

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ETIQUETAS_PERMITIDAS,
    ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
    // Bloquea javascript:, data: y demás esquemas ejecutables en href/src.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
    // Ojo: `USE_PROFILES` NO puede usarse aquí. DOMPurify lo trata como
    // alternativa excluyente a `ALLOWED_TAGS`, no como refuerzo: al activarlo,
    // la lista blanca de arriba se ignora y vuelven a colarse etiquetas como
    // <form>. La lista blanca ya deja fuera svg y math por sí sola.
  })
}
