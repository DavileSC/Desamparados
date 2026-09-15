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

/** El contenido de una página, ya mezclado por el servidor. Se lee sin sesión. */
export const getContenido = <T,>(slug: 'portada' | 'recorrido') => apiFetch<T>(`/contenido/${slug}`)

/** Sustituye el documento entero (CMS). */
export const guardarContenido = (slug: 'portada' | 'recorrido', datos: unknown) =>
  apiFetch<{ message: string; data: unknown }>(`/contenido/${slug}`, { method: 'PUT', json: { datos } })
