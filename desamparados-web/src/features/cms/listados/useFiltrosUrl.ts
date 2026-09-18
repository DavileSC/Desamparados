import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Un filtro de un listado: su valor si no hay nada en la URL y, si es un desplegable, los que valen. */
export interface DefinicionFiltro {
  porDefecto?: string
  validos?: readonly string[]
}

/**
 * Búsqueda, filtros y orden de un listado del CMS, en la URL como la página
 * (`usePaginacion`): se vuelve de editar una ficha al mismo listado filtrado,
 * y un enlace copiado enseña lo mismo a quien lo abra.
 *
 * El prefijo es el de `usePaginacion` en las pantallas con dos listados:
 * `useFiltrosUrl(def, 'Enseres')` lee `?qEnseres=` y `?ordenEnseres=` y, al
 * cambiar algo, vuelve a la primera página de ese listado (`?paginaEnseres=`),
 * sin tocar el otro.
 *
 * Un valor de la URL que no está entre los `validos` (un enlace viejo, uno
 * escrito a mano) se lee como el de por defecto: el servidor respondería 400.
 */
export function useFiltrosUrl<C extends string>(definicion: Record<C, DefinicionFiltro>, prefijo = '') {
  const [params, setParams] = useSearchParams()
  const valores = useMemo(() => {
    const leidos = {} as Record<C, string>
    for (const clave of Object.keys(definicion) as C[]) {
      const { porDefecto = '', validos } = definicion[clave]
      const enUrl = params.get(`${clave}${prefijo}`)?.trim() ?? ''
      leidos[clave] = enUrl && (!validos || validos.includes(enUrl)) ? enUrl : porDefecto
    }
    return leidos
  }, [params, definicion, prefijo])

  /** Cambia uno o varios a la vez (`''` lo quita) y vuelve a la primera página: la 7 de otra consulta no tiene sentido. */
  const cambiar = useCallback((cambios: Partial<Record<C, string>>) => {
    setParams((anteriores) => {
      const siguientes = new URLSearchParams(anteriores)
      for (const [clave, valor] of Object.entries(cambios) as [C, string | undefined][]) {
        const limpio = valor?.trim() ?? ''
        // El valor por defecto no se escribe: la URL se queda corta y un enlace
        // sin filtros sigue siendo el mismo que el de siempre.
        if (!limpio || limpio === (definicion[clave]?.porDefecto ?? '')) siguientes.delete(`${clave}${prefijo}`)
        else siguientes.set(`${clave}${prefijo}`, limpio)
      }
      siguientes.delete(`pagina${prefijo}`)
      return siguientes
    }, { replace: true })
  }, [setParams, definicion, prefijo])

  return [valores, cambiar] as const
}
