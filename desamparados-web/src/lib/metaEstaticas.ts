/**
 * Las etiquetas de index.html que cada página vuelve a poner con
 * `MetaDePagina`.
 *
 * Con React 19, react-helmet-async ya no sustituye: deja que React pinte sus
 * `<meta>` y React las añade al final del `<head>` sin mirar si ya había una
 * igual. Así, cada página acababa con dos descripciones (la general, primero)
 * y dos `og:title`, y un buscador que ejecuta JavaScript se quedaba con la
 * primera, la de todas.
 *
 * Se quitan del DOM al arrancar, antes de pintar nada: los robots que no
 * ejecutan JavaScript (WhatsApp, Facebook) siguen leyendo el HTML servido, que
 * no cambia. El `<title>` no hace falta: React lo pone delante del estático y
 * es el que manda.
 */
const META_QUE_PONE_CADA_PAGINA = [
  'meta[name="description"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
] as const

export function quitarMetaEstaticas(cabecera: HTMLHeadElement = document.head) {
  for (const selector of META_QUE_PONE_CADA_PAGINA) {
    cabecera.querySelectorAll(selector).forEach((etiqueta) => etiqueta.remove())
  }
}
