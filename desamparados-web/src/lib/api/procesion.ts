import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export type ReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO'

export interface ApiProcessionTicket {
  id: number
  year: number
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
  fecha: string
  horaInicio: string
  horaFin: string
  genteApuntada: number
  capacidad: number
}

/** Una ficha de la cuenta, con lo que tiene de la procesión de este año y de la anterior. */
export interface FichaEnLaProcesion {
  id: number
  nombre: string
  apellidos: string
  esTitular: boolean
  parentesco: string | null
  activo: boolean
  tieneTunicaPropia: boolean
  cita: { id: number; turno: { id: number; fecha: string; horaInicio: string; horaFin: string } } | null
  papeleta: { id: number; year: number; puesto: string; tramo: string | null; numero: number | null; recibo: { estado: ReceiptStatus } | null } | null
  ultima: { id: number; year: number; puesto: string; tramo: string | null } | null
}

export interface MiProcesion {
  /** Si Secretaría ha abierto la solicitud de papeletas. */
  abierto: boolean
  year: number
  precios: { papeleta: number | null; alquilerTunica: number | null }
  /** Vacío con el plazo cerrado. */
  dias: DiaDeReparto[]
  fichas: FichaEnLaProcesion[]
}

export function miProcesion() {
  return llamarApi<MiProcesion>('/procesion/mi-estado')
}

/** Reservar día de reparto para una ficha de la cuenta. Con el plazo cerrado, el servidor lo rechaza. */
export function reservarDia(hermanoId: number, turnoId: number) {
  return llamarApi<{ id: number }>('/procesion/avisar', { method: 'POST', json: { hermanoId, turnoId } })
}

export function anularCita(citaId: number) {
  return llamarApi<{ id: number }>(`/procesion/avisar/${citaId}`, { method: 'DELETE' })
}

// --- CMS ---

export interface PlazoDePapeletas {
  abierto: boolean
  cambiadoEl: string | null
  year: number
  diasDeReparto: number
  primerDia: string | null
  ultimoDia: string | null
  citasReservadas: number
  precios: { papeleta: number | null; alquilerTunica: number | null }
}

export function plazoDePapeletas() {
  return llamarApi<PlazoDePapeletas>('/procesion/admin/plazo')
}

export function cambiarPlazo(abierto: boolean, opciones: { avisar?: boolean; borradorNoticia?: boolean } = {}) {
  return llamarApi<{ abierto: boolean; avisados: number; noticiaId: number | null }>('/procesion/admin/plazo', {
    method: 'POST',
    json: { abierto, ...opciones },
  })
}

export interface TurnoDeReparto {
  id: number
  fecha: string
  horaInicio: string
  horaFin: string
  capacidadEstimada: number
  activo: boolean
  _count: { citas: number }
}

export function turnosDeReparto() {
  return llamarApi<TurnoDeReparto[]>('/procesion/admin/turnos')
}

export function crearTurno(datos: { fecha: string; horaInicio: string; horaFin: string; capacidadEstimada: number }) {
  return llamarApi<TurnoDeReparto>('/procesion/admin/turnos', { method: 'POST', json: datos })
}

export function eliminarTurno(id: number) {
  return llamarApi<{ message: string }>(`/procesion/admin/turnos/${id}`, { method: 'DELETE' })
}
