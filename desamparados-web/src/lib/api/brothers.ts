import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface AdminBrother {
  id: number
  nombre: string
  apellidos: string
  dni: string | null
  fechaNacimiento: string
  email: string | null
  telefono: string | null
  direccion: string | null
  poblacion: string | null
  codigoPostal: string | null
  activo: boolean
  numeroHermano: number | null
  fechaAlta: string
  fechaBaja: string | null
  esTitular: boolean
  tieneTunicaPropia: boolean
  tunica: string | null
  alturaHombro: number | null
  puesto: string | null
  user?: { email: string | null; telefono: string | null }
}

export interface PendingRequest {
  id: number
  email: string
  nombre: string
  apellidos: string
  createdAt: string
  /** Cuenta ya aprobada (un familiar añadido después) o solicitud nueva (false). */
  active?: boolean
  hermanos: AdminBrother[]
}

/**
 * Quien se dio de baja y ha pedido volver desde la web. No es una solicitud de
 * alta: su ficha ya estuvo en el censo, así que se resuelve reactivándola (le
 * da número nuevo) o descartando la petición, nunca con «aprobar».
 */
export interface PeticionVuelta {
  id: number
  nombre: string
  apellidos: string
  dni: string | null
  email: string | null
  fechaBaja: string | null
  reactivacionSolicitada: string
}

/** Búsqueda, filtros y orden del censo. Vacío = sin filtrar. */
export type FiltrosCenso = {
  q?: string
  estado?: '' | 'activo' | 'baja' | 'pendiente'
  numero?: '' | 'con' | 'sin'
  orden?: string
}

export function searchBrothers(filtros: FiltrosCenso, pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<AdminBrother>>(`/hermanos/admin/search?${paramsPagina(pagina, filtros)}`)
}

export function getPendingRequests(pagina: { pagina: number; porPagina: number }) {
  // Las peticiones de vuelta llegan con las altas: se atienden en la misma
  // pantalla, aunque con otro botón.
  return apiFetch<RespuestaPaginada<PendingRequest> & { reactivaciones: PeticionVuelta[] }>(
    `/hermanos/admin/solicitudes?${paramsPagina(pagina)}`,
  )
}

/** Descartar una petición de vuelta: la ficha se queda de baja, como estaba. */
export function descartarPeticionVuelta(hermanoId: number) {
  return apiFetch<{ message: string }>(`/hermanos/admin/reactivaciones/${hermanoId}`, { method: 'DELETE' })
}

export function approveRequest(id: number) {
  return apiFetch<{ message: string }>(`/hermanos/admin/solicitudes/${id}/aprobar`, { method: 'POST' })
}

export function rejectRequest(id: number) {
  return apiFetch<{ message: string }>(`/hermanos/admin/solicitudes/${id}/rechazar`, { method: 'DELETE' })
}

export interface AdminBrotherPayload {
  nombre?: string
  apellidos?: string
  dni?: string
  fechaNacimiento?: string
  telefono?: string
  email?: string
  direccion?: string
  poblacion?: string
  codigoPostal?: string
  numeroHermano?: number
  esTitular?: boolean
  tieneTunicaPropia?: boolean
  tunica?: string
  alturaHombro?: number
  puesto?: string
  fechaAlta?: string
  /**
   * Solo para CORREGIR la fecha de una ficha que ya está de baja. La ficha no
   * da altas ni bajas (ni `activo`, ni quitar la baja con null): eso va por
   * darDeBajaBrother, reactivarBrother y la aprobación de solicitudes, que
   * asignan o liberan el número, tocan la cuenta y quedan en la auditoría.
   */
  fechaBaja?: string
}

export function getBrother(id: number) {
  return apiFetch<AdminBrother>(`/hermanos/admin/${id}`)
}

export function updateBrother(id: number, payload: AdminBrotherPayload) {
  return apiFetch<AdminBrother>(`/hermanos/admin/${id}`, { method: 'PUT', json: payload })
}

/** Da de baja a un hermano con la fecha indicada (AAAA-MM-DD); sin ella, hoy. */
export function darDeBajaBrother(id: number, fechaBaja?: string) {
  return apiFetch<{ message: string }>(`/hermanos/admin/${id}/baja`, {
    method: 'DELETE',
    ...(fechaBaja ? { json: { fechaBaja } } : {}),
  })
}

/** Vuelve a dar de alta a un hermano de baja: número nuevo y cuenta con acceso. */
export function reactivarBrother(id: number) {
  return apiFetch<{ message: string }>(`/hermanos/admin/${id}/reactivar`, { method: 'POST' })
}

/**
 * Secretaría emancipa a un dependiente. No lleva contraseña: al hermano le
 * llega un enlace para ponérsela él.
 */
export function emancipateBrother(id: number, payload: { newEmail: string; newDni?: string }) {
  return apiFetch<{ id: number; email: string; nombre: string }>(`/hermanos/admin/${id}/emancipar`, { method: 'POST', json: payload })
}

export interface CierreDeHuecos {
  message: string
  asignados: { id: number; numeroHermano: number }[]
}

/** Da número a los hermanos activos que no lo tienen, por antigüedad. No renumera a nadie. */
export function cerrarHuecosDeNumero() {
  return apiFetch<CierreDeHuecos>('/hermanos/admin/cerrar-huecos-numero', { method: 'POST' })
}
