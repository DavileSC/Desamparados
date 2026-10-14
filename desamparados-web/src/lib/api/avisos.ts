import { llamarApi } from './cliente'

/**
 * Los avisos del área de hermanos: los móviles que los reciben y los avisos de
 * la Junta para leerlos enteros (traspaso-2026-10-14 §5).
 */

/** Un móvil que recibe los avisos de la cuenta. */
export interface MovilDeAvisos {
  id: number
  nombre: string
  creadoEn: string
}

export function misMovilesDeAvisos() {
  return llamarApi<{ disponible: boolean; clavePublica: string | null; moviles: MovilDeAvisos[] }>('/hermanos/mis-avisos-movil')
}

export function activarAvisos(nombre: string, suscripcion: PushSubscriptionJSON) {
  return llamarApi<MovilDeAvisos>('/hermanos/mis-avisos-movil', { method: 'POST', json: { nombre, suscripcion } })
}

export function quitarMovilDeAvisos(id: number) {
  return llamarApi<null>(`/hermanos/mis-avisos-movil/${id}`, { method: 'DELETE' })
}

/** Un aviso de la Junta, como sale en la lista. */
export interface AvisoDeLaJunta {
  id: number
  asunto: string
  extracto: string
  enviadoEl: string | null
}

export function misAvisos() {
  return llamarApi<AvisoDeLaJunta[]>('/hermanos/mis-avisos')
}

export function miAviso(id: number) {
  return llamarApi<{ id: number; asunto: string; cuerpo: string; enviadoEl: string | null }>(`/hermanos/mis-avisos/${id}`)
}
