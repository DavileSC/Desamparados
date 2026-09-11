import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export type TipoApunte = 'INGRESO' | 'GASTO'
export type MetodoPago = 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'

export interface Balance { ingresos: number; gastos: number; balanceTotal: number }
export interface Category { id: number; nombre: string; tipo: TipoApunte }
export interface Transaction { id: number; tipo: TipoApunte; concepto: string; importe: number | string; fecha: string; metodoPago?: MetodoPago | null; categoria: { nombre: string }; hermano: { nombre: string; apellidos: string } | null }

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
export const getCategories = (tipo?: TipoApunte) => apiFetch<Category[]>(`/transacciones/categorias${tipo ? `?tipo=${tipo}` : ''}`)
export const createTransaction = (json: object) => apiFetch<{ message: string }>('/transacciones', { method: 'POST', json })
export const createCategory = (json: object) => apiFetch<{ message: string }>('/transacciones/categorias', { method: 'POST', json })
