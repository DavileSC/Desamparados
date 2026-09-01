import { useLocation } from 'react-router-dom'

/**
 * Ruta de vuelta al listado, conservando la consulta con la que se salió de él.
 *
 * Las pantallas de edición volvían a una ruta fija: se editaba la ficha 214
 * desde la página 5 del censo y al guardar (o al cancelar) se aterrizaba en la
 * página 1. Eso incumplía el punto 4 de la comprobación final del plan de
 * paginación y anulaba el argumento con el que `usePaginacion` justifica meter
 * la página en la URL: «así se vuelve del formulario de edición al mismo sitio».
 *
 * El mecanismo es el mínimo: el enlace de editar lleva la consulta actual en el
 * `state` de la navegación (`state={{ volver: location.search }}`) y aquí se
 * pega detrás de la ruta base. Quien llegue tecleando la URL o desde un enlace
 * externo no trae `state`, y entonces se cae en la ruta pelada, que es lo
 * correcto: no hay página a la que volver.
 */
export function useVolverAlListado(rutaBase: string): string {
  const { state } = useLocation()
  const volver = (state as { volver?: unknown } | null)?.volver
  return typeof volver === 'string' ? `${rutaBase}${volver}` : rutaBase
}
