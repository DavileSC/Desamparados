/**
 * Las medidas y los colores que comparten las tres caras de la barra: la de
 * escritorio, la de móvil y el cajón.
 */
import { aplanarMenu, type EntradaMenu } from '../../config/navegacion'

// El menú debe seguir siendo de escritorio en portátiles con escalado de Windows
// (la anchura CSS puede ser bastante menor que la resolución física).
export const DESKTOP_NAV_MIN = 1024
export const desktopMq = `@media (min-width:${DESKTOP_NAV_MIN}px)`
// Las redes no se quitan nunca de la barra: lo que cede es lo demás, por
// tramos. Medido con los cinco perfiles y el menú de pruebas (contando los
// ~17px de la barra de desplazamiento):
// - En grande (letra 15, escudo 46) todo junto pide ~1430px; desde 1536,
//   con más aire entre entradas, ~1525.
// - En compacto (letra 13, escudo 32, iconos de 28) pide ~1210px.
// - Por debajo, el nombre se queda solo en el escudo (sigue ahí para el lector
//   de pantalla) y cabe hasta los 1024 con unos 5px de holgura.
// Un menú con títulos más largos que los de pruebas puede pedir más.
export const compactMq = `@media (max-width:1439px)`
export const estrechoMq = `@media (max-width:1219px)`

// Velo de la barra de escritorio, en opacidad de la tinta #070608. 0,72 es el
// mínimo: sobre una foto blanca deja el texto blanco en 7,7:1 y el dorado del
// enlace activo justo en 4,5:1 (AA); por debajo, el dorado deja de leerse.
// Al hacer scroll sube a 0,86.
export const tinta = (opacidad: number) => `rgba(7, 6, 8, ${opacidad.toFixed(3)})`
export const VELO_ARRIBA = 0.72
export const VELO_SCROLL = 0.86

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
