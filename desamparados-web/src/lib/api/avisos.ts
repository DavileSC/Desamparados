import { llamarApi } from './cliente'

/**
 * La página Avisos del área: lo de la papeleta pendiente de la cuenta (sin
 * recoger, el recordatorio de la cita), para leerlo entero aunque se haya
 * borrado el correo.
 */

/** Un aviso como sale en la lista. */
export interface Aviso {
  id: number
  asunto: string
  extracto: string
  enviadoEl: string | null
}

export function misAvisos() {
  return llamarApi<Aviso[]>('/hermanos/mis-avisos')
}

export const enlaceDelAviso = (a: Pick<Aviso, 'id'>) => `/area-hermano/avisos/personal/${a.id}`

/** Un aviso entero: la misma carta que salió por correo. */
export function miAvisoPersonal(id: number) {
  return llamarApi<{ id: number; asunto: string; enviadoEl: string; html: string }>(`/hermanos/mis-avisos/personales/${id}`)
}
