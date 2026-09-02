import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

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

/**
 * Las dos pantallas de perfil no listan fichas: eligen una —la primera— para
 * mostrarla o editarla. Un selector paginado es mala interfaz, y con una página
 * corta el hermano con varias fichas dejaría de poder llegar a alguna, así que
 * piden la familia entera de una vez. Cincuenta es más de lo que ninguna
 * familia tendrá y queda por debajo del tope del servidor, que son cien.
 */
export const FICHAS_POR_FAMILIA = 50

export function getMyProfiles(
  pagina: { pagina: number; porPagina: number } = { pagina: 1, porPagina: FICHAS_POR_FAMILIA },
) {
  return apiFetch<RespuestaPaginada<ApiProfile>>(`/hermanos/mis-perfiles?${paramsPagina(pagina)}`)
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
