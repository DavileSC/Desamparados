import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export type ReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO' | 'REEMBOLSADO'
export type TipoRecibo = 'PAPELETA_SITIO' | 'CUOTA_HERMANO' | 'DONATIVO' | 'OTRO'
export type MetodoPago = 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'

interface ApiReceipt {
  id: number
  year: number
  concepto: string
  importe: number | string
  fechaEmision: string
  fechaPago: string | null
  estado: ReceiptStatus
  /** La cuota se perdonó (lo decide el Hermano Mayor): se enseña así en vez de «Exento». */
  perdonada?: boolean
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
export function misRecibos(pagina: { pagina: number; porPagina: number }) {
  return llamarApi<RespuestaPaginada<MyReceipt>>(`/recibos/mis-recibos?${paramsPagina(pagina)}`)
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
export function miRecibo(id: number) {
  return llamarApi<MyReceiptDetail>(`/recibos/mis-recibos/${id}`)
}
