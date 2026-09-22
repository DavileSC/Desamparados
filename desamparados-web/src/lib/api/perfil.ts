import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'
import { normalizarDni } from '../validacion/identidad'
import type { Parentesco } from './auth'

export type Sexo = 'HOMBRE' | 'MUJER'
export type EstadoCivil = 'SOLTERO' | 'CASADO' | 'PAREJA_DE_HECHO' | 'SEPARADO' | 'DIVORCIADO' | 'VIUDO'
export type FormaDePago = 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'

export interface ApiProfile {
  id: number
  nombre: string
  /** Los dos juntos, como se enseñan: los compone el servidor desde los sueltos. */
  apellidos: string
  primerApellido: string | null
  segundoApellido: string | null
  /** Puede no tenerlo: un menor pequeño se apunta sin DNI. */
  dni: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  poblacion: string | null
  codigoPostal: string | null
  fechaAlta: string
  fechaNacimiento: string
  numeroHermano: number | null
  activo: boolean
  /** `true` en la ficha de la persona que tiene la cuenta; `false` en la de sus tutelados. */
  esTitular: boolean
  /** Qué es para el titular. Null en la suya propia y en las de antes del campo. */
  parentesco: Parentesco | null
  sexo: Sexo | null
  estadoCivil: EstadoCivil | null
  profesion: string | null
  lugarNacimiento: string | null
  telefonoFijo: string | null
  email2: string | null
  provincia: string | null
  pais: string | null
  fechaBautismo: string | null
  parroquiaBautismo: string | null
  /** Los lleva Secretaría: se ven, no se editan desde aquí. */
  fechaJura: string | null
  presentadoPor: string | null
  presentadoPor2: string | null
  tieneTunicaPropia: boolean
  tunica: string | null
  alturaHombro: number | null
  puesto: string | null
  formaPagoPref: FormaDePago
  /** La cuenta nunca llega entera: «ES•• •••• … 1332». */
  ibanEnmascarado: string | null
  titularCuenta: string | null
}

/**
 * La ficha que enseñan «Mi perfil» y su edición: la del titular de la cuenta.
 * El servidor ordena la familia por fecha de nacimiento descendente, así que la
 * primera es la del hijo más pequeño: tomar `data[0]` le enseñaba al tutor la
 * ficha de su hijo como si fuera la suya.
 *
 * Devuelve null cuando no hay ficha propia, que es el caso de quien solo apuntó
 * a menores a su cargo: entonces «Mi perfil» enseña los datos de la cuenta, y
 * las fichas de los menores viven en «Mi familia», que es donde se esperan.
 */
export function fichaPropia(fichas: ApiProfile[]): ApiProfile | null {
  return fichas.find((ficha) => ficha.esTitular) ?? null
}

/** Las de quienes están a su cargo, que es todo lo que no es su propia ficha. */
export function fichasACargo(fichas: ApiProfile[]): ApiProfile[] {
  return fichas.filter((ficha) => !ficha.esTitular)
}

/**
 * Las dos pantallas de perfil no listan fichas: eligen una —la del titular— para
 * mostrarla o editarla. Un selector paginado es mala interfaz, y con una página
 * corta el hermano con varias fichas dejaría de poder llegar a alguna, así que
 * piden la familia entera de una vez. Cincuenta es más de lo que ninguna
 * familia tendrá y queda por debajo del tope del servidor, que son cien.
 */
export const FICHAS_POR_FAMILIA = 50

export function misFichas(
  pagina: { pagina: number; porPagina: number } = { pagina: 1, porPagina: FICHAS_POR_FAMILIA },
) {
  return llamarApi<RespuestaPaginada<ApiProfile>>(`/hermanos/mis-perfiles?${paramsPagina(pagina)}`)
}

/**
 * Lo que se cambia de una ficha desde «Mi perfil», apartado a apartado: solo
 * van los campos del apartado que se guarda. `null` vacía un dato opcional.
 * Los apellidos van por separado: el servidor compone los dos juntos.
 */
export type CambiosDeFicha = Partial<{
  nombre: string
  primerApellido: string
  segundoApellido: string | null
  fechaNacimiento: string
  dni: string
  sexo: Sexo | null
  estadoCivil: EstadoCivil | null
  profesion: string | null
  lugarNacimiento: string | null
  parentesco: Parentesco
  email: string
  email2: string | null
  telefono: string
  telefonoFijo: string | null
  direccion: string
  codigoPostal: string
  poblacion: string
  provincia: string | null
  pais: string | null
  fechaBautismo: string | null
  parroquiaBautismo: string | null
  formaPagoPref: FormaDePago
  iban: string | null
  titularCuenta: string | null
}>

export function actualizarFicha(id: number, cambios: CambiosDeFicha) {
  const { dni, ...resto } = cambios
  return llamarApi<{ message: string; data: ApiProfile }>(`/hermanos/mis-perfiles/${id}`, {
    method: 'PUT',
    json: { ...resto, ...(dni ? { dni: normalizarDni(dni) } : {}) },
  })
}

export interface DatosDeFichaNueva {
  nombre: string
  primerApellido: string
  segundoApellido: string
  fechaNacimiento: string
  /** Sin parentesco cuando es su propia ficha: se reconoce por el DNI. */
  parentesco?: Parentesco
  dni?: string
  email?: string
}

/**
 * Apuntar a alguien desde «Mi familia».
 *
 * Sirve para dos cosas: un menor a su cargo, y él mismo si aún no tiene ficha
 * (quien solo apuntó a sus hijos y luego se anima). Para lo segundo basta con
 * mandar su propio DNI: el servidor la crea como ficha de titular.
 *
 * Nace pendiente de Secretaría, como cualquier alta.
 */
export function anadirFicha(payload: DatosDeFichaNueva) {
  return llamarApi<ApiProfile>('/hermanos/mis-perfiles', {
    method: 'POST',
    json: {
      nombre: payload.nombre,
      primerApellido: payload.primerApellido,
      ...(payload.segundoApellido.trim() ? { segundoApellido: payload.segundoApellido } : {}),
      fechaNacimiento: payload.fechaNacimiento,
      ...(payload.parentesco ? { parentesco: payload.parentesco } : {}),
      ...(payload.dni ? { dni: normalizarDni(payload.dni) } : {}),
      ...(payload.email ? { email: payload.email } : {}),
    },
  })
}

/**
 * Darle cuenta propia a quien ya tiene 18: la ficha se separa de esta cuenta y
 * pasa a ser suya, con su correo y su contraseña. A partir de ahí, quien la
 * gestionaba deja de verla.
 */
export function emanciparFicha(id: number, payload: { newEmail: string; newPassword: string; newDni?: string }) {
  return llamarApi<{ message: string }>(`/hermanos/mis-perfiles/${id}/emancipar`, {
    method: 'POST',
    json: {
      newEmail: payload.newEmail,
      newPassword: payload.newPassword,
      ...(payload.newDni ? { newDni: normalizarDni(payload.newDni) } : {}),
    },
  })
}
