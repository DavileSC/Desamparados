import { useAuthStore } from '../../features/members/auth/store'

/**
 * Cliente HTTP mínimo para la API del backend.
 *
 * - Base URL: `VITE_API_URL` (p. ej. https://api.desamparados.es/api). Si no está definida
 *   se usa `/api` (mismo origen: en desarrollo Vite lo proxyea al backend, ver vite.config.ts).
 * - Añade `Authorization: Bearer <token>` cuando hay sesión.
 * - Un 401 con sesión activa significa token caducado/revocado: se cierra la sesión local.
 */
const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')

export class ApiError extends Error {
  status: number
  payload: unknown
  fields: Record<string, string>

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
    this.fields = extractFieldErrors(payload)
  }
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** Cuerpo JSON (se serializa automáticamente) */
  json?: unknown
  /** false = no adjuntar el token aunque exista (login, registro...) */
  auth?: boolean
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  if (typeof p.message === 'string' && p.message) return p.message
  if (typeof p.error === 'string' && p.error) return p.error
  return null
}

// El validador del backend devuelve { errors: [{ field, message }] }
function extractFieldErrors(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== 'object') return {}
  const errors = (payload as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return {}
  const out: Record<string, string> = {}
  for (const e of errors) {
    if (e && typeof e === 'object' && typeof (e as { field?: unknown }).field === 'string') {
      out[(e as { field: string }).field] = String((e as { message?: unknown }).message ?? '')
    }
  }
  return out
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { json, auth = true, headers, ...rest } = options
  const token = useAuthStore.getState().token

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    })
  } catch {
    throw new ApiError('No se ha podido conectar con el servidor. Inténtalo de nuevo en unos minutos.', 0)
  }

  const text = await res.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }

  if (!res.ok) {
    if (res.status === 401 && auth && token) {
      // Sesión caducada o revocada: limpiamos el estado local
      useAuthStore.getState().logout()
    }
    throw new ApiError(extractMessage(payload) ?? `Error ${res.status}`, res.status, payload)
  }

  return payload as T
}
