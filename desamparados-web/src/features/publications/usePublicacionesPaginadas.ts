import { useCallback } from 'react'
import { useListadoPaginado, type Pagina } from '../../hooks/useListadoPaginado'
import { getPublications } from '../../lib/api/publications'
import type { PublicationItem } from '../../types'

/**
 * Las tres pantallas públicas de publicaciones (todas, boletines y dossieres de
 * prensa) consumen el mismo extremo y solo se diferencian en la categoría, el
 * mensaje de error y la etiqueta del paginador. La carga en sí la lleva
 * `useListadoPaginado`, que comparten con la agenda; aquí solo queda atado el
 * extremo que hay que pedir.
 *
 * `category` a `undefined` pide el listado completo.
 */
export function usePublicacionesPaginadas(
  category: PublicationItem['category'] | undefined,
  mensajeError: string,
) {
  const pedir = useCallback((pagina: Pagina) => getPublications(category, pagina), [category])
  return useListadoPaginado(pedir, mensajeError)
}
