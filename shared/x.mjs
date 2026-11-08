// El texto de una noticia en X: lo que propone el CMS y cómo lo cuenta X.
// Compartido porque la web lleva la cuenta mientras se escribe y la API la
// vuelve a hacer antes de mandar, con el mismo mensaje. Sin dependencias.

export const LARGO_MAXIMO_X = 280
/** Lo que cuenta cualquier enlace en X, sea largo o corto: lo acorta a t.co. */
export const LARGO_DE_UN_ENLACE = 23

/**
 * El título y la dirección. El extracto no: en 280 caracteres no suele caber
 * con el título, y la tarjeta del enlace ya lo enseña cuando el post va sin foto.
 */
export function textoParaX({ titulo, direccion }) {
  return `${titulo.trim()}\n\n${direccion}`
}

// Los enlaces que X reconoce y acorta. Los dominios sueltos sin «www.»
// («ejemplo.es») también los acorta X, pero aquí no se cuentan: el texto que
// propone el CMS lleva la dirección entera y X, al final, es quien decide.
const ENLACE = /\b(?:https?:\/\/|www\.)[^\s]+/giu

// Lo que X cuenta como un carácter (latín, griego, cirílico, puntuación
// general); lo demás, como dos. Son los rangos de twitter-text, la librería
// con la que X cuenta.
const RANGOS_SENCILLOS = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]]
const EMOJI = /\p{Extended_Pictographic}/u

function pesoDe(grafema) {
  // Un emoji cuenta dos aunque lleve varios puntos de código (tono de piel, familia).
  if (EMOJI.test(grafema)) return 2
  let peso = 0
  for (const caracter of grafema) {
    const codigo = caracter.codePointAt(0)
    peso += RANGOS_SENCILLOS.some(([desde, hasta]) => codigo >= desde && codigo <= hasta) ? 1 : 2
  }
  return peso
}

/** Lo que mide el texto para X: cada enlace, 23; un emoji o una letra china, 2. */
export function largoEnX(texto) {
  let largo = 0
  let desde = 0
  for (const enlace of texto.matchAll(ENLACE)) {
    largo += largoSinEnlaces(texto.slice(desde, enlace.index)) + LARGO_DE_UN_ENLACE
    desde = enlace.index + enlace[0].length
  }
  return largo + largoSinEnlaces(texto.slice(desde))
}

function largoSinEnlaces(trozo) {
  let largo = 0
  for (const { segment } of new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(trozo.normalize('NFC'))) {
    largo += pesoDe(segment)
  }
  return largo
}

/** Lo que X rechazaría del texto, dicho para quien lo escribe; null si vale. */
export function problemaDelTextoX(texto) {
  if (texto.trim() === '') return 'El texto no puede ir vacío.'
  const largo = largoEnX(texto)
  if (largo > LARGO_MAXIMO_X) return `El texto mide ${largo} y X admite ${LARGO_MAXIMO_X} (cada enlace cuenta ${LARGO_DE_UN_ENLACE}).`
  return null
}
