import { llamarApi } from './cliente'

/** La cuenta de Instagram conectada, tal como la ve el CMS: nunca el token. */
export interface EstadoInstagram {
  conectada: boolean
  usuario: string | null
  caducaEl: string | null
  conectadoEl: string | null
  /** Por qué falló la última renovación del token; null si fue bien. */
  errorAlRenovar: string | null
}

export interface PublicacionEnInstagram {
  instagramId: string | null
  instagramEnlace: string | null
  instagramEl: string | null
}

export const CLAVE_INSTAGRAM = ['instagram'] as const

export const estadoInstagram = () => llamarApi<EstadoInstagram>('/instagram')

export const conectarInstagram = (token: string) =>
  llamarApi<EstadoInstagram>('/instagram', { method: 'PUT', json: { token } })

export const desconectarInstagram = () => llamarApi<EstadoInstagram>('/instagram', { method: 'DELETE' })

/** `otraVez`: mandarla aunque ya esté en Instagram (el servidor lo para si no). */
export const publicarNoticiaEnInstagram = (id: number, pie: string, otraVez = false) =>
  llamarApi<PublicacionEnInstagram>(`/instagram/noticias/${id}`, { method: 'POST', json: { pie, otraVez } })

/**
 * La ventana de X con el post escrito: título y enlace. Sin API de X, que
 * cobra por publicar; quien está en el CMS solo tiene que pulsar «Publicar».
 * La foto la pone X con la vista previa del enlace.
 */
export function enlaceParaPublicarEnX({ titulo, direccion }: { titulo: string; direccion: string }) {
  const parametros = new URLSearchParams({ text: titulo.trim(), url: direccion })
  return `https://x.com/intent/post?${parametros}`
}
