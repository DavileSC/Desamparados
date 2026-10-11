import { llamarApi, traerArchivo } from './cliente'

export type TipoCabildo = 'ORDINARIO' | 'EXTRAORDINARIO'
export type EstadoCabildo = 'CONVOCADO' | 'CELEBRADO' | 'ACTA_APROBADA'
export type Mayoria = 'SIMPLE' | 'DOS_TERCIOS'

export interface CabildoEnLista {
  id: number
  tipo: TipoCabildo
  fecha: string
  lugar: string
  estado: EstadoCabildo
  puntos: number
  asistentes: number
  votaciones: number
}

export interface Votacion {
  id: number
  asunto: string
  mayoria: Mayoria
  aFavor: number
  enContra: number
  abstenciones: number
  resultado: 'APROBADO' | 'RECHAZADO'
}

export interface Cabildo {
  id: number
  tipo: TipoCabildo
  fecha: string
  lugar: string
  ordenDelDia: string[]
  estado: EstadoCabildo
  enSegunda: boolean
  acta: string
  actaAprobadaEl: string | null
  /** El borrador de aviso con la convocatoria, en Boletín y avisos. */
  convocatoriaId: number | null
  reglas: { edadMinima: number; antiguedadMinima: number; quorumPrimera: number }
  quorum: { censoConVoto: number; presentesConVoto: number; necesarios: number; enPrimera: boolean }
  asistentes: { hermanoId: number; nombre: string; apellidos: string; numeroHermano: number | null; conVoto: boolean }[]
  votaciones: Votacion[]
}

interface DatosCabildo {
  tipo: TipoCabildo
  /** Día y hora en ISO. */
  fecha: string
  lugar: string
  ordenDelDia: string[]
}

export const cabildos = () => llamarApi<CabildoEnLista[]>('/cabildos')
export const cabildo = (id: number) => llamarApi<Cabildo>(`/cabildos/${id}`)
export const convocarCabildo = (datos: DatosCabildo) => llamarApi<Cabildo>('/cabildos', { method: 'POST', json: datos })
export const guardarCabildo = (id: number, datos: DatosCabildo) => llamarApi<Cabildo>(`/cabildos/${id}`, { method: 'PUT', json: datos })
export const borrarCabildo = (id: number) => llamarApi<void>(`/cabildos/${id}`, { method: 'DELETE' })
export const prepararConvocatoria = (id: number) => llamarApi<{ comunicadoId: number }>(`/cabildos/${id}/convocatoria`, { method: 'POST' })
export const apuntarAsistente = (id: number, hermanoId: number) => llamarApi<Cabildo>(`/cabildos/${id}/asistentes`, { method: 'POST', json: { hermanoId } })
export const quitarAsistente = (id: number, hermanoId: number) => llamarApi<Cabildo>(`/cabildos/${id}/asistentes/${hermanoId}`, { method: 'DELETE' })
export const apuntarVotacion = (id: number, v: Omit<Votacion, 'id' | 'resultado'>) => llamarApi<Cabildo>(`/cabildos/${id}/votaciones`, { method: 'POST', json: v })
export const borrarVotacion = (id: number, votacionId: number) => llamarApi<Cabildo>(`/cabildos/${id}/votaciones/${votacionId}`, { method: 'DELETE' })
export const darPorCelebrado = (id: number, enSegunda: boolean) => llamarApi<Cabildo>(`/cabildos/${id}/celebrar`, { method: 'POST', json: { enSegunda } })
export const guardarActa = (id: number, acta: string) => llamarApi<Cabildo>(`/cabildos/${id}/acta`, { method: 'PUT', json: { acta } })
export const aprobarActa = (id: number) => llamarApi<Cabildo>(`/cabildos/${id}/acta/aprobar`, { method: 'POST' })
export const actaEnPdf = (id: number) => traerArchivo(`/cabildos/${id}/acta.pdf`)
export const libroDeActas = (anio: number) => traerArchivo(`/cabildos/libro/${anio}`)
