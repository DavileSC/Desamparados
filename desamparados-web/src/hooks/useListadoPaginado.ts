import { useEffect, useState } from 'react'
import { usePaginacion } from './usePaginacion'
import type { MetaPaginacion } from '../lib/api/tipos'

export interface Pagina {
  pagina: number
  porPagina: number
}

/**
 * Cargar una página de un listado público: los cinco estados, el efecto atado a
 * la página y el salto al principio al cambiarla.
 *
 * Nació en publicaciones para las tres pantallas que solo se diferencian en la
 * categoría; la agenda llegó después con el mismo bloque copiado línea por
 * línea, así que aquí queda parametrizado por el fetcher y por el tipo del
 * elemento. `pedir` entra en las dependencias del efecto: pásalo estable (una
 * función de módulo o un `useCallback`), o cada render recargará la lista.
 */
export function useListadoPaginado<T>(
  pedir: (pagina: Pagina) => Promise<{ data: T[]; meta: MetaPaginacion }>,
  mensajeError: string,
) {
  const [items, setItems] = useState<T[]>([])
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()

  useEffect(() => {
    let cancelado = false

    pedir({ pagina, porPagina })
      .then((respuesta) => {
        if (cancelado) return
        setItems(respuesta.data)
        setMeta(respuesta.meta)
        // Una carga buena borra el error de la anterior. Sin esto, un fallo
        // pasajero al pasar de página se quedaba pegado: las cargas siguientes
        // traían datos, pero las pantallas esconden la lista mientras haya
        // error y el visitante veía el paginador, una alerta y ni un solo
        // resultado hasta recargar a mano. Se limpia aquí, y no al entrar en el
        // efecto, para no llamar a setState de forma síncrona dentro de él.
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(err instanceof Error ? err.message : mensajeError)
      })
      .finally(() => { if (!cancelado) setLoading(false) })

    return () => { cancelado = true }
  }, [pedir, mensajeError, pagina, porPagina])

  const alCambiarPagina = (numero: number) => {
    irAPagina(numero)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return { items, meta, loading, error, alCambiarPagina, cambiarTamano }
}
