import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'
import type { Salida } from './salidas'

export type ReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO'

export interface ApiProcessionTicket {
  id: number
  year: number
  salida: { slug: string; nombre: string }
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
  /** El slug de la salida. */
  salida: string
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
    cita: { id: number; turno: { id: number; salidaId: number; fecha: string; horaInicio: string; horaFin: string } } | null
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
  /** Por slug de la salida: una entrada por cada salida activa. */
  porSalida: Record<string, FichaEnUnaSalida>
}

export interface SalidaDelHermano {
  /** El slug de la salida. */
  salida: string
  salidaId: number
  nombre: string
  conRopa: boolean
  cobro: Salida['cobro']
  /** La cuota de la salida; null en las de donativo, donde se da la voluntad. */
  cuotaSalida: number | null
  indicaciones: string | null
  /** Si Secretaría ha abierto la solicitud de esta salida. */
  abierto: boolean
  year: number
  /** Día, hora de entrada y acceso de la salida: los que lleva la papeleta. */
  evento: { fechaSalida: string; horaSalida: string; accesoPuerta: string }
  /** Vacío con el plazo cerrado. */
  dias: DiaDeReparto[]
  /** Con dos o más papeletas de esta salida en la cuenta: el QR para que entren todos con un solo escaneo. */
  qrFamilia: { codigo: string; svg: string } | null
}

export interface MiProcesion {
  /** Las activas, por su orden. */
  salidas: SalidaDelHermano[]
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
  /** El slug de la salida. */
  salida: string
  abierto: boolean
  cambiadoEl: string | null
  year: number
  diasDeReparto: number
  primerDia: string | null
  ultimoDia: string | null
  citasReservadas: number
  /** Null en las de donativo. */
  cuotaSalida: number | null
  /** Solo en las de fecha a mano: su acto en la Agenda, o null si aún no tiene fecha. */
  fecha?: { eventoId: number; inicio: string; lugar: string | null } | null
}

/** Todas las rutas de la procesión piden la salida: suponer una, con varias, sería equivocarse en silencio. */
export const deLaSalida = (slug: string) => `salida=${encodeURIComponent(slug)}`

export function plazoDePapeletas(salida: string) {
  return llamarApi<PlazoDePapeletas>(`/procesion/admin/plazo?${deLaSalida(salida)}`)
}

export function cambiarPlazo(abierto: boolean, salida: string, opciones: { avisar?: boolean; borradorNoticia?: boolean } = {}) {
  return llamarApi<{ abierto: boolean; avisados: number; noticiaId: number | null }>('/procesion/admin/plazo', {
    method: 'POST',
    json: { abierto, ...opciones, salida },
  })
}

export interface TurnoDeReparto {
  id: number
  salidaId: number
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

export function turnosDeReparto(salida: string) {
  return llamarApi<TurnoDeReparto[]>(`/procesion/admin/turnos?${deLaSalida(salida)}`)
}

export function crearTurno(datos: { fecha: string; horaInicio: string; horaFin: string; capacidadEstimada: number; salida: string }) {
  return llamarApi<TurnoDeReparto>('/procesion/admin/turnos', { method: 'POST', json: datos })
}

export function eliminarTurno(id: number) {
  return llamarApi<{ message: string }>(`/procesion/admin/turnos/${id}`, { method: 'DELETE' })
}

// --- El cortejo por antigüedad ---

export interface ConfiguracionCortejo {
  /** Del primero (el que abre) al último (junto al trono). */
  tramos: { nombre: string; plazas: number }[]
  /** Los puestos que se reparten en los tramos. */
  puestos: string[]
}

export interface EstadoCortejo {
  /** El slug de la salida. */
  salida: string
  year: number
  config: ConfiguracionCortejo
  papeletas: number
  /** Papeletas cuyo hermano está de baja: cuentan en `papeletas`, pero quedan fuera del reparto. */
  deBaja: number
  reparto: {
    tramos: { nombre: string; plazas: number; asignados: number }[]
    /** Papeletas de puestos que no se reparten (trono, acólitos…): no se tocan. */
    fuera: number
    /** Papeletas que cambiarían de tramo o de lugar al repartir. */
    cambios: number
  }
  /** Cómo está ahora, por tramos; `tramo: null` son las que aún no tienen. */
  actual: {
    tramo: string | null
    hermanos: { papeletaId: number; numero: number | null; puesto: string; seReparte: boolean; nombre: string; apellidos: string; numeroHermano: number | null; deBaja: boolean }[]
  }[]
}

export const estadoCortejo = (salida: string) => llamarApi<EstadoCortejo>(`/procesion/admin/cortejo?${deLaSalida(salida)}`)

export const guardarTramosCortejo = (salida: string, config: ConfiguracionCortejo) =>
  llamarApi<ConfiguracionCortejo>('/procesion/admin/cortejo/configuracion', { method: 'PUT', json: { salida, ...config } })

export const repartirCortejo = (salida: string, year: number) =>
  llamarApi<{ message: string; cambiadas: number }>('/procesion/admin/cortejo/aplicar', { method: 'POST', json: { salida, year } })
