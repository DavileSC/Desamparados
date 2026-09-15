import { useQuery } from '@tanstack/react-query'
import POR_DEFECTO from '../../../../shared/contenido-por-defecto.json'
import { getPortada, type Portada, type TextosPortada } from '../../lib/api/portada'

/** Los textos de siempre: lo que se enseña mientras carga y si la API falla. */
export const TEXTOS_POR_DEFECTO = POR_DEFECTO.portada as TextosPortada

/**
 * La consulta que comparten los seis bloques de la portada. Una sola petición
 * para toda la pantalla: react-query la deduplica por su clave, así que da
 * igual cuántos bloques la llamen.
 */
export function usePortada() {
  return useQuery<Portada>({
    queryKey: ['home', 'portada'],
    queryFn: getPortada,
    retry: false,
    staleTime: 5 * 60_000,
  })
}

/**
 * Los textos, siempre completos. Mientras carga y si la petición falla se
 * devuelven los de siempre: un bloque de la portada no puede quedarse en blanco
 * porque la API esté caída. El servidor ya mezcla lo guardado sobre estos
 * mismos valores, así que aquí no hace falta mezclar nada.
 */
export function useTextosPortada(): TextosPortada {
  const { data } = usePortada()
  return data?.textos ?? TEXTOS_POR_DEFECTO
}
