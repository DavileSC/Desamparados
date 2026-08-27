import { apiFetch } from './client'

export interface Balance { ingresos: number; gastos: number; balanceTotal: number }
export interface Category { id: number; nombre: string; tipo: 'INGRESO' | 'GASTO' }
export interface Transaction { id: number; tipo: 'INGRESO' | 'GASTO'; concepto: string; importe: number | string; fecha: string; categoria: { nombre: string }; hermano: { nombre: string; apellidos: string } | null }
export interface LedgerResponse { data: Transaction[]; meta: { total: number; page: number; lastPage: number } }

export const getBalance = () => apiFetch<Balance>('/transacciones/balance')
export const getLedger = () => apiFetch<LedgerResponse>('/transacciones/libro-mayor?page=1&limit=200')
export const getCategories = (tipo?: 'INGRESO' | 'GASTO') => apiFetch<Category[]>(`/transacciones/categorias${tipo ? `?tipo=${tipo}` : ''}`)
export const createTransaction = (json: object) => apiFetch<{ message: string }>('/transacciones', { method: 'POST', json })
export const createCategory = (json: object) => apiFetch<{ message: string }>('/transacciones/categorias', { method: 'POST', json })
