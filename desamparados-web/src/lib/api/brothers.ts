import { apiFetch } from './client'

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

export interface BrotherSearchResponse {
  data: AdminBrother[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface PendingRequest {
  id: number
  email: string
  nombre: string
  apellidos: string
  createdAt: string
  hermanos: AdminBrother[]
}

export function searchBrothers(query: string) {
  const params = new URLSearchParams({ page: '1', limit: '100' })
  if (query) params.set('q', query)
  return apiFetch<BrotherSearchResponse>(`/hermanos/admin/search?${params.toString()}`)
}

export function getPendingRequests() {
  return apiFetch<PendingRequest[]>('/hermanos/admin/solicitudes')
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
  activo?: boolean
  esTitular?: boolean
  tieneTunicaPropia?: boolean
  tunica?: string
  alturaHombro?: number
  puesto?: string
  fechaAlta?: string
  fechaBaja?: string | null
}

export function getBrother(id: number) {
  return apiFetch<AdminBrother>(`/hermanos/admin/${id}`)
}

export function updateBrother(id: number, payload: AdminBrotherPayload) {
  return apiFetch<AdminBrother>(`/hermanos/admin/${id}`, { method: 'PUT', json: payload })
}

/**
 * Secretaría emancipa a un dependiente. No lleva contraseña: al hermano le
 * llega un enlace para ponérsela él.
 */
export function emancipateBrother(id: number, payload: { newEmail: string; newDni?: string }) {
  return apiFetch<{ id: number; email: string; nombre: string }>(`/hermanos/admin/${id}/emancipar`, { method: 'POST', json: payload })
}
