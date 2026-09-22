import { llamarApi } from './cliente'
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

export function misPapeletas(pagina: { pagina: number; porPagina: number }) {
  return llamarApi<RespuestaPaginada<ApiProcessionTicket>>(`/procesion/mis-papeletas?${paramsPagina(pagina)}`)
}
