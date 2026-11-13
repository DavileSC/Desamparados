/**
 * Las medidas y los colores que comparten las tres caras de la barra: la de
 * escritorio, la de móvil y el cajón.
 */
import { aplanarMenu, type EntradaMenu } from '../../config/navegacion'

// El menú debe seguir siendo de escritorio en portátiles con escalado de Windows
// (la anchura CSS puede ser bastante menor que la resolución física).
export const DESKTOP_NAV_MIN = 1024
export const desktopMq = `@media (min-width:${DESKTOP_NAV_MIN}px)`
// La barra de escritorio va en dos pisos (13-11-2026): arriba, las redes, el
// escudo con el nombre de la titular y el acceso; abajo, el menú. Lo que cede
// al estrecharse es el tamaño de la letra y del escudo, por tramos; el alto,
// nunca, porque las páginas dejan su hueco con `ALTO_BARRA_ESCRITORIO`.
// Medido con los cinco perfiles y el menú de pruebas: en estrecho, a 1024 px,
// el menú pide ~700 y la franja de arriba ~820.
export const compactMq = `@media (max-width:1439px)`
export const estrechoMq = `@media (max-width:1219px)`

// Velo de la barra de escritorio, en opacidad de la tinta #070608. 0,72 es el
// mínimo: sobre una foto blanca deja el texto blanco en 7,7:1 y el dorado del
// enlace activo justo en 4,5:1 (AA); por debajo, el dorado deja de leerse.
// Al hacer scroll sube a 0,86.
export const tinta = (opacidad: number) => `rgba(7, 6, 8, ${opacidad.toFixed(3)})`
export const VELO_ARRIBA = 0.72
export const VELO_SCROLL = 0.86

/** El piso de arriba de la barra de escritorio: redes, escudo y nombre, acceso. */
export const ALTO_FRANJA = 76
/** El piso del menú, bajo un filete dorado. */
export const ALTO_MENU = 40
/**
 * Lo que tapa la barra fija de escritorio: el hueco que deja arriba quien
 * empieza bajo ella (las cabeceras a sangre, el hero, las páginas sin cabecera).
 */
export const ALTO_BARRA_ESCRITORIO = ALTO_FRANJA + ALTO_MENU

/** Lo que tapa la barra de escritorio más `aire` px: el hueco de arriba de una página, en CSS. */
export const bajoLaBarra = (aire: number) => `${ALTO_BARRA_ESCRITORIO + aire}px`

/**
 * El cristal del desplegable de escritorio, elegido en maqueta (13-11-2026):
 * la tinta de la web entera de oscura, un 25 % transparente y 3 px de
 * desenfoque, que deja reconocer la foto de detrás. Sobre una foto blanca el
 * fondo queda en ~#454345: el blanco da 9,6:1 y el dorado 5,7:1.
 */
export const VIDRIO = {
  fondo: tinta(0.75),
  filtro: 'blur(3px) saturate(160%)',
  borde: '1px solid rgba(255, 255, 255, 0.14)',
} as const

/** Si una entrada del menú es la de la página que se está viendo. */
export function esActiva(pathname: string, href: string, exacta = false) {
  if (href === '/' || exacta) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Una sección de primer nivel está activa si lo está alguna de sus subpáginas:
 * ya no cuelgan de ella (/historia, no /corporacion/historia).
 */
export function seccionActiva(pathname: string, seccion: EntradaMenu) {
  if (!seccion.hijos?.length) return esActiva(pathname, seccion.href, seccion.exacta)
  return aplanarMenu(seccion.hijos).some((e) => esActiva(pathname, e.href, e.exacta))
}
