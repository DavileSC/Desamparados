import { llamarApi } from './cliente'

/** La cuenta de X conectada, tal como la ve el CMS: nunca las claves. */
export interface EstadoX {
  conectada: boolean
  usuario: string | null
  conectadoEl: string | null
  /** Si X rechazó las claves al publicar (cambiadas o de solo lectura), por qué; null si no. */
  errorDeClaves: string | null
}

/** Las cuatro claves de la app, tal como las da console.x.com. */
export interface ClavesX {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
}

export interface PublicacionEnX {
  xId: string | null
  xEnlace: string | null
  xEl: string | null
}

export const CLAVE_X = ['x'] as const

export const estadoX = () => llamarApi<EstadoX>('/x')

export const conectarX = (claves: ClavesX) => llamarApi<EstadoX>('/x', { method: 'PUT', json: claves })

export const desconectarX = () => llamarApi<EstadoX>('/x', { method: 'DELETE' })

/** `otraVez`: mandarla aunque ya esté en X (el servidor lo para si no). */
export const publicarNoticiaEnX = (id: number, texto: string, conFoto: boolean, otraVez = false) =>
  llamarApi<PublicacionEnX>(`/x/noticias/${id}`, { method: 'POST', json: { texto, conFoto, otraVez } })

/**
 * La ventana de X con el post escrito: título y enlace. Para cuando no hay
 * cuenta conectada; quien está en el CMS solo tiene que pulsar «Publicar».
 * La foto la pone X con la vista previa del enlace.
 */
export function enlaceParaPublicarEnX({ titulo, direccion }: { titulo: string; direccion: string }) {
  const parametros = new URLSearchParams({ text: titulo.trim(), url: direccion })
  return `https://x.com/intent/post?${parametros}`
}
