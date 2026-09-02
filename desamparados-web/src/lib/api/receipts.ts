import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

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

/** Un recibo de la familia con el miembro al que pertenece. */
export interface MyReceipt extends ApiReceipt {
  hermano: {
    nombre: string
    apellidos: string
    esTitular: boolean
  }
}

/**
 * Los recibos de toda la familia en una lista plana, que es como los pinta la
 * pantalla: la unidad paginada es el recibo, así que `meta.total` cuenta
 * recibos y el tamaño de página acota las filas que llegan.
 */
export function getMyReceipts(pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<MyReceipt>>(`/recibos/mis-recibos?${paramsPagina(pagina)}`)
}
