import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export type AdminReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO'
export type PaymentMethod = 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'
export type ReceiptType = 'PAPELETA_SITIO' | 'CUOTA_HERMANO' | 'DONATIVO' | 'OTRO'
/** Los que se pueden emitir a mano: la papeleta nace en la mesa de reparto, con su sitio. */
export type EmittableReceiptType = Exclude<ReceiptType, 'PAPELETA_SITIO'>

export interface AdminReceipt {
  id: number
  year: number
  concepto: string
  importe: number | string
  fechaEmision: string
  estado: AdminReceiptStatus
  fechaPago: string | null
  metodoPago: PaymentMethod | null
  tipo?: ReceiptType
  hermano: { id: number; nombre: string; apellidos: string; numeroHermano: number | null }
  /** Devuelto y ya reemitido: su recibo nuevo sigue su curso y este no pide nada. */
  reemitido?: boolean
}

/** Lo justo para elegir a quién se le emite un recibo: sin DNI ni datos de contacto. */
export interface ReceiptBrother {
  id: number
  nombre: string
  apellidos: string
  numeroHermano: number | null
}

export interface DatosDeRecibo {
  hermanoId: number
  year: number
  concepto: string
  importe: number
  tipo: EmittableReceiptType
}

/** `true` si el texto es un año de cuatro cifras, que es lo único que acepta el servidor como filtro. */
export const esAnioCompleto = (year: string | undefined): year is string => Boolean(year && /^\d{4}$/.test(year))

/** Búsqueda (hermano, número o concepto), filtros y orden del listado de recibos. Vacío = sin filtrar. */
/** `recibo`: uno concreto por su número, al llegar desde Contabilidad. */
export type FiltrosRecibos = { q?: string; estado?: AdminReceiptStatus | ''; tipo?: ReceiptType | ''; orden?: string; recibo?: string }

export function recibosDelCms(year: string | undefined, pagina: { pagina: number; porPagina: number }, filtros: FiltrosRecibos = {}) {
  // Un año a medio escribir («20») sería un 400: se pide sin filtro de año.
  return llamarApi<RespuestaPaginada<AdminReceipt>>(`/recibos/admin?${paramsPagina(pagina, { ...filtros, year: esAnioCompleto(year) ? year : undefined })}`)
}

/** Recibos y euros de cada estado, con la búsqueda, el año y el tipo del listado pero sin su estado. */
export type ResumenRecibos = { estados: Record<AdminReceiptStatus, { cuenta: number; total: number }> }

export function resumenDeRecibos(year: string | undefined, filtros: Pick<FiltrosRecibos, 'q' | 'tipo' | 'recibo'> = {}) {
  return llamarApi<ResumenRecibos>(`/recibos/admin/resumen?${new URLSearchParams(Object.entries({ ...filtros, year: esAnioCompleto(year) ? year : undefined })
    .filter((par): par is [string, string] => Boolean(par[1]))).toString()}`)
}

export function generarCuotas(payload: { year: number; importe: number; concepto: string }) {
  return llamarApi<{ message: string; omitidos?: number }>('/recibos/admin/generar', { method: 'POST', json: payload })
}

export function cobrarRecibo(id: number, metodoPago: PaymentMethod) {
  return llamarApi<{ message: string; reciboId: number; estado: AdminReceiptStatus }>(`/recibos/admin/${id}/pagar`, { method: 'POST', json: { metodoPago } })
}

/**
 * Cambia el estado de un recibo (remesar, devolver, anular, eximir). Al
 * devolverlo, `comision` es lo que cobró el banco: se apunta como gasto.
 */
export function cambiarEstadoRecibo(id: number, payload: { estado: AdminReceiptStatus; comision?: number }) {
  return llamarApi<{ message: string; papeletaAnulada: boolean }>(`/recibos/admin/${id}`, { method: 'PUT', json: payload })
}

export function crearRecibo(payload: DatosDeRecibo) {
  return llamarApi<{ message: string; reciboId: number; estado: AdminReceiptStatus }>('/recibos/admin', { method: 'POST', json: payload })
}

/** Hermanos activos cuyo nombre, apellidos o número coinciden con `q` (dos letras como mínimo). */
export function buscarHermanosConRecibo(q: string) {
  return llamarApi<ReceiptBrother[]>(`/recibos/admin/hermanos?${new URLSearchParams({ q }).toString()}`)
}

/** Una cuota de hermano sin pagar: pendiente o devuelta por el banco. */
export interface CuotaImpagada { id: number; year: number; estado: 'PENDIENTE' | 'DEVUELTO'; importe: number }

/** Un hermano activo que debe cuotas, con lo que debe en total. */
export interface HermanoConImpagos {
  hermano: { id: number; nombre: string; apellidos: string; numeroHermano: number | null }
  cuotas: CuotaImpagada[]
  total: number
}

/**
 * Quién debe cuotas, de quien más debe a quien menos. Sin `incluirAnioActual`
 * la cuota de este año no cuenta: pendiente a mitad de año no es un impago.
 */
export function impagos(filtros: { incluirAnioActual: boolean; minimo: number }, pagina: { pagina: number; porPagina: number }) {
  return llamarApi<RespuestaPaginada<HermanoConImpagos> & { anioActual: number }>(`/recibos/admin/impagos?${paramsPagina(pagina, {
    incluirAnioActual: filtros.incluirAnioActual ? 'true' : undefined,
    minimo: filtros.minimo > 1 ? String(filtros.minimo) : undefined,
  })}`)
}

/** Lo que el banco cobró en línea y no se pudo aplicar a lo que se debía: hay que devolverlo. */
export interface IncidenciaDePago {
  id: number
  pedido: string | null
  fecha: string
  importe: number
  metodo: PaymentMethod
  autorizacion: string | null
  motivo: string | null
  correo: string | null
}

export function incidenciasDePago() {
  return llamarApi<IncidenciaDePago[]>('/recibos/admin/pagos-en-linea/incidencias')
}

export function resolverIncidenciaDePago(id: number) {
  return llamarApi<{ message: string }>(`/recibos/admin/pagos-en-linea/incidencias/${id}/resolver`, { method: 'POST' })
}
