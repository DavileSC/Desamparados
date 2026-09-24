import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export type ReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO'

/** Las dos salidas del año: el Sábado de Pasión y el Rosario vespertino de octubre. */
export type Salida = 'PASION' | 'ROSARIO'

export interface ApiProcessionTicket {
  id: number
  year: number
  salida?: Salida
  puesto: string
  tramo: string | null
  numero: number | null
  hermano: {
    nombre: string
    apellidos: string
  }
  recibo: {
    estado: ReceiptStatus
    importe: number | string
  }
}

export function misPapeletas(pagina: { pagina: number; porPagina: number }) {
  return llamarApi<RespuestaPaginada<ApiProcessionTicket>>(`/procesion/mis-papeletas?${paramsPagina(pagina)}`)
}

/** Un día de reparto: cuándo, y cuánta gente ha reservado ya. */
export interface DiaDeReparto {
  id: number
  salida: Salida
  fecha: string
  horaInicio: string
  horaFin: string
  genteApuntada: number
  capacidad: number
}

export interface CuotaPorPagar {
  id: number
  year: number
  concepto: string
  importe: number
  estado: ReceiptStatus
}

/**
 * Lo de una ficha en una salida: su solicitud (pedida, sin recoger), su
 * papeleta de este año (que nace al recogerla en la mesa) y la última que tuvo.
 */
export interface FichaEnUnaSalida {
  solicitud: {
    id: number
    puesto: string
    donativo: number | null
    /** Lo que falta pagar de la salida (la voluntad del Rosario, o la cuota de salida si la hay). */
    pendiente: number
    concepto: string
    pagada: boolean
    cita: { id: number; turno: { id: number; salida: Salida; fecha: string; horaInicio: string; horaFin: string } } | null
  } | null
  papeleta: { id: number; year: number; puesto: string; tramo: string | null; numero: number | null } | null
  ultima: { id: number; year: number; puesto: string; tramo: string | null } | null
}

/** Una ficha de la cuenta, con lo que debe y lo que tiene de cada salida. */
export interface FichaEnLaProcesion {
  id: number
  nombre: string
  apellidos: string
  esTitular: boolean
  parentesco: string | null
  activo: boolean
  tieneTunicaPropia: boolean
  cuotasPendientes: CuotaPorPagar[]
  cuotasEnElBanco: number
  porSalida: Record<Salida, FichaEnUnaSalida>
}

export interface SalidaDelHermano {
  salida: Salida
  nombre: string
  /** Si Secretaría ha abierto la solicitud de esta salida. */
  abierto: boolean
  year: number
  /** Vacío con el plazo cerrado. */
  dias: DiaDeReparto[]
}

export interface MiProcesion {
  salidas: SalidaDelHermano[]
  /** La cuota de salida de la Pasión: hoy 0 € (y entonces no se enseña nada). */
  cuotaSalida: number | null
  /** Si se puede pagar desde el área (hoy, con la pasarela simulada). */
  pagoEnLinea: boolean
  fichas: FichaEnLaProcesion[]
}

export function miProcesion() {
  return llamarApi<MiProcesion>('/procesion/mi-estado')
}

/**
 * Pedir la papeleta de una ficha de la cuenta: el día de reparto (que dice la
 * salida), el puesto que le gustaría y, en el Rosario, la voluntad. Con el
 * plazo cerrado, el servidor lo rechaza.
 */
export function pedirPapeleta(datos: { hermanoId: number; turnoId: number; puesto: string; donativo?: number }) {
  return llamarApi<{ citaId: number; solicitudId: number }>(
    '/procesion/avisar', { method: 'POST', json: datos },
  )
}

export function anularCita(citaId: number) {
  return llamarApi<{ message: string }>(`/procesion/avisar/${citaId}`, { method: 'DELETE' })
}

/** Pagar en línea lo pendiente de la familia: cuotas y lo de la salida (hoy la pasarela está simulada). */
export function pagarEnLinea(pago: { reciboIds: number[]; solicitudIds: number[] }, clave: string) {
  return llamarApi<{ total: number; repetida: boolean }>('/recibos/mis-recibos/pagar', { method: 'POST', json: { ...pago, clave } })
}

// --- CMS ---

export interface PlazoDePapeletas {
  salida: Salida
  abierto: boolean
  cambiadoEl: string | null
  year: number
  diasDeReparto: number
  primerDia: string | null
  ultimoDia: string | null
  citasReservadas: number
  /** Solo la Pasión. */
  cuotaSalida: number | null
  /** Solo el Rosario: su acto en la Agenda, si ya tiene fecha. */
  rosario?: { eventoId: number; inicio: string; lugar: string | null } | null
}

const deLaSalida = (salida: Salida) => (salida === 'PASION' ? '' : `?salida=${salida}`)

export function plazoDePapeletas(salida: Salida = 'PASION') {
  return llamarApi<PlazoDePapeletas>(`/procesion/admin/plazo${deLaSalida(salida)}`)
}

export function cambiarPlazo(abierto: boolean, opciones: { avisar?: boolean; borradorNoticia?: boolean; salida?: Salida } = {}) {
  return llamarApi<{ abierto: boolean; avisados: number; noticiaId: number | null }>('/procesion/admin/plazo', {
    method: 'POST',
    json: { abierto, ...opciones },
  })
}

/** Fijar (o mover) la fecha del Rosario vespertino: sale en la Agenda pública. */
export function fijarRosario(datos: { inicio: string; lugar?: string | null }) {
  return llamarApi<{ eventoId: number; inicio: string; lugar: string | null }>('/procesion/admin/rosario', { method: 'PUT', json: datos })
}

/** La cuota de salida de la Pasión: la configuración de siempre (solo el administrador). */
export function cambiarCuotaSalida(valor: string) {
  return llamarApi<unknown>('/admin/config', { method: 'POST', json: { key: 'precio_papeleta_sitio', value: valor } })
}

export interface TurnoDeReparto {
  id: number
  salida: Salida
  fecha: string
  horaInicio: string
  horaFin: string
  capacidadEstimada: number
  activo: boolean
  _count: { citas: number }
}

export function turnosDeReparto(salida?: Salida) {
  return llamarApi<TurnoDeReparto[]>(`/procesion/admin/turnos${salida ? `?salida=${salida}` : ''}`)
}

export function crearTurno(datos: { fecha: string; horaInicio: string; horaFin: string; capacidadEstimada: number; salida?: Salida }) {
  return llamarApi<TurnoDeReparto>('/procesion/admin/turnos', { method: 'POST', json: datos })
}

export function eliminarTurno(id: number) {
  return llamarApi<{ message: string }>(`/procesion/admin/turnos/${id}`, { method: 'DELETE' })
}
