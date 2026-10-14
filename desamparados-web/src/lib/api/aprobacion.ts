import { llamarApi, ErrorDeApi } from './cliente'
import type { AuthUser } from '../../features/altas/auth/store'

/**
 * Aprobar la entrada al CMS desde un móvil apuntado (módulo
 * `avisos-en-el-movil`). El ordenador enseña un número y espera; al móvil le
 * llega un aviso y quien lo abre elige ese número entre tres. El código de la
 * app sigue de reserva (`verify2FA`).
 *
 * Lo que prueba que quien aprueba es el móvil es su clave, que solo guarda él
 * (IndexedDB, para que la lea también el service worker): las llamadas del
 * móvil van sin sesión y llevan `dispositivo` y `clave` en el cuerpo.
 */

/** Un móvil apuntado, como sale en «Mi seguridad». */
export interface MovilApuntado {
  id: number
  nombre: string
  creadoEn: string
  usadoEn: string | null
}

/** Las credenciales del móvil: su número en la lista y su clave. */
export interface CredencialesDelMovil {
  dispositivo: number
  clave: string
}

/**
 * Los móviles de la cuenta. `disponible` es false si esta instalación no
 * tiene las claves del servidor; `clavePublica` es la que pide el navegador
 * para suscribirse (`applicationServerKey`).
 */
export function misMoviles() {
  return llamarApi<{ disponible: boolean; clavePublica: string | null; moviles: MovilApuntado[] }>('/auth/moviles')
}

/**
 * Apunta este móvil con su suscripción de push. Pide la contraseña. La clave
 * vuelve una sola vez: hay que guardarla en el acto. Una contraseña
 * equivocada es un 400, no un 401: la sesión sigue buena.
 */
export function apuntarEsteMovil(password: string, nombre: string, suscripcion: PushSubscriptionJSON) {
  return llamarApi<{ movil: MovilApuntado; clave: string }>('/auth/movil', {
    method: 'POST',
    json: { password, nombre, suscripcion },
  })
}

export function quitarMovil(id: number) {
  return llamarApi<null>(`/auth/movil/${id}`, { method: 'DELETE' })
}

// ===================================================================
//  El ordenador, mientras espera
// ===================================================================

/** Lo que devuelve el login cuando la cuenta tiene doble factor. */
export interface DobleFactorPendiente {
  status: '2FA_NEEDED'
  message: string
  /** Con móviles apuntados: el número que enseña esta pantalla, y hasta cuándo vale. */
  aprobacion?: { numero: number; expiraEn: string }
  /** Se entra desde un móvil apuntado: puede aprobar ahí mismo (`entrarDesdeEsteMovil`). */
  esteMovil?: true
}

export type EstadoDeLaEspera = 'PENDIENTE' | 'RECHAZADA' | 'FALLADA' | 'CADUCADA'

export type RespuestaDeLaEspera =
  | { estado: EstadoDeLaEspera }
  | { estado: 'APROBADA'; status: 'OK'; user: AuthUser }

/**
 * Pregunta si el móvil ya aprobó. Aprobada, deja la cookie de la sesión y
 * devuelve el usuario, igual que `verify2FA`. Un 401 `PENDING_2FA_REQUIRED`
 * es que el testigo caducó: vuelta a la contraseña.
 */
export function esperarAprobacion() {
  return llamarApi<RespuestaDeLaEspera>('/auth/login/aprobacion', { method: 'POST', auth: false })
}

/** Entrar desde el mismo móvil apuntado: su clave hace de segundo factor. */
export function entrarDesdeEsteMovil(credenciales: CredencialesDelMovil) {
  return llamarApi<{ status: 'OK'; user: AuthUser }>('/auth/login/este-movil', {
    method: 'POST',
    auth: false,
    json: credenciales,
  })
}

// ===================================================================
//  El móvil, al abrir el aviso
// ===================================================================

/** Lo que ve el móvil: los tres números mientras espera; si no, solo cómo acabó. */
export type VistaDeLaAprobacion =
  | { estado: 'PENDIENTE'; opciones: number[]; desde: string; expiraEn: string }
  | { estado: 'APROBADA' | 'USADA' | 'RECHAZADA' | 'FALLADA' | 'CADUCADA' }

export function verAprobacion(id: string, credenciales: CredencialesDelMovil) {
  return llamarApi<VistaDeLaAprobacion>(`/auth/aprobacion/${encodeURIComponent(id)}`, {
    method: 'POST',
    auth: false,
    json: credenciales,
  })
}

/** El número elegido. Equivocado, la aprobación queda anulada (`FALLADA`). */
export function aprobarEntrada(id: string, credenciales: CredencialesDelMovil, numero: number) {
  return llamarApi<{ estado: VistaDeLaAprobacion['estado'] }>(`/auth/aprobacion/${encodeURIComponent(id)}/aprobar`, {
    method: 'POST',
    auth: false,
    json: { ...credenciales, numero },
  })
}

/** «No he sido yo»: la rechaza y avisa a Administración. */
export function rechazarEntrada(id: string, credenciales: CredencialesDelMovil) {
  return llamarApi<{ estado: VistaDeLaAprobacion['estado'] }>(`/auth/aprobacion/${encodeURIComponent(id)}/rechazar`, {
    method: 'POST',
    auth: false,
    json: credenciales,
  })
}

/**
 * El servidor ya no reconoce este móvil (lo quitaron, o un rescate del 2FA):
 * hay que olvidar su clave y ofrecer apuntarlo otra vez.
 */
export function esMovilNoApuntado(error: unknown): boolean {
  return error instanceof ErrorDeApi && error.status === 403
    && (error.payload as { codigo?: string } | undefined)?.codigo === 'MOVIL_NO_APUNTADO'
}
