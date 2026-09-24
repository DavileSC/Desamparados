import { llamarApi } from './cliente'
import type { ReceiptStatus } from './procesion'
import type { MetodoPago } from './contabilidad'

/**
 * La mesa de la procesión por zonas: Inscripción apunta la solicitud,
 * Tesorería cobra (o perdona las cuotas) y Túnicas da la ropa, que es cuando
 * nace la papeleta. Cada ordenador se entera de lo que hacen los otros por un
 * canal en vivo (`URL_EVENTOS_MESA`).
 *
 * Las operaciones que mueven algo llevan una `clave` que el ordenador genera
 * al abrirlas y repite si reintenta: si la WiFi se corta después de cobrar,
 * volver a pulsar no cobra dos veces.
 */

export type Salida = 'PASION' | 'ROSARIO'
export type Situacion = 'activo' | 'baja' | 'pendiente'
export type OrigenTunica = 'ROPERO' | 'PROPIA' | 'NINGUNA'
export type TipoRopa = 'TUNICA' | 'CAPIROTE' | 'FARAONA'
export type ZonaDeBusqueda = 'inscripcion' | 'tesoreria' | 'tunicas' | 'todas'
export type MetodoEnMesa = Exclude<MetodoPago, 'DOMICILIACION'>

export interface PersonaEncontrada {
  id: number
  nombre: string
  apellidos: string
  fechaNacimiento: string
  numeroHermano: number | null
  situacion: Situacion
  /** Si ya está apuntado a la salida: con la solicitud pendiente, o ya recogida. */
  apuntado: { puesto: string; recogida: boolean } | null
}

export interface Esperado {
  citaId: number
  id: number
  nombre: string
  apellidos: string
  fechaNacimiento: string
}

export interface CuotaPendiente {
  id: number
  year: number
  concepto: string
  importe: number
  estado: ReceiptStatus
}

export interface Requisitos {
  /** Lo de la salida (la cuota de salida o el donativo) está pagado o no hay nada que pagar. */
  salidaPagada: boolean
  /** Lo que falta de la salida, en euros. */
  salidaPendiente: number
  cuotasPendientes: CuotaPendiente[]
  cuotasEnElBanco: CuotaPendiente[]
  totalPendiente: number
  puedeRecoger: boolean
  motivos: string[]
}

/** Lo que pidió (en su área o en Inscripción) y aún no ha recogido. */
export interface SolicitudDeLaMesa {
  id: number
  puesto: string
  observaciones: string | null
  origen: 'WEB' | 'MESA'
  /** La voluntad que dijo dar (Rosario). */
  donativo: number | null
  /** Lo que falta pagar de la salida. */
  pendiente: number
  /** Cómo se llamará su recibo al cobrarlo. */
  concepto: string
  cita: { fecha: string; horaInicio: string } | null
}

/** La papeleta, que nace al recoger en Túnicas. */
export interface PapeletaDeLaMesa {
  id: number
  year: number
  puesto: string
  /** Lo que había pedido, si lo pidió. */
  puestoPedido: string | null
  tramo: string | null
  observaciones: string | null
  numTunicaAsignada: string | null
  numCapiroteAsignado: string | null
  numFaraonaAsignada: string | null
  origenTunica: OrigenTunica | null
  recibo: { id: number; concepto: string; importe: number; estado: ReceiptStatus; metodoPago: MetodoPago | null; tipo: string }
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
  salida: Salida
  year: number
  prendas: { tipo: string; numero: string; talla: string | null }[]
  solicitud: SolicitudDeLaMesa | null
  papeleta: PapeletaDeLaMesa | null
  requisitos: Requisitos
  /** Las otras fichas de la cuenta con cuotas por pagar: la familia suele pagar junta. */
  familia: { id: number; nombre: string; apellidos: string; cuotasPendientes: CuotaPendiente[] }[]
  anterior: {
    year: number
    puesto: string
    origenTunica: OrigenTunica | null
    numTunicaAsignada: string | null
    numCapiroteAsignado: string | null
    numFaraonaAsignada: string | null
  } | null
  propuesta: {
    puesto: string
    tunica: { origen: OrigenTunica; numero: string | null }
    capirote: string | null
    faraona: string | null
  }
  /** La cuota de salida de la Pasión (hoy 0 €); null en el Rosario. */
  cuotaSalida: number | null
}

export interface PrendaDelRopero {
  id: number
  numero: string
  talla: string | null
  estado: 'DISPONIBLE' | 'PRESTADA' | 'TALLER' | 'BAJA'
  hermano: { id: number; nombre: string; apellidos: string } | null
}

export type EstadoEnLaMesa = 'por-pagar' | 'lista' | 'recogida'

/** Una fila del listado: una solicitud sin recoger, o una papeleta ya recogida. */
export interface Apuntado {
  tipo: 'solicitud' | 'papeleta'
  id: number
  puesto: string
  puestoPedido: string | null
  tramo: string | null
  observaciones: string | null
  createdAt: string
  numTunicaAsignada: string | null
  numCapiroteAsignado: string | null
  numFaraonaAsignada: string | null
  origenTunica: OrigenTunica | null
  /** Lo pagado por la salida, si hay recibo. */
  pagado: { importe: number; estado: ReceiptStatus; metodoPago: MetodoPago | null } | null
  estado: EstadoEnLaMesa
  /** Lo que le falta por pagar, en euros. */
  pendiente: number
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
  salida: Salida
  apuntados: Apuntado[]
  puestos: { puesto: string; total: number }[]
}

export interface EnCola {
  solicitudId: number
  hermano: { id: number; nombre: string; apellidos: string; fechaNacimiento: string; numeroHermano: number | null }
  puesto: string
  conCitaHoy: boolean
  totalPendiente: number
  motivos: string[]
  puedeRecoger: boolean
}

export interface Colas {
  salida: Salida
  year: number
  porCobrar: EnCola[]
  porRecoger: EnCola[]
}

export interface RopaPorPreparar {
  solicitudId: number
  dia: string | null
  hermano: { id: number; nombre: string; apellidos: string; fechaNacimiento: string; alturaHombro: number | null }
  puesto: string
  propuesta: FichaDeMesa['propuesta']
  tallaTunica: string | null
  cuotasPendientes: number
}

/** El canal en vivo de la mesa (eventos del servidor). */
export const URL_EVENTOS_MESA = `${(import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')}/procesion/admin/mesa/eventos`

const conSalida = (salida: Salida, params = new URLSearchParams()) => {
  if (salida !== 'PASION') params.set('salida', salida)
  const consulta = params.toString()
  return consulta ? `?${consulta}` : ''
}

export function apuntados(salida: Salida, filtro: { q?: string; puesto?: string } = {}) {
  const params = new URLSearchParams()
  if (filtro.q) params.set('q', filtro.q)
  if (filtro.puesto) params.set('puesto', filtro.puesto)
  return llamarApi<Apuntados>(`/procesion/admin/mesa/apuntados${conSalida(salida, params)}`)
}

export function buscarPersonas(q: string, zona: ZonaDeBusqueda = 'todas', salida: Salida = 'PASION') {
  const params = new URLSearchParams({ q, zona })
  return llamarApi<PersonaEncontrada[]>(`/procesion/admin/mesa/personas${conSalida(salida, params)}`)
}

export function esperadosHoy(salida: Salida = 'PASION') {
  return llamarApi<Esperado[]>(`/procesion/admin/mesa/esperados${conSalida(salida)}`)
}

export function fichaDeMesa(id: number, salida: Salida = 'PASION') {
  return llamarApi<FichaDeMesa>(`/procesion/admin/mesa/personas/${id}${conSalida(salida)}`)
}

export function colasDeLaMesa(salida: Salida) {
  return llamarApi<Colas>(`/procesion/admin/mesa/colas${conSalida(salida)}`)
}

export function ropaPorPreparar(turnoId?: number) {
  return llamarApi<RopaPorPreparar[]>(`/procesion/admin/mesa/preparacion${turnoId ? `?turnoId=${turnoId}` : ''}`)
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

// --- Las zonas ---

export interface Inscripcion {
  hermanoId: number
  salida: Salida
  puesto: string
  observaciones?: string
  donativo?: number
  alturaHombro?: string
  clave: string
}

export function inscribirEnMesa(datos: Inscripcion) {
  return llamarApi<{ solicitudId: number; puesto: string; requisitos: Requisitos }>(
    '/procesion/admin/mesa/inscribir', { method: 'POST', json: datos },
  )
}

export interface Cobro {
  hermanoId: number
  /** Cuotas por cobrar. */
  reciboIds: number[]
  /** Lo de la salida de una solicitud; en el Rosario, `importe` es lo que da al final. */
  solicitudes?: { solicitudId: number; importe?: number }[]
  metodoPago: MetodoEnMesa
  clave: string
}

export function cobrarEnMesa(datos: Cobro) {
  return llamarApi<{ cobrados: { id: number; concepto: string; importe: number }[]; total: number; repetida: boolean }>(
    '/procesion/admin/mesa/cobrar', { method: 'POST', json: datos },
  )
}

export function perdonarCuotas(datos: { reciboIds: number[]; motivo?: string; clave: string }) {
  return llamarApi<{ perdonadas: { id: number; concepto: string }[]; repetida: boolean }>('/procesion/admin/mesa/perdonar', { method: 'POST', json: datos })
}

export interface Entrega {
  solicitudId: number
  puesto?: string
  origenTunica?: OrigenTunica
  numTunicaAsignada?: string
  numCapiroteAsignado?: string
  numFaraonaAsignada?: string
  crearPrendas?: TipoRopa[]
  alturaHombro?: string
  observaciones?: string
  clave: string
}

export function entregarEnMesa(datos: Entrega) {
  return llamarApi<{ papeletaId: number; puesto: string; numTunicaAsignada: string | null; repetida: boolean }>(
    '/procesion/admin/mesa/entregar', { method: 'POST', json: datos },
  )
}

export interface CambiosDePapeleta {
  puesto?: string
  observaciones?: string | null
  origenTunica?: OrigenTunica
  numTunicaAsignada?: string | null
  numCapiroteAsignado?: string | null
  numFaraonaAsignada?: string | null
  crearPrendas?: TipoRopa[]
}

export function corregirPapeleta(id: number, cambios: CambiosDePapeleta) {
  return llamarApi<{ id: number }>(`/procesion/admin/papeletas/${id}`, { method: 'PATCH', json: cambios })
}

export function corregirSolicitud(id: number, cambios: { puesto?: string; observaciones?: string | null; donativo?: number }) {
  return llamarApi<{ id: number }>(`/procesion/admin/solicitudes/${id}`, { method: 'PATCH', json: cambios })
}

export function cancelarSolicitud(id: number) {
  return llamarApi<{ message: string }>(`/procesion/admin/solicitudes/${id}`, { method: 'DELETE' })
}

export function anularPapeleta(id: number) {
  return llamarApi<{ message: string }>(`/procesion/admin/papeletas/${id}/anular`, { method: 'DELETE' })
}
