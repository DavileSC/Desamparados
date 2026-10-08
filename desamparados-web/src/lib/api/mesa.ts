import { llamarApi, traerArchivo } from './cliente'
import { guardarEnDisco } from './datos'
import type { ReceiptStatus } from './procesion'
import type { MetodoPago } from './contabilidad'
import { deLaSalida } from './procesion'

/**
 * La mesa de la procesión por zonas: Inscripción apunta la solicitud,
 * Tesorería cobra (o perdona las cuotas) y Túnicas da la ropa, que es cuando
 * nace la papeleta. Después de la salida, Devolución recibe la ropa: todo lo
 * prestado vuelve al ropero. Cada ordenador se entera de lo que hacen los otros por un
 * canal en vivo (`URL_EVENTOS_MESA`).
 *
 * Las operaciones que mueven algo llevan una `clave` que el ordenador genera
 * al abrirlas y repite si reintenta: si la WiFi se corta después de cobrar,
 * volver a pulsar no cobra dos veces.
 */

export type Situacion = 'activo' | 'baja' | 'pendiente'
export type OrigenTunica = 'ROPERO' | 'PROPIA' | 'NINGUNA'
export type TipoRopa = 'TUNICA' | 'CAPIROTE' | 'FARAONA'
export type ZonaDeBusqueda = 'inscripcion' | 'tesoreria' | 'tunicas' | 'devolucion' | 'todas'
/** Qué pasa con el cíngulo de una papeleta. Los cíngulos no van numerados: se cuentan. */
export type Cingulo = 'PRESTADO' | 'DEBIDO' | 'PROPIO' | 'NINGUNO' | 'DEVUELTO'
/** Lo que la mesa elige al dar la ropa (DEVUELTO lo pone la devolución). */
export type CinguloEnMesa = Exclude<Cingulo, 'DEVUELTO'>

/** Los cíngulos del ropero. */
export interface RecuentoDeCingulos {
  /** Los que tiene el Grupo. */
  total: number
  /** Prestados y sin devolver. */
  prestados: number
  /** Los que quedan para prestar. */
  enElRopero: number
  /** A quien se le deben porque no quedaban. */
  debidos: number
}
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
  cingulo: Cingulo | null
  recibo: { id: number; concepto: string; importe: number; estado: ReceiptStatus; metodoPago: MetodoPago | null; tipo: string }
}

/** Una prenda numerada del ropero que la persona tiene sin devolver. */
export interface PrendaPrestada {
  id: number
  tipo: string
  numero: string
  talla: string | null
  fechaAsignacion: string | null
}

export interface FichaDeMesa {
  id: number
  nombre: string
  primerApellido: string | null
  segundoApellido: string | null
  apellidos: string
  fechaNacimiento: string
  sexo: 'HOMBRE' | 'MUJER' | null
  /**
   * Con `contactoCompleto: false` (quien no lleva el censo: Tesorería,
   * Albacería), enmascarados: «••••••927», «vi•••@dominio.es». Sirven para
   * confirmar con la persona delante, no para llamar ni para corregirlos.
   */
  telefono: string | null
  email: string | null
  /** `null` también cuando quien pide no lleva el censo: no se le enseña. */
  dni: string | null
  /** Si el DNI y el contacto van enteros. Sin ellos, la mesa no deja corregir el teléfono ni el correo (el servidor da 403). */
  contactoCompleto: boolean
  numeroHermano: number | null
  esTitular: boolean
  situacion: Situacion
  tieneTunicaPropia: boolean
  /** En centímetros. */
  alturaHombro: number | null
  puesto: string | null
  /** El slug de la salida. */
  salida: string
  year: number
  /** Lo que tiene del ropero sin devolver. */
  prendas: PrendaPrestada[]
  /** Sus cíngulos sin devolver, por la papeleta con que se le prestaron. */
  cingulosSinDevolver: { papeletaId: number; year: number }[]
  cingulos: RecuentoDeCingulos
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
    cingulo: Cingulo | null
  } | null
  propuesta: {
    puesto: string
    /** `porTalla`: no tenía una en casa ni estaba libre la de antes; esta la elige su altura al hombro. */
    tunica: { origen: OrigenTunica; numero: string | null; porTalla?: boolean }
    capirote: string | null
    faraona: string | null
    /** El que va con la túnica: la mesa lo cambia a «se le debe» si no quedan. */
    cingulo: 'PRESTADO' | 'PROPIO' | 'NINGUNO'
  }
  /** La cuota de la salida; null en las de donativo. */
  cuotaSalida: number | null
}

export interface PrendaDelRopero {
  id: number
  numero: string
  talla: string | null
  estado: 'DISPONIBLE' | 'PRESTADA' | 'LAVADO' | 'TALLER' | 'BAJA'
  hermano: { id: number; nombre: string; apellidos: string } | null
  /** Quién la lleva en su papeleta de este año, si alguien: no se repite en la misma procesión. */
  enPapeleta?: { id: number; nombre: string; apellidos: string } | null
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
  cingulo: Cingulo | null
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
    /** Enmascarados para quien no lleva el censo («••••••927»): no valen para llamar ni escribir. */
    telefono: string | null
    email: string | null
    alturaHombro: number | null
    numeroHermano: number | null
  }
}

export interface Apuntados {
  year: number
  /** El slug de la salida. */
  salida: string
  apuntados: Apuntado[]
  /** Cuántos recogieron sin cíngulo porque no quedaban. */
  faltanCingulos: number
  puestos: { puesto: string; total: number }[]
}

/** Quien tiene algo del ropero sin devolver, y qué. */
export interface SinDevolver {
  hermano: { id: number; nombre: string; apellidos: string; fechaNacimiento: string; numeroHermano: number | null; telefono: string | null }
  prendas: { id: number; tipo: string; numero: string; fechaAsignacion: string | null }[]
  cingulos: { id: number; year: number }[]
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
  /** El slug de la salida. */
  salida: string
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

/**
 * Quién lleva el censo en la mesa (`ROLES_CENSO_EN_MESA` del backend): busca
 * por un trozo de cualquier dato, ve la ficha entera, corrige el contacto y da
 * de alta. El resto de la mesa (Tesorería, Albacería) cobra y da la ropa.
 */
export const llevaElCensoEnMesa = (rol: string) => rol === 'ADMIN' || rol === 'SECRETARIA'

/** El canal en vivo de la mesa (eventos del servidor). */
export const URL_EVENTOS_MESA = `${(import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')}/procesion/admin/mesa/eventos`

/** La salida va siempre: el servidor no supone ninguna. */
const conSalida = (salida: string, params = new URLSearchParams()) => {
  params.set('salida', salida)
  return `?${params.toString()}`
}

export function apuntados(salida: string, filtro: { q?: string; puesto?: string; faltaCingulo?: boolean } = {}) {
  const params = new URLSearchParams()
  if (filtro.q) params.set('q', filtro.q)
  if (filtro.puesto) params.set('puesto', filtro.puesto)
  if (filtro.faltaCingulo) params.set('faltaCingulo', '1')
  return llamarApi<Apuntados>(`/procesion/admin/mesa/apuntados${conSalida(salida, params)}`)
}

export function buscarPersonas(q: string, salida: string, zona: ZonaDeBusqueda = 'todas') {
  const params = new URLSearchParams({ q, zona })
  return llamarApi<PersonaEncontrada[]>(`/procesion/admin/mesa/personas${conSalida(salida, params)}`)
}

export function esperadosHoy(salida: string) {
  return llamarApi<Esperado[]>(`/procesion/admin/mesa/esperados${conSalida(salida)}`)
}

export function fichaDeMesa(id: number, salida: string) {
  return llamarApi<FichaDeMesa>(`/procesion/admin/mesa/personas/${id}${conSalida(salida)}`)
}

export function colasDeLaMesa(salida: string) {
  return llamarApi<Colas>(`/procesion/admin/mesa/colas${conSalida(salida)}`)
}

export function ropaPorPreparar(salida: string, turnoId?: number) {
  return llamarApi<RopaPorPreparar[]>(`/procesion/admin/mesa/preparacion?${deLaSalida(salida)}${turnoId ? `&turnoId=${turnoId}` : ''}`)
}

export function sinDevolver() {
  return llamarApi<SinDevolver[]>('/procesion/admin/mesa/sin-devolver')
}

export function cingulosDeLaMesa() {
  return llamarApi<RecuentoDeCingulos>('/procesion/admin/mesa/cingulos')
}

export function prendasDelRopero(tipo: TipoRopa, q: string, salida: string) {
  return llamarApi<PrendaDelRopero[]>(`/procesion/admin/mesa/prendas?tipo=${tipo}&q=${encodeURIComponent(q)}&${deLaSalida(salida)}`)
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
  /** El slug de la salida. */
  salida: string
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
  cingulo?: CinguloEnMesa
  alturaHombro?: string
  observaciones?: string
  clave: string
}

export function entregarEnMesa(datos: Entrega) {
  return llamarApi<{ papeletaId: number; puesto: string; numTunicaAsignada: string | null; cingulo: Cingulo | null; repetida: boolean }>(
    '/procesion/admin/mesa/entregar', { method: 'POST', json: datos },
  )
}

export interface Devolucion {
  hermanoId: number
  /** Las prendas que devuelve; `rota`, si hay que arreglarla. */
  prendas: { id: number; rota?: boolean }[]
  /** Las papeletas cuyo cíngulo devuelve. */
  cingulos: number[]
  clave: string
}

export function devolverEnMesa(datos: Devolucion) {
  return llamarApi<{ prendas: { id: number; numero: string; estado: string }[]; cingulos: number; repetida: boolean }>(
    '/procesion/admin/mesa/devolver', { method: 'POST', json: datos },
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
  cingulo?: CinguloEnMesa
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

/**
 * Abre la papeleta en A4 en otra pestaña para imprimirla en la mesa. La
 * pestaña se abre ya, en el mismo clic, porque el navegador bloquea las que
 * nacen después de esperar al servidor; si aun así la bloquea, se descarga.
 */
export async function imprimirPapeleta(papeletaId: number) {
  const ventana = window.open('', '_blank')
  try {
    const archivo = await traerArchivo(`/procesion/admin/papeletas/${papeletaId}/pdf`)
    if (ventana) ventana.location.href = URL.createObjectURL(archivo.blob)
    else guardarEnDisco(archivo, `papeleta-${papeletaId}.pdf`)
  } catch (e) {
    ventana?.close()
    throw e
  }
}
