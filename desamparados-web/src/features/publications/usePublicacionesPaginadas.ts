import { useEffect, useState } from 'react'
import { usePaginacion } from '../../hooks/usePaginacion'
import { getPublications } from '../../lib/api/publications'
import type { MetaPaginacion } from '../../lib/api/tipos'
import type { PublicationItem } from '../../types'

/**
 * Las tres pantallas públicas de publicaciones (todas, boletines y dossieres de
 * prensa) consumen el mismo extremo y solo se diferencian en la categoría, el
 * mensaje de error y la etiqueta del paginador. Sin esto, el bloque de carga
 * quedaba copiado tres veces y cualquier ajuste posterior eran tres ediciones
 * que había que mantener sincronizadas a mano.
 *
 * `category` a `undefined` pide el listado completo.
 */
export function usePublicacionesPaginadas(
  category: PublicationItem['category'] | undefined,
  mensajeError: string,
) {
  const [items, setItems] = useState<PublicationItem[]>([])
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()

  useEffect(() => {
    let cancelado = false

    getPublications(category, { pagina, porPagina })
      .then((respuesta) => {
        if (cancelado) return
        setItems(respuesta.data)
        setMeta(respuesta.meta)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(err instanceof Error ? err.message : mensajeError)
      })
      .finally(() => { if (!cancelado) setLoading(false) })

    return () => { cancelado = true }
  }, [category, mensajeError, pagina, porPagina])

  const alCambiarPagina = (numero: number) => {
    irAPagina(numero)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return { items, meta, loading, error, alCambiarPagina, cambiarTamano }
}
