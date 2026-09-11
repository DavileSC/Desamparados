import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export type AdminReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO'
export type PaymentMethod = 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'
export type ReceiptType = 'PAPELETA_SITIO' | 'CUOTA_HERMANO' | 'DONATIVO' | 'OTRO'
/** Los que se pueden emitir a mano: la papeleta nace en la mesa de reparto, con su sitio. */
export type EmittableReceiptType = Exclude<ReceiptType, 'PAPELETA_SITIO'>

export interface AdminReceipt {
  id: number
  year: number
  concepto: string
  importe: number | string
  fechaEmision: string
  estado: AdminReceiptStatus
  fechaPago: string | null
  metodoPago: PaymentMethod | null
  tipo?: ReceiptType
  hermano: { id: number; nombre: string; apellidos: string; numeroHermano: number | null }
}

/** Lo justo para elegir a quién se le emite un recibo: sin DNI ni datos de contacto. */
export interface ReceiptBrother {
  id: number
  nombre: string
  apellidos: string
  numeroHermano: number | null
}

export interface NewReceiptPayload {
  hermanoId: number
  year: number
  concepto: string
  importe: number
  tipo: EmittableReceiptType
}

/** `true` si el texto es un año de cuatro cifras, que es lo único que acepta el servidor como filtro. */
export const esAnioCompleto = (year: string | undefined): year is string => Boolean(year && /^\d{4}$/.test(year))

export function getAdminReceipts(year: string | undefined, pagina: { pagina: number; porPagina: number }) {
  // Un año a medio escribir («20») sería un 400: se pide sin filtro de año.
  return apiFetch<RespuestaPaginada<AdminReceipt>>(`/recibos/admin?${paramsPagina(pagina, { year: esAnioCompleto(year) ? year : undefined })}`)
}

export function generateFees(payload: { year: number; importe: number; concepto: string }) {
  return apiFetch<{ message: string; omitidos?: number }>('/recibos/admin/generar', { method: 'POST', json: payload })
}

export function payReceipt(id: number, metodoPago: PaymentMethod) {
  return apiFetch<{ message: string; reciboId: number; estado: AdminReceiptStatus }>(`/recibos/admin/${id}/pagar`, { method: 'POST', json: { metodoPago } })
}

export function createReceipt(payload: NewReceiptPayload) {
  return apiFetch<{ message: string; reciboId: number; estado: AdminReceiptStatus }>('/recibos/admin', { method: 'POST', json: payload })
}

/** Hermanos activos cuyo nombre, apellidos o número coinciden con `q` (dos letras como mínimo). */
export function searchReceiptBrothers(q: string) {
  return apiFetch<ReceiptBrother[]>(`/recibos/admin/hermanos?${new URLSearchParams({ q }).toString()}`)
}
