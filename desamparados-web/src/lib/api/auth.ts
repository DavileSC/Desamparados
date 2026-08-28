import { apiFetch } from './client'
import type { AuthUser } from '../../features/members/auth/store'

/** Respuesta de POST /auth/login y POST /auth/login/2fa */
export type LoginResponse =
  | { status: 'OK'; token: string; user: AuthUser }
  | { status: '2FA_NEEDED'; userId: number; message: string }

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    json: { email, password },
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
        dni: data.dni,
        nombre: data.nombre,
        apellidos: data.apellidos,
        telefono: data.telefono,
        direccion: data.direccion,
        poblacion: data.poblacion,
        codigoPostal: data.codigoPostal,
      },
      hermano: { fechaNacimiento: data.fechaNacimiento },
    },
  })
}

export function verify2FA(userId: number, token2fa: string) {
  return apiFetch<LoginResponse>('/auth/login/2fa', {
    method: 'POST',
    auth: false,
    json: { userId, token2fa },
  })
}

export function requestPasswordReset(email: string) {
  return apiFetch<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    auth: false,
    json: { email },
  })
}

export function resetPassword(token: string, newPassword: string) {
  return apiFetch<{ message: string }>(`/auth/reset-password/${encodeURIComponent(token)}`, {
    method: 'POST',
    auth: false,
    json: { newPassword },
  })
}

/**
 * Sesión actual. `auth: false` a propósito: para un invitado el 401 es la
 * respuesta normal y no debe tratarse como sesión caducada.
 */
export function sesionActual() {
  return apiFetch<{ user: AuthUser }>('/auth/me', { auth: false })
}

export function cerrarSesionApi() {
  return apiFetch<null>('/auth/logout', { method: 'POST', auth: false })
}
