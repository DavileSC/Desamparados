import { apiFetch } from './client'
import type { AuthUser } from '../../features/members/auth/store'
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
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    json: { email, password, recordarme, contexto },
  })
}

export function register(data: {
  email: string
  password: string
  dni: string
  nombre: string
  apellidos: string
  telefono: string
  direccion: string
  poblacion: string
  codigoPostal: string
  fechaNacimiento: string
}) {
  return apiFetch<{ user: { id: number; email: string }; message: string }>('/auth/register', {
    method: 'POST',
    auth: false,
    json: {
      isTutor: false,
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
      hermano: { fechaNacimiento: data.fechaNacimiento },
    },
  })
}

export function verify2FA(token2fa: string) {
  return apiFetch<LoginResponse>('/auth/login/2fa', {
    method: 'POST',
    auth: false,
    json: { token2fa },
  })
}

export function requestPasswordReset(email: string) {
  return apiFetch<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    auth: false,
    json: { email },
  })
}

// El token viaja en el cuerpo: en la URL quedaría en los registros de acceso, y
// abre la cuenta durante una hora.
export function resetPassword(token: string, newPassword: string) {
  return apiFetch<{ message: string }>('/auth/reset-password/confirmar', {
    method: 'POST',
    auth: false,
    json: { token, newPassword },
  })
}

/**
 * Sesión actual. `auth: false` a propósito: para un invitado el 401 es la
 * respuesta normal y no debe tratarse como sesión caducada.
 */
export function sesionActual() {
  return apiFetch<{ user: AuthUser }>('/auth/me', { auth: false })
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
  return apiFetch<{ qrCodeUrl: string; secret: string }>('/auth/2fa/generate', { method: 'POST' })
}

/** Paso 2: verifica el primer TOTP y devuelve los respaldos en claro, UNA vez. */
export function activar2FA(token2fa: string) {
  return apiFetch<{ message: string; backupCodes: string[] }>('/auth/2fa/enable', {
    method: 'POST',
    json: { token2fa },
  })
}

/** Desactiva el 2FA; pide un TOTP vigente o un código de respaldo. */
export function desactivar2FA(token2fa: string) {
  return apiFetch<{ message: string }>('/auth/2fa/disable', {
    method: 'POST',
    json: { token2fa },
  })
}

export function cerrarSesionApi() {
  return apiFetch<null>('/auth/logout', { method: 'POST', auth: false })
}
