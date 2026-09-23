import { llamarApi } from './cliente'
import type { ReceiptStatus } from './procesion'
import type { MetodoPago } from './contabilidad'

/**
 * La mesa de la procesión: buscar a la persona, darla de alta si no está en el
 * censo, corregir sus datos y apuntarla con su puesto y su ropa, cobrando.
 */

export type Situacion = 'activo' | 'baja' | 'pendiente'
export type OrigenTunica = 'ROPERO' | 'PROPIA' | 'NINGUNA'
export type TipoRopa = 'TUNICA' | 'CAPIROTE' | 'FARAONA'

export interface PersonaEncontrada {
  id: number
  nombre: string
  apellidos: string
  fechaNacimiento: string
  numeroHermano: number | null
  situacion: Situacion
  papeleta: { id: number; puesto: string } | null
}

export interface Esperado {
  citaId: number
  id: number
  nombre: string
  apellidos: string
  fechaNacimiento: string
}

export interface PapeletaDeLaMesa {
  id: number
  year: number
  puesto: string
  tramo: string | null
  observaciones: string | null
  numTunicaAsignada: string | null
  numCapiroteAsignado: string | null
  numFaraonaAsignada: string | null
  origenTunica: OrigenTunica | null
  recibo: { importe: number; estado: ReceiptStatus; metodoPago: MetodoPago | null }
}

export interface FichaDeMesa {
  id: number
  nombre: string
  primerApellido: string | null
  segundoApellido: string | null
  apellidos: string
  fechaNacimiento: string
  sexo: 'HOMBRE' | 'MUJER' | null
  telefono: string | null
  email: string | null
  dni: string | null
  numeroHermano: number | null
  esTitular: boolean
  situacion: Situacion
  tieneTunicaPropia: boolean
  /** En centímetros. */
  alturaHombro: number | null
  puesto: string | null
  year: number
  prendas: { tipo: string; numero: string; talla: string | null }[]
  papeleta: PapeletaDeLaMesa | null
  anterior: {
    year: number
    puesto: string
    origenTunica: OrigenTunica | null
    numTunicaAsignada: string | null
    numCapiroteAsignado: string | null
    numFaraonaAsignada: string | null
  } | null
  cita: { id: number; fecha: string; horaInicio: string } | null
  propuesta: {
    puesto: string
    tunica: { origen: OrigenTunica; numero: string | null }
    capirote: string | null
    faraona: string | null
  }
  precios: { papeleta: number; alquiler: number }
}

export interface PrendaDelRopero {
  id: number
  numero: string
  talla: string | null
  estado: 'DISPONIBLE' | 'PRESTADA' | 'TALLER' | 'BAJA'
  hermano: { id: number; nombre: string; apellidos: string } | null
}

export interface Apuntado {
  id: number
  puesto: string
  tramo: string | null
  observaciones: string | null
  createdAt: string
  numTunicaAsignada: string | null
  numCapiroteAsignado: string | null
  numFaraonaAsignada: string | null
  origenTunica: OrigenTunica | null
  recibo: { importe: number; estado: ReceiptStatus; metodoPago: MetodoPago | null }
  hermano: {
    id: number
    nombre: string
    apellidos: string
    fechaNacimiento: string
    telefono: string | null
    email: string | null
    alturaHombro: number | null
    numeroHermano: number | null
  }
}

export interface Apuntados {
  year: number
  papeletas: Apuntado[]
  puestos: { puesto: string; total: number }[]
}

export function apuntados(filtro: { q?: string; puesto?: string } = {}) {
  const params = new URLSearchParams()
  if (filtro.q) params.set('q', filtro.q)
  if (filtro.puesto) params.set('puesto', filtro.puesto)
  const consulta = params.toString()
  return llamarApi<Apuntados>(`/procesion/admin/mesa/apuntados${consulta ? `?${consulta}` : ''}`)
}

export function buscarPersonas(q: string) {
  return llamarApi<PersonaEncontrada[]>(`/procesion/admin/mesa/personas?q=${encodeURIComponent(q)}`)
}

export function esperadosHoy() {
  return llamarApi<Esperado[]>('/procesion/admin/mesa/esperados')
}

export function fichaDeMesa(id: number) {
  return llamarApi<FichaDeMesa>(`/procesion/admin/mesa/personas/${id}`)
}

export function prendasDelRopero(tipo: TipoRopa, q: string) {
  return llamarApi<PrendaDelRopero[]>(`/procesion/admin/mesa/prendas?tipo=${tipo}&q=${encodeURIComponent(q)}`)
}

export interface DatosDeAlta {
  nombre: string
  primerApellido: string
  segundoApellido?: string
  fechaNacimiento: string
  sexo?: 'HOMBRE' | 'MUJER'
  telefono?: string
  email?: string
  dni?: string
  parentesco?: 'HIJO' | 'SOBRINO' | 'NIETO' | 'AHIJADO' | 'OTRO'
  tutorHermanoId?: number
  tutorNuevo?: { nombre: string; primerApellido: string; segundoApellido?: string; dni: string; telefono: string; email: string }
}

export function darDeAltaEnMesa(datos: DatosDeAlta) {
  return llamarApi<{ id: number; numeroHermano: number; nombre: string; apellidos: string }>('/procesion/admin/mesa/personas', { method: 'POST', json: datos })
}

export interface CorreccionDeFicha {
  nombre?: string
  primerApellido?: string
  segundoApellido?: string | null
  fechaNacimiento?: string
  telefono?: string | null
  email?: string | null
  alturaHombro?: string | null
}

export function corregirFicha(id: number, datos: CorreccionDeFicha) {
  return llamarApi<{ cambiados: number }>(`/procesion/admin/mesa/personas/${id}`, { method: 'PATCH', json: datos })
}

export function activarPersona(id: number) {
  return llamarApi<{ message: string }>(`/procesion/admin/mesa/personas/${id}/activar`, { method: 'POST' })
}

export interface Apunte {
  hermanoId: number
  citaId?: number
  metodoPago: Exclude<MetodoPago, 'DOMICILIACION'>
  puesto: string
  observaciones?: string
  origenTunica: OrigenTunica
  numTunicaAsignada?: string
  numCapiroteAsignado?: string
  numFaraonaAsignada?: string
  crearPrendas?: TipoRopa[]
  alturaHombro?: string
}

export function apuntarEnMesa(apunte: Apunte) {
  return llamarApi<{ msg: string; data: { recibo: { importe: string | number; metodoPago: MetodoPago | null }; papeleta: { id: number } } }>(
    '/procesion/admin/inscribir',
    { method: 'POST', json: apunte },
  )
}

export interface CambiosDePapeleta {
  puesto?: string
  observaciones?: string | null
  numTunicaAsignada?: string | null
  numCapiroteAsignado?: string | null
  numFaraonaAsignada?: string | null
  crearPrendas?: TipoRopa[]
}

export function corregirPapeleta(id: number, cambios: CambiosDePapeleta) {
  return llamarApi<{ id: number }>(`/procesion/admin/papeletas/${id}`, { method: 'PATCH', json: cambios })
}

export function anularPapeleta(id: number) {
  return llamarApi<{ message: string }>(`/procesion/admin/papeletas/${id}/anular`, { method: 'DELETE' })
}
