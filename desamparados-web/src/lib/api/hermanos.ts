import { llamarApi, traerArchivo } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'
import type { Parentesco } from './auth'
import type { EstadoCivil, Sexo } from './perfil'
import type { Prenda } from './inventario'
import type { ReceiptStatus } from './recibos'

/** Por qué salió del censo. Null en las bajas de antes de guardarlo. */
export type MotivoBaja = 'VOLUNTARIA' | 'IMPAGO' | 'FALLECIMIENTO' | 'OTRO'

export const MOTIVOS_BAJA: Record<MotivoBaja, string> = {
  VOLUNTARIA: 'Voluntaria',
  IMPAGO: 'Impago de cuotas',
  FALLECIMIENTO: 'Fallecimiento',
  OTRO: 'Otro motivo',
}

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
  motivoBaja: MotivoBaja | null
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
  /** Autoriza publicar las fotos en que aparece. */
  autorizaImagen: boolean
  fechaBautismo: string | null
  lugarBautismo: string | null
  parroquiaBautismo: string | null
  /** Documentos del alta en storage/private (el nombre): se abren con `urlDocumentoPrivado`. */
  foto: string | null
  certificadoBautismo: string | null
  fechaJura: string | null
  presentadoPor: string | null
  presentadoPor2: string | null
  /** Cuándo se le impuso la medalla. */
  fechaMedalla: string | null
  /** Cómo se le nombra en las cartas y la papeleta («Rvdo. P.»…); sin él, según el sexo. */
  tratamiento: string | null
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
  correo?: '' | 'con' | 'sin'
  cuenta?: '' | 'con' | 'sin'
  edad?: '' | 'menores' | 'adultos'
  medalla?: '' | 'con' | 'sin'
  boletin?: '' | 'si'
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
  autorizaImagen?: boolean
  fechaBautismo?: string | null
  lugarBautismo?: string | null
  parroquiaBautismo?: string | null
  /** La jura y los padrinos los lleva Secretaría: el hermano no los toca. */
  fechaJura?: string | null
  presentadoPor?: string | null
  presentadoPor2?: string | null
  fechaMedalla?: string | null
  tratamiento?: string | null
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

/**
 * Da de baja a un hermano con la fecha indicada (AAAA-MM-DD); sin ella, hoy.
 * Por fallecimiento, `fechaDefuncion` es el día en que falleció (sin él, el de la baja).
 */
export function darDeBajaHermano(id: number, fechaBaja: string | undefined, motivo: MotivoBaja, fechaDefuncion?: string) {
  return llamarApi<{ message: string }>(`/hermanos/admin/${id}/baja`, {
    method: 'DELETE',
    json: { ...(fechaBaja ? { fechaBaja } : {}), motivo, ...(motivo === 'FALLECIMIENTO' && fechaDefuncion ? { fechaDefuncion } : {}) },
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

interface CierreDeHuecos {
  message: string
  asignados: { id: number; numeroHermano: number }[]
}

/** Da número a los hermanos activos que no lo tienen, por antigüedad. No renumera a nadie. */
export function cerrarHuecosDeNumero() {
  return llamarApi<CierreDeHuecos>('/hermanos/admin/cerrar-huecos-numero', { method: 'POST' })
}

// --- El censo en Excel o CSV ---

/** El censo para descargar: solo los activos o también las bajas. Sin datos bancarios. */
export const exportarCenso = (formato: 'xlsx' | 'csv', bajas: boolean) =>
  traerArchivo(`/hermanos/admin/censo/exportar?${new URLSearchParams({ formato, bajas: bajas ? 'si' : 'no' }).toString()}`)

/** Lo que entraría de un fichero del censo, y por qué no entran las filas que no. */
export interface PreviaImportacionCenso {
  filas: number
  importables: number
  /** Con DNI y un correo libre: reciben su propia cuenta. */
  conCuenta: number
  /** Comparten el correo de quien recibe cuenta: cuelgan de ella. */
  aCargo: number
  deBaja: number
  /** Activos sin número: lo reciben a continuación del último. */
  sinNumero: number
  domiciliadas: number
  /** Cada título de la primera fila y qué dato es; `null` si no se reconoce. */
  columnas: { titulo: string; clave: string | null }[]
  errores: { fila: number; errores: string[] }[]
}

const conFichero = (fichero: File) => {
  const formulario = new FormData()
  formulario.append('fichero', fichero)
  return formulario
}

export const previaImportacionCenso = (fichero: File) =>
  llamarApi<PreviaImportacionCenso>('/hermanos/admin/censo/importar/previa', { method: 'POST', formData: conFichero(fichero) })

export const importarCenso = (fichero: File) =>
  llamarApi<{ message: string; importadas: number }>('/hermanos/admin/censo/importar', { method: 'POST', formData: conFichero(fichero) })

/** Una búsqueda del censo guardada con nombre: sus filtros, como van en la URL. */
interface ListaGuardada { id: number; nombre: string; consulta: string }

export const listasDelCenso = () => llamarApi<ListaGuardada[]>('/hermanos/admin/listas')

/** Con un nombre que ya existe, la sustituye. */
export const guardarListaDelCenso = (nombre: string, consulta: string) =>
  llamarApi<ListaGuardada>('/hermanos/admin/listas', { method: 'POST', json: { nombre, consulta } })

export const borrarListaDelCenso = (id: number) => llamarApi<{ message: string }>(`/hermanos/admin/listas/${id}`, { method: 'DELETE' })
