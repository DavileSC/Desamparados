import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import POR_DEFECTO from '../../../../shared/contenido-por-defecto.json'
import { portadaDelInicio, type Portada, type TextosPortada } from '../../lib/api/portada'

/** Los textos de siempre: lo que se enseña mientras carga y si la API falla. */
export const TEXTOS_POR_DEFECTO = POR_DEFECTO.portada as TextosPortada

/**
 * Un borrador de la portada que sustituye a lo guardado. Lo pone la vista
 * previa del CMS alrededor de los bloques reales, para que se pinten con lo que
 * se está escribiendo sin tocar la caché de la portada pública.
 */
export const BorradorPortadaContext = createContext<Portada | null>(null)

/**
 * La consulta que comparten los seis bloques de la portada. Una sola petición
 * para toda la pantalla: react-query la deduplica por su clave, así que da
 * igual cuántos bloques la llamen. Con un borrador delante no se pide nada.
 */
export function usePortada(): { data: Portada | undefined; status: 'pending' | 'error' | 'success' } {
  const borrador = useContext(BorradorPortadaContext)
  const consulta = useQuery<Portada>({
    queryKey: ['home', 'portada'],
    queryFn: portadaDelInicio,
    retry: false,
    staleTime: 5 * 60_000,
    enabled: borrador === null,
  })
  return borrador ? { data: borrador, status: 'success' } : consulta
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
