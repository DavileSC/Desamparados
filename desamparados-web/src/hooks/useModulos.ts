import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CLAVE_MODULOS, modulosActivos } from '../lib/api/modulos'
import { cumple, type Requisito } from '../domain/modulos'

/**
 * Los módulos encendidos, pedidos una sola vez por sesión del navegador y
 * compartidos por toda la web (menús, rutas, bloques, pantallas). Mientras no
 * se saben, `activos` es `null` y nada de módulo se pinta: un menú que
 * apareciera y desapareciera sería peor que un instante en blanco. Las
 * pruebas lo siembran en el QueryClient (`renderWithProviders`), así que no
 * piden nada.
 */
export function useModulos() {
  const { data, isPending, isError } = useQuery({ queryKey: CLAVE_MODULOS, queryFn: modulosActivos, staleTime: Infinity, gcTime: Infinity })
  const activos = useMemo<ReadonlySet<string> | null>(() => (data ? new Set<string>(data) : null), [data])
  return {
    activos,
    cargando: isPending,
    error: isError,
    /** Sin la lista todavía, nada de módulo está activo; lo que vale con `nucleo`, sí. La misma regla que `cumple` y `ExigeModulo`. */
    activo: (requisito: Requisito) => cumple(requisito, activos ?? new Set()),
  }
}
