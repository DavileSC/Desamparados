/**
 * El alto del mapa y, en escritorio, también el de la lista de al lado. Con la
 * frase de encima y la cabecera, el bloque entero cabe en la pantalla con
 * holgura: no hace falta dejar el scroll clavado para ver el mapa entero. En
 * el móvil, mapa y lista van uno encima del otro y también caben juntos.
 *
 * Aparte y no en `RecorridoEnMapa`: el esqueleto los necesita antes de que
 * llegue MapLibre, y traerlos de allí lo metería en la descarga principal.
 */
export const ALTO_MAPA = { xs: '40svh', md: 'min(760px, calc(100svh - 210px))' }
export const ALTO_LISTA = { xs: '28svh', md: ALTO_MAPA.md }
export const ALTO_MINIMO = { xs: 230, md: 380 }
export const ALTO_MINIMO_LISTA = { xs: 170, md: ALTO_MINIMO.md }
