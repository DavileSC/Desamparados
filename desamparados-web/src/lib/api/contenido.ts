import { apiFetch } from './client'

/** Las páginas con documento editable. La misma lista que `SLUGS_CONTENIDO` en el servidor. */
export type SlugContenido = 'portada' | 'recorrido' | 'historia'

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
 * Color de un hito de la historia. Cada uno responde a algo de la web: granate
 * es el color que ya lleva el Sábado de Pasión, y dorado marca el punto en el
 * que estamos, como el subrayado del menú.
 */
export type TonoHito = 'ninguno' | 'granate' | 'oro'

export interface HitoHistoria {
  /** Lo que va en serif grande: «Años 50», «1954», «Hoy». */
  periodo: string
  /** Etiqueta bajo el periodo y en el índice de la cabecera. */
  etiqueta: string
  titulo: string
  /** Los párrafos, separados por una línea en blanco. */
  relato: string
  /** Sin `url`, el hito no lleva foto. */
  foto: { url: string; alt: string; pie: string }
  tono: TonoHito
}

export interface ContenidoHistoria {
  ceja: string
  titulo: string
  subtitulo: string
  /** La foto velada detrás de toda la página; sin `url`, el fondo queda liso. */
  fondo: { url: string }
  hitos: HitoHistoria[]
  cierre: { ceja: string; titulo: string; enlace: string }
}

/**
 * Las claves de react-query de cada documento. Las comparten la página pública,
 * que guarda su caché con ellas, y el CMS, que las invalida tras guardar.
 * Estaban escritas a mano en los dos sitios: si divergían, guardar dejaba de
 * refrescar la página pública y nada fallaba —la página seguía enseñando lo
 * viejo hasta que caducara la caché—. Exportadas de un solo sitio, la
 * divergencia no se puede ni escribir.
 */
export const CLAVE_RECORRIDO = ['contenido', 'recorrido'] as const
export const CLAVE_HISTORIA = ['contenido', 'historia'] as const

/** El contenido de una página, ya mezclado por el servidor. Se lee sin sesión. */
export const getContenido = <T,>(slug: SlugContenido) => apiFetch<T>(`/contenido/${slug}`)

/** Sustituye el documento entero (CMS). */
export const guardarContenido = (slug: SlugContenido, datos: unknown) =>
  apiFetch<{ message: string; data: unknown }>(`/contenido/${slug}`, { method: 'PUT', json: { datos } })

/** Los párrafos de un relato: una línea en blanco separa uno del siguiente. */
export const parrafosDe = (relato: string): string[] =>
  relato.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '')
