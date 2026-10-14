import { llamarApi, traerArchivo } from './cliente'
import type { AuthUser } from '../../features/altas/auth/store'
import { normalizarDni, normalizarIban, normalizarTelefono } from '../validacion/identidad'
import type { DobleFactorPendiente } from './aprobacion'

/**
 * Respuesta de POST /auth/login y POST /auth/login/2fa.
 * Ni el token ni el userId viajan ya en el cuerpo: el token va en una cookie
 * httpOnly y el usuario del segundo paso sale del testigo del primer factor.
 */
export type LoginResponse =
  | { status: 'OK'; user: AuthUser }
  | DobleFactorPendiente

/**
 * `dispositivo`: si este navegador es un móvil apuntado para aprobar la
 * entrada, su número; así no se le manda el aviso a sí mismo.
 */
export function login(
  email: string,
  password: string,
  recordarme = false,
  contexto: 'cms' | 'hermanos' = 'cms',
  dispositivo?: number
) {
  return llamarApi<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    json: { email, password, recordarme, contexto, ...(dispositivo !== undefined ? { dispositivo } : {}) },
  })
}

/** Qué es el menor para quien lo apunta: no todos son hijos suyos. */
export const PARENTESCOS = [
  { value: 'HIJO', label: 'Hijo o hija' },
  { value: 'SOBRINO', label: 'Sobrino o sobrina' },
  { value: 'NIETO', label: 'Nieto o nieta' },
  { value: 'AHIJADO', label: 'Ahijado o ahijada' },
  { value: 'OTRO', label: 'Otro' },
] as const

export type Parentesco = (typeof PARENTESCOS)[number]['value']

/** Un menor a cargo de quien abre la cuenta. DNI y correo, solo si ya los tiene. */
interface MenorAlta {
  nombre: string
  primerApellido: string
  segundoApellido: string
  fechaNacimiento: string
  parentesco: Parentesco
  dni?: string
  email?: string
}

interface RegistroData {
  email: string
  password: string
  dni: string
  nombre: string
  primerApellido: string
  segundoApellido: string
  telefono: string
  direccion: string
  poblacion: string
  codigoPostal: string
  provincia?: string
  comunidadAutonoma?: string
  pais?: string
  /** Quiere el boletín de noticias por correo. */
  boletin?: boolean
  /** Autoriza publicar las fotos en que aparezca él y los menores que inscribe. */
  autorizaImagen?: boolean
  /** La suya, si se hace hermano. Sin ella, la cuenta es solo para gestionar. */
  fechaNacimiento?: string
  /** Lo que acompaña a la ficha propia: van solo si hay `fechaNacimiento`. */
  ficha?: {
    sexo: 'HOMBRE' | 'MUJER'
    estadoCivil: 'SOLTERO' | 'CASADO' | 'PAREJA_DE_HECHO' | 'SEPARADO' | 'DIVORCIADO' | 'VIUDO'
    fechaBautismo: string
    lugarBautismo?: string
    parroquiaBautismo?: string
  }
  /** La cuota anual: domiciliada (con su cuenta) o en Secretaría. */
  pago?: {
    forma: 'DOMICILIACION' | 'EFECTIVO'
    iban?: string
    titularidad?: 'PROPIA' | 'FAMILIAR_HERMANO' | 'OTRA_PERSONA'
    titularCuenta?: string
  }
  foto?: File | null
  certificadoBautismo?: File | null
  menores?: MenorAlta[]
  /** Campo trampa: escondido en el formulario, solo lo rellena un robot. */
  comentarioAdicional?: string
}

/**
 * El alta, en sus tres caminos: `fechaNacimiento` sin menores es un adulto que
 * se hace hermano; las dos cosas, uno que además apunta a quien tiene a su
 * cargo; solo menores, uno que no entra en el censo y abre la cuenta para
 * gestionarlos.
 */
/** Los dos apellidos, y los dos juntos: el servidor compone los suyos desde los sueltos. */
function apellidos(primero: string, segundo: string) {
  const p = primero.trim()
  const s = segundo.trim()
  return { apellidos: [p, s].filter(Boolean).join(' '), primerApellido: p, ...(s ? { segundoApellido: s } : {}) }
}

/** Un texto opcional: vacío no se manda (el servidor lo quiere ausente, no en blanco). */
const siHay = <K extends string>(clave: K, valor: string | undefined) =>
  (valor?.trim() ? { [clave]: valor.trim() } : {}) as Partial<Record<K, string>>

export function register(data: RegistroData) {
  const alta = {
    usuario: {
      email: data.email,
      password: data.password,
      // Normalizados aquí y no en el formulario: el servidor guarda nueve
      // dígitos pelados y el DNI en mayúsculas sin separadores, y quien
      // escribe «+34 600 12 34 56» está dando un teléfono correcto.
      dni: normalizarDni(data.dni),
      nombre: data.nombre,
      // Por separado, y juntos para los servidores de antes de separarlos.
      ...apellidos(data.primerApellido, data.segundoApellido),
      telefono: normalizarTelefono(data.telefono),
      direccion: data.direccion,
      poblacion: data.poblacion,
      codigoPostal: data.codigoPostal,
      ...siHay('provincia', data.provincia),
      ...siHay('comunidadAutonoma', data.comunidadAutonoma),
      ...siHay('pais', data.pais),
      boletin: data.boletin ?? false,
      autorizaImagen: data.autorizaImagen ?? false,
    },
    ...(data.fechaNacimiento && data.ficha
      ? {
          titular: {
            fechaNacimiento: data.fechaNacimiento,
            sexo: data.ficha.sexo,
            estadoCivil: data.ficha.estadoCivil,
            fechaBautismo: data.ficha.fechaBautismo,
            ...siHay('lugarBautismo', data.ficha.lugarBautismo),
            ...siHay('parroquiaBautismo', data.ficha.parroquiaBautismo),
          },
        }
      : {}),
    ...(data.pago
      ? {
          pago: data.pago.forma === 'DOMICILIACION'
            ? {
                forma: data.pago.forma,
                ...(data.pago.iban ? { iban: normalizarIban(data.pago.iban) } : {}),
                titularidad: data.pago.titularidad,
                // Si la cuenta es suya, el nombre sobra: el servidor pone el que toca.
                ...(data.pago.titularidad !== 'PROPIA' ? siHay('titularCuenta', data.pago.titularCuenta) : {}),
              }
            : { forma: data.pago.forma },
        }
      : {}),
    ...(data.menores?.length
      ? {
          menores: data.menores.map((menor) => ({
            nombre: menor.nombre,
            ...apellidos(menor.primerApellido, menor.segundoApellido),
            fechaNacimiento: menor.fechaNacimiento,
            parentesco: menor.parentesco,
            // Vacíos se omiten: el servidor los quiere ausentes, no en blanco.
            ...(menor.dni ? { dni: normalizarDni(menor.dni) } : {}),
            ...(menor.email ? { email: menor.email } : {}),
          })),
        }
      : {}),
    // Siempre presente, aunque vaya vacío: si solo se mandara cuando lleva
    // algo, su ausencia distinguiría a la persona del robot y la trampa
    // dejaría de estar escondida.
    comentarioAdicional: data.comentarioAdicional ?? '',
  }

  // Lo mismo se haya creado el alta o no: si el correo o un DNI ya estaban
  // registrados, el servidor responde igual y lo explica por correo, para que
  // el formulario no sirva para averiguar quién está en el censo.
  type Respuesta = { fichas: number; message: string }
  // Sin documentos, JSON como siempre. Con ellos, multipart: el alta va entera
  // en `datos` y cada fichero en su campo, para que el servidor diga cuál falla.
  if (!data.foto && !data.certificadoBautismo) {
    return llamarApi<Respuesta>('/auth/register', { method: 'POST', auth: false, json: alta })
  }
  const formulario = new FormData()
  formulario.append('datos', JSON.stringify(alta))
  if (data.foto) formulario.append('foto', data.foto)
  if (data.certificadoBautismo) formulario.append('certificadoBautismo', data.certificadoBautismo)
  return llamarApi<Respuesta>('/auth/register', { method: 'POST', auth: false, formData: formulario })
}

/**
 * Pedir volver tras una baja, desde el acceso fijo del alta. La respuesta es
 * siempre la misma, exista o no la ficha: el servidor no dice quién está en el
 * censo y la pantalla tampoco puede saberlo.
 */
export function pedirReactivacion(dni: string, email: string) {
  return llamarApi<{ message: string }>('/auth/reactivacion', {
    method: 'POST',
    auth: false,
    json: { dni: normalizarDni(dni), email },
  })
}

export function verify2FA(token2fa: string) {
  return llamarApi<LoginResponse>('/auth/login/2fa', {
    method: 'POST',
    auth: false,
    json: { token2fa },
  })
}

// `contexto`: desde qué acceso se pide; el enlace del correo vuelve a ese mismo.
export function requestPasswordReset(email: string, contexto: 'cms' | 'hermanos' = 'hermanos') {
  return llamarApi<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    auth: false,
    json: { email, contexto },
  })
}

// El token viaja en el cuerpo: en la URL quedaría en los registros de acceso, y
// abre la cuenta durante una hora.
export function resetPassword(token: string, newPassword: string) {
  return llamarApi<{ message: string }>('/auth/reset-password/confirmar', {
    method: 'POST',
    auth: false,
    json: { token, newPassword },
  })
}

/** A quién es una invitación al primer acceso, sin gastarla: para saludarle por su nombre. */
export function datosInvitacion(token: string) {
  return llamarApi<{ nombre: string; email: string }>('/auth/primer-acceso/datos', {
    method: 'POST',
    auth: false,
    json: { token },
  })
}

/** Pone la contraseña con la invitación y deja abierta la sesión del área de hermanos. */
export function estrenarCuenta(token: string, newPassword: string, recordarme: boolean) {
  return llamarApi<{ status: 'OK'; user: AuthUser }>('/auth/primer-acceso', {
    method: 'POST',
    auth: false,
    json: { token, newPassword, recordarme },
  })
}

/**
 * Cambiar la contraseña con la sesión abierta. El servidor cierra todas las
 * sesiones de la cuenta y da cookies nuevas a las de este navegador: después
 * hay que volver a pedir /auth/me. Una actual equivocada es un 400, no un 401:
 * la sesión sigue buena y `llamarApi` no la da por caducada.
 */
export function cambiarContrasena(actual: string, nueva: string) {
  return llamarApi<{ message: string }>('/auth/cambiar-contrasena', {
    method: 'POST',
    json: { actual, nueva },
  })
}

/**
 * Las sesiones abiertas, una por área. Responde 200 aunque no haya ninguna:
 * para un visitante eso es lo normal, no un error.
 */
export function sesionActual() {
  return llamarApi<{ cms: AuthUser | null; hermano: AuthUser | null }>('/auth/me', { auth: false })
}

// ===================================================================
//  2FA (pantalla "Mi seguridad" del CMS; el backend lo limita a staff)
// ===================================================================

/**
 * Paso 1: QR en data URL + secreto Base32 para entrada manual.
 * POST porque crea y guarda un secreto nuevo. Con el 2FA ya activo el backend
 * responde 409: hay que desactivarlo antes de configurarlo con otro móvil.
 */
export function generarQr2FA() {
  return llamarApi<{ qrCodeUrl: string; secret: string }>('/auth/2fa/generate', { method: 'POST' })
}

/** Paso 2: verifica el primer TOTP y devuelve los respaldos en claro, UNA vez. */
export function activar2FA(token2fa: string) {
  return llamarApi<{ message: string; backupCodes: string[] }>('/auth/2fa/enable', {
    method: 'POST',
    json: { token2fa },
  })
}

/** Desactiva el 2FA; pide un TOTP vigente o un código de respaldo. */
export function desactivar2FA(token2fa: string) {
  return llamarApi<{ message: string }>('/auth/2fa/disable', {
    method: 'POST',
    json: { token2fa },
  })
}

/** Cierra la sesión de un área. La del área contraria no se toca. */
export function cerrarSesionApi(area: 'cms' | 'hermanos') {
  return llamarApi<null>('/auth/logout', { method: 'POST', auth: false, json: { area } })
}

// ===================================================================
//  Derechos del RGPD sobre la propia cuenta (acceso y supresión)
// ===================================================================

/**
 * Todos los datos de la cuenta y de sus fichas, en JSON (art. 15). Responde
 * también con el primer acceso pendiente: nadie tiene que completar su ficha
 * para poder llevarse lo que ya hay.
 */
export function descargarMisDatos() {
  return traerArchivo('/auth/mis-datos')
}

/**
 * Suprime la cuenta (art. 17): la anonimiza, da de baja sus fichas y cierra
 * todas sus sesiones. Una contraseña equivocada es un 401 normal aquí, no una
 * sesión caducada: por eso `auth: false`.
 */
export function borrarMiCuenta(password: string) {
  return llamarApi<{ message: string }>('/auth/mi-cuenta', { method: 'DELETE', json: { password }, auth: false })
}
