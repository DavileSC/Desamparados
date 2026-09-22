import { llamarApi } from './cliente'
import type { AuthUser } from '../../features/altas/auth/store'
import { normalizarDni, normalizarTelefono } from '../validacion/identidad'

/**
 * Respuesta de POST /auth/login y POST /auth/login/2fa.
 * Ni el token ni el userId viajan ya en el cuerpo: el token va en una cookie
 * httpOnly y el usuario del segundo paso sale del testigo del primer factor.
 */
export type LoginResponse =
  | { status: 'OK'; user: AuthUser }
  | { status: '2FA_NEEDED'; message: string }

export function login(
  email: string,
  password: string,
  recordarme = false,
  contexto: 'cms' | 'hermanos' = 'cms'
) {
  return llamarApi<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    json: { email, password, recordarme, contexto },
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
export interface MenorAlta {
  nombre: string
  apellidos: string
  fechaNacimiento: string
  parentesco: Parentesco
  dni?: string
  email?: string
}

export interface RegistroData {
  email: string
  password: string
  dni: string
  nombre: string
  apellidos: string
  telefono: string
  direccion: string
  poblacion: string
  codigoPostal: string
  /** La suya, si se hace hermano. Sin ella, la cuenta es solo para gestionar. */
  fechaNacimiento?: string
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
export function register(data: RegistroData) {
  return llamarApi<{ user: { id: number; email: string }; fichas: number; message: string }>('/auth/register', {
    method: 'POST',
    auth: false,
    json: {
      usuario: {
        email: data.email,
        password: data.password,
        // Normalizados aquí y no en el formulario: el servidor guarda nueve
        // dígitos pelados y el DNI en mayúsculas sin separadores, y quien
        // escribe «+34 600 12 34 56» está dando un teléfono correcto.
        dni: normalizarDni(data.dni),
        nombre: data.nombre,
        apellidos: data.apellidos,
        telefono: normalizarTelefono(data.telefono),
        direccion: data.direccion,
        poblacion: data.poblacion,
        codigoPostal: data.codigoPostal,
      },
      ...(data.fechaNacimiento ? { titular: { fechaNacimiento: data.fechaNacimiento } } : {}),
      ...(data.menores?.length
        ? {
            menores: data.menores.map((menor) => ({
              nombre: menor.nombre,
              apellidos: menor.apellidos,
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
    },
  })
}

/**
 * Pedir volver tras una baja. Se ofrece cuando el alta topa con un DNI que ya
 * está en el censo. La respuesta es siempre la misma, exista o no la ficha: el
 * servidor no dice quién está en el censo y la pantalla tampoco puede saberlo.
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

export function requestPasswordReset(email: string) {
  return llamarApi<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    auth: false,
    json: { email },
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
