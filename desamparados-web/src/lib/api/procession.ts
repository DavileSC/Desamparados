import { apiFetch } from './client'

export type ReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO'

export interface ApiProcessionTicket {
  id: number
  year: number
  puesto: string
  tramo: string | null
  numero: number | null
  hermano: {
    nombre: string
    apellidos: string
  }
  recibo: {
    estado: ReceiptStatus
    importe: number | string
  }
}

export function getMyProcessionTickets() {
  return apiFetch<ApiProcessionTicket[]>('/procesion/mis-papeletas')
}
