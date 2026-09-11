import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export type TipoApunte = 'INGRESO' | 'GASTO'
export type MetodoPago = 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'

export interface Balance { ingresos: number; gastos: number; balanceTotal: number }
export interface Category {
  id: number
  nombre: string
  tipo: TipoApunte
  /** Desactivada, deja de ofrecerse al apuntar; sus apuntes siguen en el libro. */
  activa?: boolean
  /** La usan los recibos al cobrarse o devolverse: no se puede renombrar. */
  deRecibos?: boolean
}
export interface Transaction {
  id: number
  tipo: TipoApunte
  concepto: string
  importe: number | string
  fecha: string
  metodoPago?: MetodoPago | null
  categoriaId?: number
  /** Con recibo, el apunte se corrige desde el recibo; sin él, es manual y se corrige aquí. */
  reciboId?: number | null
  categoria: { nombre: string }
  hermano: { nombre: string; apellidos: string } | null
}

/** Lo que se manda al apuntar o corregir a mano. `fecha` en `AAAA-MM-DD`. */
export interface ApunteManual {
  tipo: TipoApunte
  categoriaId: number
  concepto: string
  importe: number
  fecha: string
  metodoPago: MetodoPago
}

/** Los mismos filtros sirven al libro mayor y al resumen: las cifras cuadran con la lista. */
export interface FiltrosContables {
  tipo?: TipoApunte
  /** `AAAA-MM-DD`, incluido. */
  desde?: string
  hasta?: string
  categorias?: number[]
  metodo?: MetodoPago
  q?: string
}

export interface ResumenContable {
  totales: { ingresos: number; gastos: number; resultado: number; apuntesIngreso: number; apuntesGasto: number }
  /** El mismo tramo un año antes; `null` si el periodo no tiene principio y fin. */
  anterior: { desde: string; hasta: string; ingresos: number; gastos: number } | null
  serie: { granularidad: 'mes' | 'anio'; puntos: { clave: string; ingresos: number; gastos: number }[] }
  categorias: { id: number; nombre: string; tipo: TipoApunte; total: number; apuntes: number }[]
}

export function paramsFiltros(filtros: FiltrosContables): URLSearchParams {
  const params = new URLSearchParams()
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.desde) params.set('desde', filtros.desde)
  if (filtros.hasta) params.set('hasta', filtros.hasta)
  if (filtros.categorias?.length) params.set('categorias', filtros.categorias.join(','))
  if (filtros.metodo) params.set('metodo', filtros.metodo)
  if (filtros.q) params.set('q', filtros.q)
  return params
}

export const getBalance = () => apiFetch<Balance>('/transacciones/balance')
export const getLedger = (pagina: { pagina: number; porPagina: number }, filtros: FiltrosContables = {}) => {
  const filtrado = paramsFiltros(filtros).toString()
  return apiFetch<RespuestaPaginada<Transaction>>(`/transacciones/libro-mayor?${paramsPagina(pagina)}${filtrado ? `&${filtrado}` : ''}`)
}
export const getResumen = (filtros: FiltrosContables = {}) => {
  const filtrado = paramsFiltros(filtros).toString()
  return apiFetch<ResumenContable>(`/transacciones/resumen${filtrado ? `?${filtrado}` : ''}`)
}
/** `todas`: también las desactivadas, que la gestión y los filtros del histórico necesitan ver. */
export const getCategories = (tipo?: TipoApunte, todas = false) => {
  const params = new URLSearchParams()
  if (tipo) params.set('tipo', tipo)
  if (todas) params.set('todas', 'true')
  const consulta = params.toString()
  return apiFetch<Category[]>(`/transacciones/categorias${consulta ? `?${consulta}` : ''}`)
}
export const createTransaction = (json: ApunteManual) => apiFetch<{ message: string }>('/transacciones', { method: 'POST', json })
/** Solo apuntes manuales: los de un recibo responden 409 y se corrigen desde el recibo. */
export const updateTransaction = (id: number, json: ApunteManual) => apiFetch<{ message: string }>(`/transacciones/${id}`, { method: 'PUT', json })
export const deleteTransaction = (id: number) => apiFetch<{ message: string }>(`/transacciones/${id}`, { method: 'DELETE' })
export const createCategory = (json: { nombre: string; tipo: TipoApunte }) => apiFetch<{ message: string }>('/transacciones/categorias', { method: 'POST', json })
export const renameCategory = (id: number, nombre: string) => apiFetch<{ message: string }>(`/transacciones/categorias/${id}`, { method: 'PUT', json: { nombre } })
export const setCategoryActive = (id: number, activa: boolean) => apiFetch<{ message: string }>(`/transacciones/categorias/${id}/activa`, { method: 'PATCH', json: { activa } })
