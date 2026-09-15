import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export type ReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO'
export type TipoRecibo = 'PAPELETA_SITIO' | 'CUOTA_HERMANO' | 'DONATIVO' | 'OTRO'
export type MetodoPago = 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'

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

/**
 * Un recibo suelto, con el desglose que no cabe en la fila del listado.
 *
 * `observaciones` no está, y no es un olvido: es el texto libre de Tesorería y
 * puede llevar notas internas. El servidor no lo manda.
 */
export interface MyReceiptDetail extends MyReceipt {
  tipo: TipoRecibo
  metodoPago: MetodoPago | null
}

/** 404 si el recibo no es de su familia: el servidor no distingue «no existe» de «no es tuyo». */
export function getMyReceipt(id: number) {
  return apiFetch<MyReceiptDetail>(`/recibos/mis-recibos/${id}`)
}
