import { apiFetch } from './client'

export type ReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO'

export interface ApiReceipt {
  id: number
  year: number
  concepto: string
  importe: number | string
  fechaEmision: string
  fechaPago: string | null
  estado: ReceiptStatus
}

export interface ReceiptGroup {
  id: number
  nombre: string
  apellidos: string
  esTitular: boolean
  recibos: ApiReceipt[]
}

export function getMyReceipts() {
  return apiFetch<ReceiptGroup[]>('/recibos/mis-recibos')
}
