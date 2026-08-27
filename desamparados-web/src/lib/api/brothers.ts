import { apiFetch } from './client'

export interface AdminBrother {
  id: number
  nombre: string
  apellidos: string
  dni: string | null
  email: string | null
  telefono: string | null
  poblacion: string | null
  codigoPostal: string | null
  activo: boolean
  numeroHermano: number | null
  fechaAlta: string
  esTitular: boolean
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

export function searchBrothers(query: string, role: string) {
  if (role === 'HERMANO_MAYOR') return apiFetch<BrotherSearchResponse>('/hermanos/admin/all?page=1&limit=500')
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
  nombre: string
  apellidos: string
  email?: string
  telefono?: string
  activo?: boolean
  numeroHermano?: number
}

export function updateBrother(id: number, payload: AdminBrotherPayload) {
  return apiFetch<AdminBrother>(`/hermanos/admin/${id}`, { method: 'PUT', json: payload })
}
