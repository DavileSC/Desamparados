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
