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
  /** La papeleta de este año, ya recogida: con su QR para enseñarlo en la puerta. */
  papeleta: {
    id: number
    year: number
    puesto: string
    tramo: string | null
    numero: number | null
    /** «2027-0012». */
    referencia: string
    tunica: string | null
    /** El texto del QR y el QR ya dibujado (SVG). */
    qr: { codigo: string; svg: string } | null
  } | null
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
  numeroHermano: number | null
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
  /** Día, hora de entrada y acceso de la salida: los que lleva la papeleta. */
  evento: { fechaSalida: string; horaSalida: string; accesoPuerta: string }
  /** Vacío con el plazo cerrado. */
  dias: DiaDeReparto[]
}

export interface MiProcesion {
  salidas: SalidaDelHermano[]
  /** La cuota de salida de la Pasión: hoy 0 € (y entonces no se enseña nada). */
  cuotaSalida: number | null
  /** Si se puede pagar desde el área (hoy, con la pasarela simulada). */
  pagoEnLinea: boolean
  /** Con qué se paga en línea y si es de pruebas (no se cobra de verdad). Null si no hay pago en línea. */
  pago: { metodos: MetodoEnLinea[]; pruebas: boolean } | null
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

export type MetodoEnLinea = 'TARJETA' | 'BIZUM'

/**
 * Empezar a pagar lo pendiente de la familia. Con el banco, vuelve el
 * formulario firmado que hay que enviar a Redsys; simulado, ya está pagado.
 */
export type InicioDePago =
  | { tipo: 'hecho'; total: number; repetida: boolean }
  | { tipo: 'banco'; pedido: string; url: string; campos: Record<string, string> }

export function pagarEnLinea(pago: { reciboIds: number[]; solicitudIds: number[]; metodo: MetodoEnLinea }, clave: string) {
  return llamarApi<InicioDePago>('/recibos/mis-recibos/pagar', { method: 'POST', json: { ...pago, clave } })
}

export type EstadoDelPago = 'PENDIENTE' | 'PAGADO' | 'RECHAZADO' | 'INCIDENCIA'

/** Cómo va un pago, a la vuelta del banco: el aviso del banco puede llegar unos segundos después. */
export function estadoDelPago(pedido: string) {
  return llamarApi<{ estado: EstadoDelPago; importe: number }>(`/recibos/mis-recibos/pagos/${encodeURIComponent(pedido)}`)
}

/** Lleva al hermano a la página del banco: un formulario que se envía solo, como pide Redsys. */
export function irAlBanco(inicio: { url: string; campos: Record<string, string> }) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = inicio.url
  for (const [nombre, valor] of Object.entries(inicio.campos)) {
    const campo = document.createElement('input')
    campo.type = 'hidden'
    campo.name = nombre
    campo.value = valor
    form.appendChild(campo)
  }
  document.body.appendChild(form)
  form.submit()
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
  /** Las que no se anularon: reservadas, atendidas y las de quien no vino. */
  citas: number
  /** Las atendidas: quien vino y se llevó la papeleta. */
  vinieron: number
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
