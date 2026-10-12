import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
// Solo la clave de la portada: el resto del JSON son las demás páginas, que la portada no usa.
import { portada } from '../../../../shared/contenido-por-defecto.json'
import { portadaDelInicio, type Portada, type TextosPortada } from '../../lib/api/portada'

/**
 * Los textos de partida, neutros: lo que se enseña si la API falla. Mientras
 * carga no se enseñan (ver `usePortadaEnCarga`): en una instalación con su
 * contenido, cada visita empezaría con unos textos que no son los suyos y
 * cambiarían de golpe al llegar los buenos.
 */
export const TEXTOS_POR_DEFECTO = portada as TextosPortada

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
 * Si los textos de la portada aún no han llegado. Mientras tanto, cada bloque
 * pinta sus textos en huesos (`TextoDePortada`), con la forma de lo que viene,
 * como las páginas de bloques. Con un borrador delante (la vista previa del
 * CMS) nunca: los textos ya están.
 */
export function usePortadaEnCarga(): boolean {
  return usePortada().status === 'pending'
}

/**
 * Los textos, siempre completos. Si la petición falla se devuelven los de
 * partida: un bloque de la portada no puede quedarse en blanco porque la API
 * esté caída. Mientras carga también, para que nadie tenga que comprobar un
 * `undefined`, pero los bloques no los pintan: van en huesos
 * (`usePortadaEnCarga`). El servidor ya mezcla lo guardado sobre estos mismos
 * valores, así que aquí no hace falta mezclar nada.
 */
export function useTextosPortada(): TextosPortada {
  const { data } = usePortada()
  return data?.textos ?? TEXTOS_POR_DEFECTO
}
