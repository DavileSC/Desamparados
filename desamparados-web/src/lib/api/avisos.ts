import { llamarApi } from './cliente'

/**
 * Los avisos del área de hermanos: los móviles que los reciben, los avisos de
 * la Junta (traspaso-2026-10-14 §5) y los personales (el justificante de un
 * pago, el recordatorio de la cita) para leerlos enteros.
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

/** Un aviso como sale en la lista: de la Junta, a muchos, o personal, a esta cuenta. */
export interface Aviso {
  id: number
  tipo: 'junta' | 'personal'
  asunto: string
  extracto: string
  enviadoEl: string | null
}

export function misAvisos() {
  return llamarApi<Aviso[]>('/hermanos/mis-avisos')
}

/** Adónde lleva cada aviso de la lista: el id de uno de la Junta y el de uno personal no son de la misma tabla. */
export const enlaceDelAviso = (a: Pick<Aviso, 'id' | 'tipo'>) =>
  a.tipo === 'personal' ? `/area-hermano/avisos/personal/${a.id}` : `/area-hermano/avisos/${a.id}`

/** Un aviso personal entero: la misma carta que iría por correo. */
export function miAvisoPersonal(id: number) {
  return llamarApi<{ id: number; asunto: string; enviadoEl: string; html: string }>(`/hermanos/mis-avisos/personales/${id}`)
}

export function miAviso(id: number) {
  return llamarApi<{ id: number; asunto: string; cuerpo: string; enviadoEl: string | null }>(`/hermanos/mis-avisos/${id}`)
}
