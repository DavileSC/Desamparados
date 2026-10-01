import { llamarApi } from './cliente'
import type { Salida } from './procesion'

/** Lo que dice la puerta al leer una papeleta (ver `domain/puerta.ts` del backend). */
export type Veredicto = 'ENTRA' | 'REPETIDA' | 'OTRA_SALIDA' | 'ANULADA' | 'FALSO'

export interface PapeletaEnPuerta {
  id: number
  nombre: string
  apellidos: string
  numeroHermano: number | null
  puesto: string
  tramo: string | null
  numero: number | null
  year: number
  salida: Salida
  entradaEl: string | null
  entradaPor: string | null
}

export interface Lectura {
  veredicto: Veredicto
  papeleta: PapeletaEnPuerta | null
}

export interface TramoEnPuerta {
  tramo: string | null
  total: number
  dentro: number
}

export interface EstadoPuerta {
  salida: Salida
  year: number
  total: number
  dentro: number
  tramos: TramoEnPuerta[]
  faltan: PapeletaEnPuerta[]
  ultimas: PapeletaEnPuerta[]
}

export const estadoPuerta = (salida: Salida) => llamarApi<EstadoPuerta>(`/procesion/admin/puerta?salida=${salida}`)
export const escanearPapeleta = (codigo: string, salida: Salida) =>
  llamarApi<Lectura>('/procesion/admin/puerta/escanear', { method: 'POST', json: { codigo, salida } })
export const entrarAMano = (id: number, salida: Salida) =>
  llamarApi<Lectura>(`/procesion/admin/puerta/papeletas/${id}`, { method: 'POST', json: { salida } })
export const deshacerEntrada = (id: number) =>
  llamarApi<PapeletaEnPuerta>(`/procesion/admin/puerta/papeletas/${id}`, { method: 'DELETE' })
