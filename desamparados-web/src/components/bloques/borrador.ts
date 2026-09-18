import { createContext, useContext } from 'react'
import type { PaginaDeBloques } from '../../lib/api/contenido'

/**
 * Un borrador de página que sustituye a lo guardado. Lo pone la vista previa
 * del CMS alrededor de la página real, para que se pinte con lo que se está
 * escribiendo sin tocar la caché de la web pública. Es lo mismo que
 * `BorradorPortadaContext` hace con la portada.
 */
export const BorradorPaginaContext = createContext<PaginaDeBloques | null>(null)

export const useBorradorPagina = () => useContext(BorradorPaginaContext)
