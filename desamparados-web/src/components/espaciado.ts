/**
 * El aire entre la cabecera de una página (CabeceraDePagina) y su contenido.
 *
 * Antes se sumaban tres rellenos pensados cada uno por separado: los 112 px de
 * debajo de la cabecera, 48 de margen y 80 encima del contenido. Unos 300 px
 * vacíos entre el subtítulo y el primer párrafo, que parecían una página a
 * medio cargar. Ahora la cabecera cierra con poco y el contenido abre con lo
 * justo: unos 110 px en escritorio y 70 en el móvil. Abajo se deja el aire de
 * siempre antes del pie.
 */
export const SECCION_TRAS_CABECERA = { pt: { xs: 4, md: 6 }, pb: { xs: 6, md: 10 } } as const

/** Sin cabecera, el contenido abre justo por debajo de la barra de navegación, que en escritorio va fija encima. */
export const SECCION_SIN_CABECERA = { pt: { xs: 4, md: 12 }, pb: { xs: 6, md: 10 } } as const
