import { llamarApi } from './cliente'
import { deLaSalida } from './procesion'

/** Lo que dice la puerta al leer una papeleta (ver `domain/puerta.ts` del backend). */
export type Veredicto = 'ENTRA' | 'REPETIDA' | 'OTRA_SALIDA' | 'DE_BAJA' | 'ANULADA' | 'FALSO'

export interface PapeletaEnPuerta {
  id: number
  nombre: string
  apellidos: string
  numeroHermano: number | null
  puesto: string
  tramo: string | null
  numero: number | null
  year: number
  /** El slug de su salida. */
  salida: string
  entradaEl: string | null
  entradaPor: string | null
  /**
   * Su hermano ya no está en activo. Darle de baja no anula una papeleta
   * pagada (lo decide la Junta): es la puerta quien lo para.
   */
  deBaja: boolean
}

export interface Lectura {
  /** `FAMILIA`: el QR de una familia; nadie ha entrado aún, la lista va en `familia`. */
  veredicto: Veredicto | 'FAMILIA'
  papeleta: PapeletaEnPuerta | null
  /** Solo al leer un QR de familia: sus papeletas de esta salida, también las que ya entraron. */
  familia?: PapeletaEnPuerta[]
}

interface TramoEnPuerta {
  tramo: string | null
  total: number
  dentro: number
}

interface EstadoPuerta {
  /** El slug de la salida. */
  salida: string
  year: number
  total: number
  dentro: number
  /** Papeletas de hermanos de baja que no han entrado: no cuentan en `total` ni en «Faltan». */
  deBaja: number
  tramos: TramoEnPuerta[]
  faltan: PapeletaEnPuerta[]
  ultimas: PapeletaEnPuerta[]
}

export const estadoPuerta = (salida: string) => llamarApi<EstadoPuerta>(`/procesion/admin/puerta?${deLaSalida(salida)}`)
export const escanearPapeleta = (codigo: string, salida: string) =>
  llamarApi<Lectura>('/procesion/admin/puerta/escanear', { method: 'POST', json: { codigo, salida } })
export const entrarAMano = (id: number, salida: string) =>
  llamarApi<Lectura>(`/procesion/admin/puerta/papeletas/${id}`, { method: 'POST', json: { salida } })
export const deshacerEntrada = (id: number) =>
  llamarApi<PapeletaEnPuerta>(`/procesion/admin/puerta/papeletas/${id}`, { method: 'DELETE' })
