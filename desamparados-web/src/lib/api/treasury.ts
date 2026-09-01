import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

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

export function getAdminReceipts(year: string | undefined, pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<AdminReceipt>>(`/recibos/admin?${paramsPagina(pagina, { year })}`)
}

export function generateFees(payload: { year: number; importe: number; concepto: string }) {
  return apiFetch<{ message: string; omitidos?: number }>('/recibos/admin/generar', { method: 'POST', json: payload })
}

export function payReceipt(id: number, metodoPago: PaymentMethod) {
  return apiFetch<{ message: string; reciboId: number; estado: AdminReceiptStatus }>(`/recibos/admin/${id}/pagar`, { method: 'POST', json: { metodoPago } })
}
