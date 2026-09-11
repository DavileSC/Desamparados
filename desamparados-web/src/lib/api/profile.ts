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
  /** `true` en la ficha de la persona que tiene la cuenta; `false` en la de sus tutelados. */
  esTitular: boolean
}

/**
 * La ficha que enseñan «Mi perfil» y su edición: la del titular de la cuenta.
 * El servidor ordena la familia por fecha de nacimiento descendente, así que la
 * primera es la del hijo más pequeño: tomar `data[0]` le enseñaba al tutor la
 * ficha de su hijo como si fuera la suya. Sin ficha propia (un padre que solo
 * inscribió a sus hijos), se queda la primera, como antes.
 */
export function fichaPropia(fichas: ApiProfile[]): ApiProfile | null {
  return fichas.find((ficha) => ficha.esTitular) ?? fichas[0] ?? null
}

/**
 * Las dos pantallas de perfil no listan fichas: eligen una —la del titular— para
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
