import { apiFetch } from './client'

export interface ApiProfile {
  id: number
  nombre: string
  apellidos: string
  email: string | null
  telefono: string | null
  direccion: string | null
  poblacion: string | null
  codigoPostal: string | null
  fechaAlta: string
  numeroHermano: number | null
  activo: boolean
}

export function getMyProfiles() {
  return apiFetch<ApiProfile[]>('/hermanos/mis-perfiles')
}

export interface UpdateProfilePayload {
  nombre: string
  apellidos: string
  email: string
  telefono: string
  direccion: string
  poblacion: string
  codigoPostal: string
}

export function updateMyProfile(id: number, payload: UpdateProfilePayload) {
  return apiFetch<{ message: string; data: ApiProfile }>(`/hermanos/mis-perfiles/${id}`, {
    method: 'PUT',
    json: payload,
  })
}
