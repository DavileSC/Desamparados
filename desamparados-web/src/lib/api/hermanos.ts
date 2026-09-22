import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'
import type { Parentesco } from './auth'
import type { EstadoCivil, Sexo } from './perfil'
import type { Prenda } from './inventario'
import type { ReceiptStatus } from './recibos'

export interface AdminBrother {
  id: number
  nombre: string
  apellidos: string
  dni: string | null
  fechaNacimiento: string
  email: string | null
  telefono: string | null
  direccion: string | null
  poblacion: string | null
  codigoPostal: string | null
  activo: boolean
  numeroHermano: number | null
  fechaAlta: string
  fechaBaja: string | null
  esTitular: boolean
  tieneTunicaPropia: boolean
  tunica: string | null
  alturaHombro: number | null
  puesto: string | null
  // El resto de la ficha, sin datos bancarios (el censo no los ve).
  primerApellido: string | null
  segundoApellido: string | null
  sexo: Sexo | null
  estadoCivil: EstadoCivil | null
  profesion: string | null
  lugarNacimiento: string | null
  telefonoFijo: string | null
  email2: string | null
  provincia: string | null
  comunidadAutonoma: string | null
  pais: string | null
  boletin: boolean
  fechaBautismo: string | null
  lugarBautismo: string | null
  parroquiaBautismo: string | null
  /** Documentos del alta en storage/private (el nombre): se abren con `urlDocumentoPrivado`. */
  foto: string | null
  certificadoBautismo: string | null
  fechaJura: string | null
  presentadoPor: string | null
  presentadoPor2: string | null
  user?: { email: string | null; telefono: string | null }
}

export interface PendingRequest {
  id: number
  email: string
  nombre: string
  apellidos: string
  createdAt: string
  /** Cuenta ya aprobada (un familiar añadido después) o solicitud nueva (false). */
  active?: boolean
  hermanos: AdminBrother[]
}

/**
 * Quien se dio de baja y ha pedido volver desde la web. No es una solicitud de
 * alta: su ficha ya estuvo en el censo, así que se resuelve reactivándola (le
 * da número nuevo) o descartando la petición, nunca con «aprobar».
 */
export interface PeticionVuelta {
  id: number
  nombre: string
  apellidos: string
  dni: string | null
  email: string | null
  fechaBaja: string | null
  reactivacionSolicitada: string
}

/** Búsqueda, filtros y orden del censo. Vacío = sin filtrar. */
export type FiltrosCenso = {
  q?: string
  estado?: '' | 'activo' | 'baja' | 'pendiente'
  numero?: '' | 'con' | 'sin'
  orden?: string
}

export function buscarHermanos(filtros: FiltrosCenso, pagina: { pagina: number; porPagina: number }) {
  return llamarApi<RespuestaPaginada<AdminBrother>>(`/hermanos/admin/search?${paramsPagina(pagina, filtros)}`)
}

export function solicitudesPendientes(pagina: { pagina: number; porPagina: number }) {
  // Las peticiones de vuelta llegan con las altas: se atienden en la misma
  // pantalla, aunque con otro botón.
  return llamarApi<RespuestaPaginada<PendingRequest> & { reactivaciones: PeticionVuelta[] }>(
    `/hermanos/admin/solicitudes?${paramsPagina(pagina)}`,
  )
}

/** Descartar una petición de vuelta: la ficha se queda de baja, como estaba. */
export function descartarPeticionVuelta(hermanoId: number) {
  return llamarApi<{ message: string }>(`/hermanos/admin/reactivaciones/${hermanoId}`, { method: 'DELETE' })
}

export function aprobarSolicitud(id: number) {
  return llamarApi<{ message: string }>(`/hermanos/admin/solicitudes/${id}/aprobar`, { method: 'POST' })
}

export function rechazarSolicitud(id: number) {
  return llamarApi<{ message: string }>(`/hermanos/admin/solicitudes/${id}/rechazar`, { method: 'DELETE' })
}

export interface DatosDeFichaDeHermano {
  nombre?: string
  primerApellido?: string
  segundoApellido?: string | null
  sexo?: Sexo | null
  estadoCivil?: EstadoCivil | null
  profesion?: string | null
  lugarNacimiento?: string | null
  telefonoFijo?: string | null
  email2?: string | null
  provincia?: string | null
  comunidadAutonoma?: string | null
  pais?: string | null
  boletin?: boolean
  fechaBautismo?: string | null
  lugarBautismo?: string | null
  parroquiaBautismo?: string | null
  /** La jura y los padrinos los lleva Secretaría: el hermano no los toca. */
  fechaJura?: string | null
  presentadoPor?: string | null
  presentadoPor2?: string | null
  parentesco?: Parentesco
  dni?: string
  fechaNacimiento?: string
  telefono?: string
  email?: string
  direccion?: string
  poblacion?: string
  codigoPostal?: string
  numeroHermano?: number
  esTitular?: boolean
  tieneTunicaPropia?: boolean
  tunica?: string
  alturaHombro?: number
  puesto?: string
  fechaAlta?: string
  /**
   * Solo para CORREGIR la fecha de una ficha que ya está de baja. La ficha no
   * da altas ni bajas (ni `activo`, ni quitar la baja con null): eso va por
   * darDeBajaHermano, reactivarHermano y la aprobación de solicitudes, que
   * asignan o liberan el número, tocan la cuenta y quedan en la auditoría.
   */
  fechaBaja?: string
}

/** Otra ficha de la misma cuenta: el titular o alguien a su cargo. */
export interface FichaDeLaCuenta {
  id: number
  nombre: string
  apellidos: string
  fechaNacimiento: string
  numeroHermano: number | null
  esTitular: boolean
  parentesco: Parentesco | null
  activo: boolean
  fechaBaja: string | null
}

/** La ficha tal como la lee Secretaría: con la cuenta, lo pagado, las papeletas y lo que tiene del ropero. */
export interface FichaDelCenso extends AdminBrother {
  parentesco: Parentesco | null
  user?: { email: string | null; telefono: string | null; hermanos?: FichaDeLaCuenta[] }
  recibos?: { id: number; year: number; concepto: string; estado: ReceiptStatus; fechaPago: string | null }[]
  papeletas?: { id: number; year: number; puesto: string; tramo: string | null }[]
  prendas?: { id: number; numero: string; tipo: Prenda['tipo']; talla: string | null }[]
}

export function fichaDeHermano(id: number) {
  return llamarApi<FichaDelCenso>(`/hermanos/admin/${id}`)
}

export function actualizarHermano(id: number, payload: DatosDeFichaDeHermano) {
  return llamarApi<AdminBrother>(`/hermanos/admin/${id}`, { method: 'PUT', json: payload })
}

/** Da de baja a un hermano con la fecha indicada (AAAA-MM-DD); sin ella, hoy. */
export function darDeBajaHermano(id: number, fechaBaja?: string) {
  return llamarApi<{ message: string }>(`/hermanos/admin/${id}/baja`, {
    method: 'DELETE',
    ...(fechaBaja ? { json: { fechaBaja } } : {}),
  })
}

/** Vuelve a dar de alta a un hermano de baja: número nuevo y cuenta con acceso. */
export function reactivarHermano(id: number) {
  return llamarApi<{ message: string }>(`/hermanos/admin/${id}/reactivar`, { method: 'POST' })
}

/**
 * Secretaría emancipa a un dependiente. No lleva contraseña: al hermano le
 * llega un enlace para ponérsela él.
 */
export function emanciparHermano(id: number, payload: { newEmail: string; newDni?: string }) {
  return llamarApi<{ id: number; email: string; nombre: string }>(`/hermanos/admin/${id}/emancipar`, { method: 'POST', json: payload })
}

export interface CierreDeHuecos {
  message: string
  asignados: { id: number; numeroHermano: number }[]
}

/** Da número a los hermanos activos que no lo tienen, por antigüedad. No renumera a nadie. */
export function cerrarHuecosDeNumero() {
  return llamarApi<CierreDeHuecos>('/hermanos/admin/cerrar-huecos-numero', { method: 'POST' })
}
