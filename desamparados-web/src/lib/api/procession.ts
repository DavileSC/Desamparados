import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

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

export function getMyProcessionTickets(pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<ApiProcessionTicket>>(`/procesion/mis-papeletas?${paramsPagina(pagina)}`)
}
