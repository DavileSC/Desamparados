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
export type FiltrosRecibos = { q?: string; estado?: AdminReceiptStatus | ''; tipo?: ReceiptType | ''; orden?: string }

export function recibosDelCms(year: string | undefined, pagina: { pagina: number; porPagina: number }, filtros: FiltrosRecibos = {}) {
  // Un año a medio escribir («20») sería un 400: se pide sin filtro de año.
  return llamarApi<RespuestaPaginada<AdminReceipt>>(`/recibos/admin?${paramsPagina(pagina, { ...filtros, year: esAnioCompleto(year) ? year : undefined })}`)
}

/** Recibos y euros de cada estado, con la búsqueda, el año y el tipo del listado pero sin su estado. */
export type ResumenRecibos = { estados: Record<AdminReceiptStatus, { cuenta: number; total: number }> }

export function resumenDeRecibos(year: string | undefined, filtros: Pick<FiltrosRecibos, 'q' | 'tipo'> = {}) {
  return llamarApi<ResumenRecibos>(`/recibos/admin/resumen?${new URLSearchParams(Object.entries({ ...filtros, year: esAnioCompleto(year) ? year : undefined })
    .filter((par): par is [string, string] => Boolean(par[1]))).toString()}`)
}

export function generarCuotas(payload: { year: number; importe: number; concepto: string }) {
  return llamarApi<{ message: string; omitidos?: number }>('/recibos/admin/generar', { method: 'POST', json: payload })
}

export function cobrarRecibo(id: number, metodoPago: PaymentMethod) {
  return llamarApi<{ message: string; reciboId: number; estado: AdminReceiptStatus }>(`/recibos/admin/${id}/pagar`, { method: 'POST', json: { metodoPago } })
}

export function crearRecibo(payload: DatosDeRecibo) {
  return llamarApi<{ message: string; reciboId: number; estado: AdminReceiptStatus }>('/recibos/admin', { method: 'POST', json: payload })
}

/** Hermanos activos cuyo nombre, apellidos o número coinciden con `q` (dos letras como mínimo). */
export function buscarHermanosConRecibo(q: string) {
  return llamarApi<ReceiptBrother[]>(`/recibos/admin/hermanos?${new URLSearchParams({ q }).toString()}`)
}
