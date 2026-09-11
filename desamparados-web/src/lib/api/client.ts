import { useAuthStore } from '../../features/members/auth/store'

/**
 * Cliente HTTP mínimo para la API del backend.
 *
 * - Base URL: `/api` (mismo origen; en desarrollo Vite lo proxyea al backend,
 *   ver vite.config.ts). La API tiene que estar en el mismo dominio: la cookie
 *   de sesión es SameSite=Strict y el navegador no la mandaría a otro origen.
 * - La sesión viaja en una cookie httpOnly que el navegador adjunta solo: aquí
 *   no se lee ni se guarda ningún token.
 * - Un 401 en una petición que esperaba sesión significa que ha caducado o se
 *   ha revocado: se limpia el estado local.
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
  /** Formulario con archivos: el navegador pone el Content-Type de multipart con su separador. */
  formData?: FormData
  /** false = un 401 aquí es normal y no debe cerrar la sesión (login, registro, /me del arranque) */
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

/**
 * El mensaje que verá quien use la pantalla. Un 400 de validación trae el
 * mensaje genérico «Error de validación» y el detalle en `errors`: las pantallas
 * que pintan cada campo usan `ApiError.fields`, pero las que solo enseñan un
 * aviso se quedaban sin saber qué corregir. Se añaden hasta tres campos.
 */
function mensajeDeError(payload: unknown): string | null {
  const mensaje = extractMessage(payload)
  const campos = Object.entries(extractFieldErrors(payload))
  if (campos.length === 0) return mensaje
  const detalle = campos.slice(0, 3).map(([campo, texto]) => (texto ? `${campo}: ${texto}` : campo)).join('; ')
  const resto = campos.length > 3 ? ` (y ${campos.length - 3} más)` : ''
  return `${mensaje ?? 'Revisa los datos'}. ${detalle}${resto}.`
}

/**
 * El 403 del backend cuando la cookie ya no es una sesión del CMS. Pasa si en
 * otra pestaña se entra por el área de hermanos: la cookie es la misma y se
 * sustituye, y el CMS abierto empezaba a dar «no tienes permisos» en cada
 * pantalla sin explicación. Los 403 de permisos no llevan este código.
 */
export const SESION_NO_CMS = 'SESION_NO_CMS'

let reconsultandoSesion: Promise<void> | null = null

/**
 * Sesión perdida para el CMS: se vacía el estado (los guardas esperan en
 * `cargando`) y se pregunta al servidor quién es ahora la cookie. Con la
 * sesión de hermanos que la ha sustituido, el guarda del CMS lleva al acceso,
 * que ya explica que hay que identificarse allí; sin sesión, al acceso a secas.
 * Una sola consulta aunque fallen a la vez todas las peticiones de la pantalla.
 */
function sesionPerdidaParaCms(): void {
  if (reconsultandoSesion) return
  useAuthStore.setState({ status: 'cargando', user: null })
  // Import dinámico: auth.ts usa este cliente y uno estático sería circular.
  reconsultandoSesion = import('./auth')
    .then(({ sesionActual }) => sesionActual())
    .then(({ user }) => useAuthStore.getState().entrarSesion(user))
    .catch(() => useAuthStore.getState().salirSesion())
    .finally(() => { reconsultandoSesion = null })
}

function codigoDeError(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const { error } = payload as { error?: unknown }
  return typeof error === 'string' ? error : undefined
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { json, formData, auth = true, headers, ...rest } = options

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      // El navegador adjunta la cookie de sesión; sin esto no viajaría.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : formData,
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
    // `auth: false` marca las peticiones para las que un 401 es normal (login,
    // y sobre todo el /me del arranque cuando el visitante es un invitado).
    if (res.status === 401 && auth) {
      // Sesión caducada o revocada: limpiamos el estado local
      useAuthStore.getState().salirSesion()
    }
    if (res.status === 403 && codigoDeError(payload) === SESION_NO_CMS) sesionPerdidaParaCms()
    throw new ApiError(mensajeDeError(payload) ?? `Error ${res.status}`, res.status, payload)
  }

  return payload as T
}
