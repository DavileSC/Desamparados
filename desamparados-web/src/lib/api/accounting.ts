import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface Balance { ingresos: number; gastos: number; balanceTotal: number }
export interface Category { id: number; nombre: string; tipo: 'INGRESO' | 'GASTO' }
export interface Transaction { id: number; tipo: 'INGRESO' | 'GASTO'; concepto: string; importe: number | string; fecha: string; categoria: { nombre: string }; hermano: { nombre: string; apellidos: string } | null }

export const getBalance = () => apiFetch<Balance>('/transacciones/balance')
export const getLedger = (pagina: { pagina: number; porPagina: number }) => apiFetch<RespuestaPaginada<Transaction>>(`/transacciones/libro-mayor?${paramsPagina(pagina)}`)
export const getCategories = (tipo?: 'INGRESO' | 'GASTO') => apiFetch<Category[]>(`/transacciones/categorias${tipo ? `?tipo=${tipo}` : ''}`)
export const createTransaction = (json: object) => apiFetch<{ message: string }>('/transacciones', { method: 'POST', json })
export const createCategory = (json: object) => apiFetch<{ message: string }>('/transacciones/categorias', { method: 'POST', json })
