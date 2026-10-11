import { llamarApi, traerArchivo } from './cliente'
import type { MetodoPago } from './contabilidad'

/** Cómo se paga en la lotería: en mano o por el banco, nunca domiciliado. */
export type MetodoDeLoteria = Exclude<MetodoPago, 'DOMICILIACION'>

/** Lo que se escribe de un sorteo. Importes en euros. */
export interface DatosSorteo {
  nombre: string
  /** AAAA-MM-DD. */
  fecha: string
  numeros: string[]
  precioDecimo: number
  /** Décimos de cada número. */
  decimos: number
  precioParticipacion: number
  /** Lo que juega cada participación, repartido entre los números; el resto es donativo. */
  jugado: number
  porTalonario: number
  /** Vacío: el texto legal de siempre. */
  leyenda: string
}

export interface Sorteo extends Omit<DatosSorteo, 'numeros'> {
  id: number
  /** Con lo que gana un décimo de cada uno, cuando se sabe. */
  numeros: { numero: string; premio: number | null }[]
  compra: { importe: number; fecha: string; metodoPago: MetodoPago | null } | null
  maximoDeParticipaciones: number
  talonarios: number
  /** Los que están en la calle: dados y sin liquidar. */
  entregados: number
  liquidados: number
  vendidas: number
  recaudado: number
  premioPorParticipacion: number
  /** Lo que hay que pagar en premios por las participaciones vendidas. */
  premiosVendidos: number
}

export interface Talonario {
  id: number
  numero: number
  desde: number
  hasta: number
  responsable: string | null
  telefono: string | null
  entregadoEl: string | null
  vendidas: number | null
  metodoPago: MetodoPago | null
  liquidadoEl: string | null
  importe: number | null
}

export interface SorteoConTalonarios extends Sorteo { lista: Talonario[] }

interface Entrega { desde: number; hasta: number; responsable: string | null; telefono: string | null }

export const sorteos = () => llamarApi<Sorteo[]>('/loteria')
export const sorteo = (id: number) => llamarApi<SorteoConTalonarios>(`/loteria/${id}`)
export const crearSorteo = (d: DatosSorteo) => llamarApi<SorteoConTalonarios>('/loteria', { method: 'POST', json: d })
export const guardarSorteo = (id: number, d: DatosSorteo) => llamarApi<SorteoConTalonarios>(`/loteria/${id}`, { method: 'PUT', json: d })
export const borrarSorteo = (id: number) => llamarApi<{ message: string }>(`/loteria/${id}`, { method: 'DELETE' })
export const guardarPremios = (id: number, premios: (number | null)[]) => llamarApi<SorteoConTalonarios>(`/loteria/${id}/premios`, { method: 'PUT', json: { premios } })
export const apuntarCompra = (id: number, metodoPago: MetodoDeLoteria) => llamarApi<SorteoConTalonarios>(`/loteria/${id}/compra`, { method: 'POST', json: { metodoPago } })
export const deshacerCompra = (id: number) => llamarApi<SorteoConTalonarios>(`/loteria/${id}/compra`, { method: 'DELETE' })
export const crearTalonarios = (id: number, cantidad: number) => llamarApi<SorteoConTalonarios>(`/loteria/${id}/talonarios`, { method: 'POST', json: { cantidad } })
export const entregarTalonarios = (id: number, e: Entrega) => llamarApi<SorteoConTalonarios>(`/loteria/${id}/entregas`, { method: 'POST', json: e })
export const quitarTalonario = (talonarioId: number) => llamarApi<SorteoConTalonarios>(`/loteria/talonarios/${talonarioId}`, { method: 'DELETE' })
export const liquidarTalonario = (talonarioId: number, vendidas: number, metodoPago: MetodoDeLoteria | null) =>
  llamarApi<SorteoConTalonarios>(`/loteria/talonarios/${talonarioId}/liquidacion`, { method: 'POST', json: { vendidas, metodoPago } })
export const deshacerLiquidacion = (talonarioId: number) => llamarApi<SorteoConTalonarios>(`/loteria/talonarios/${talonarioId}/liquidacion`, { method: 'DELETE' })

/** Las participaciones de los talonarios `desde` a `hasta`, en PDF. */
export const pdfDeParticipaciones = (id: number, desde: number, hasta: number) => traerArchivo(`/loteria/${id}/participaciones`, { desde, hasta })
