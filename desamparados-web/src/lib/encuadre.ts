import type { Encuadre } from '../types'

/** El centro: lo que se ve de una foto que no tiene encuadre guardado. */
export const ENCUADRE_CENTRADO: Encuadre = { x: 50, y: 50 }

/**
 * El `object-position` de una foto recortada con `object-fit: cover`: el punto
 * elegido en el CMS queda a la vista, sea cual sea la forma del recorte (muy
 * apaisada en la principal del archivo, cuadrada en sus filas, 4:3 en la portada).
 */
export const posicionDe = (encuadre: Encuadre | undefined) => {
  const { x, y } = encuadre ?? ENCUADRE_CENTRADO
  return `${x}% ${y}%`
}
