import { apiFetch } from './client'

export type AdminReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO'
export type PaymentMethod = 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'

export interface AdminReceipt {
  id: number
  year: number
  concepto: string
  importe: number | string
  fechaEmision: string
  estado: AdminReceiptStatus
  fechaPago: string | null
  metodoPago: PaymentMethod | null
  hermano: { id: number; nombre: string; apellidos: string; numeroHermano: number | null }
}

interface AdminReceiptResponse {
  data: AdminReceipt[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export function getAdminReceipts(year?: string) {
  const params = new URLSearchParams({ page: '1', limit: '200' })
  if (year) params.set('year', year)
  return apiFetch<AdminReceiptResponse>(`/recibos/admin?${params.toString()}`)
}

export function generateFees(payload: { year: number; importe: number; concepto: string }) {
  return apiFetch<{ message: string; omitidos?: number }>('/recibos/admin/generar', { method: 'POST', json: payload })
}

export function payReceipt(id: number, metodoPago: PaymentMethod) {
  return apiFetch<{ message: string; reciboId: number; estado: AdminReceiptStatus }>(`/recibos/admin/${id}/pagar`, { method: 'POST', json: { metodoPago } })
}
