import { useQuery } from '@tanstack/react-query'

/**
 * Lo que la portada pide una vez y comparten sus secciones. La clave empieza
 * por `portada`, y el CMS la usa tal cual para invalidar la caché cuando se
 * destaca una noticia o una publicación. Con el módulo de la sección apagado
 * (`enabled` falso) no se pide nada: su ruta respondería 404.
 */
export function useDatosDePortada<T>(clave: string, pedir: () => Promise<T[]>, enabled = true) {
  return useQuery({ queryKey: ['portada', clave], queryFn: pedir, retry: false, staleTime: 60_000, enabled })
}
