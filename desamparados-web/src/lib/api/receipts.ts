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

export interface ReceiptGroup {
  id: number
  nombre: string
  apellidos: string
  esTitular: boolean
  recibos: ApiReceipt[]
}

/**
 * Lo que se pagina aquí es el MIEMBRO de la familia con sus recibos anidados,
 * que es como los agrupa el servidor: `meta.total` cuenta miembros activos, no
 * recibos sueltos.
 */
export function getMyReceipts(pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<ReceiptGroup>>(`/recibos/mis-recibos?${paramsPagina(pagina)}`)
}
