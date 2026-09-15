import { apiFetch } from './client'

export interface ParadaRecorrido { hora: string; lugar: string }

export interface ContenidoRecorrido {
  titulo: string
  subtitulo: string
  introduccion: string
  tituloItinerario: string
  plano: { url: string; alt: string }
  paradas: ParadaRecorrido[]
}

/**
 * La clave de react-query del documento del Recorrido. La comparten la página
 * pública (features/corporation/sabado-pasion/RecorridoPage.tsx), que guarda su
 * caché con ella, y el CMS (features/cms/RecorridoAdminPage.tsx), que la
 * invalida tras guardar. Estaba escrita a mano en los dos sitios: si divergían,
 * guardar dejaba de refrescar la página pública y nada fallaba —la página
 * seguía enseñando lo viejo hasta que caducara la caché—. Exportada de un solo
 * sitio, la divergencia no se puede ni escribir.
 */
export const CLAVE_RECORRIDO = ['contenido', 'recorrido'] as const

/** El contenido de una página, ya mezclado por el servidor. Se lee sin sesión. */
export const getContenido = <T,>(slug: 'portada' | 'recorrido') => apiFetch<T>(`/contenido/${slug}`)

/** Sustituye el documento entero (CMS). */
export const guardarContenido = (slug: 'portada' | 'recorrido', datos: unknown) =>
  apiFetch<{ message: string; data: unknown }>(`/contenido/${slug}`, { method: 'PUT', json: { datos } })
