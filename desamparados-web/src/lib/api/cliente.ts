import { useAuthStore } from '../../features/altas/auth/store'

/**
 * Cliente HTTP mínimo para la API del backend.
 *
 * - Base URL: `/api` (mismo origen; en desarrollo Vite lo proxyea al backend,
 *   ver vite.config.ts). La API tiene que estar en el mismo dominio: la cookie
 *   de sesión es SameSite=Strict y el navegador no la mandaría a otro origen.
 * - La sesión viaja en una cookie httpOnly que el navegador adjunta solo: aquí
 *   no se lee ni se guarda ningún token.
 * - Un 401 en una petición que esperaba sesión significa que una de las dos
 *   sesiones (CMS o hermanos) ha caducado o se ha revocado: se vuelve a
 *   preguntar al servidor y se actualiza el estado local con lo que quede.
 */
const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')

/**
 * La dirección de un documento de storage/private (la foto o el certificado de
 * bautismo del alta). Solo la abre una sesión del CMS: la cookie va sola porque
 * la API está en el mismo dominio.
 */
export const urlDocumentoPrivado = (nombre: string) => `${BASE_URL}/upload/private/${encodeURIComponent(nombre)}`

export class ErrorDeApi extends Error {
  status: number
  payload: unknown
  fields: Record<string, string>

  constructor(message: string, status: number, datos?: unknown) {
    super(message)
    this.name = 'ErrorDeApi'
    this.status = status
    this.payload = datos
    this.fields = erroresPorCampo(datos)
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

function mensajeDelCuerpo(datos: unknown): string | null {
  if (!datos || typeof datos !== 'object') return null
  const p = datos as Record<string, unknown>
  if (typeof p.message === 'string' && p.message) return p.message
  if (typeof p.error === 'string' && p.error) return p.error
  return null
}

// El validador del backend devuelve { errors: [{ field, message }] }
function erroresPorCampo(datos: unknown): Record<string, string> {
  if (!datos || typeof datos !== 'object') return {}
  const errors = (datos as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return {}
  const salida: Record<string, string> = {}
  for (const e of errors) {
    if (e && typeof e === 'object' && typeof (e as { field?: unknown }).field === 'string') {
      salida[(e as { field: string }).field] = String((e as { message?: unknown }).message ?? '')
    }
  }
  return salida
}

/**
 * El mensaje que verá quien use la pantalla. Un 400 de validación trae el
 * mensaje genérico «Error de validación» y el detalle en `errors`: las pantallas
 * que pintan cada campo usan `ErrorDeApi.fields`, pero las que solo enseñan un
 * aviso se quedaban sin saber qué corregir. Se añaden hasta tres campos.
 */
function mensajeDeError(datos: unknown): string | null {
  const mensaje = mensajeDelCuerpo(datos)
  const campos = Object.entries(erroresPorCampo(datos))
  if (campos.length === 0) return mensaje
  const detalle = campos.slice(0, 3).map(([campo, texto]) => (texto ? `${campo}: ${texto}` : campo)).join('; ')
  const resto = campos.length > 3 ? ` (y ${campos.length - 3} más)` : ''
  return `${mensaje ?? 'Revisa los datos'}. ${detalle}${resto}.`
}

/**
 * El 403 del backend cuando la petición llega al CMS con una cookie que no es
 * la suya (por ejemplo, la del área de hermanos). Con cookies separadas por
 * área, ninguna pestaña puede pisarle la sesión a otra: este código ya no dice
 * «te han sustituido la cookie», sino «has llegado al CMS sin haber entrado
 * por su acceso».
 */
export const SESION_NO_CMS = 'SESION_NO_CMS'

/**
 * El 403 de una cuenta del equipo sin doble factor. Llega si se lo quitan con
 * la sesión abierta (un rescate de un ADMIN, o «Cambiar de móvil» en otra
 * pestaña): se pregunta la sesión, el store se entera de que falta y
 * `ExigeRol` enseña la pantalla para activarlo.
 */
const FALTA_DOBLE_FACTOR = 'FALTA_DOBLE_FACTOR'

/**
 * El 404 del backend cuando la ruta es de un módulo apagado. Si llega, la
 * lista de módulos que tiene esta sesión está vieja (Administración lo apagó
 * desde otra): `useModulos` se apunta aquí para volver a pedirla, y así los
 * menús y las rutas se enteran sin recargar la página.
 */
const MODULO_NO_ACTIVADO = 'MODULO_NO_ACTIVADO'

/**
 * El 403 de una cuenta del censo importado que aún no ha revisado su ficha: la
 * API solo le deja la sesión, sus fichas y la propia revisión. Llega si una
 * pantalla del área se adelanta a la guarda (otra pestaña, un enlace guardado);
 * en vez de enseñar el error, se marca la sesión y `ExigeSesion` la lleva a
 * `/primer-acceso/ficha`.
 */
const PRIMER_ACCESO_PENDIENTE = 'PRIMER_ACCESO_PENDIENTE'

function marcarPrimerAccesoPendiente() {
  const { hermano } = useAuthStore.getState()
  if (hermano && hermano.primerAccesoPendiente !== true) useAuthStore.setState({ hermano: { ...hermano, primerAccesoPendiente: true } })
}

type OyenteDeModulo = (modulo: string) => void
const oyentesDeModuloNoActivado = new Set<OyenteDeModulo>()

/** Avisa con la clave del módulo cada vez que una respuesta diga que está apagado. Devuelve cómo dejar de escuchar. */
export function alModuloNoActivado(oyente: OyenteDeModulo): () => void {
  oyentesDeModuloNoActivado.add(oyente)
  return () => { oyentesDeModuloNoActivado.delete(oyente) }
}

/** La clave del módulo apagado que anuncia una respuesta, o null si no es eso. */
function moduloNoActivado(datos: unknown): string | null {
  if (!datos || typeof datos !== 'object') return null
  const p = datos as { error?: unknown; modulo?: unknown }
  return p.error === MODULO_NO_ACTIVADO && typeof p.modulo === 'string' ? p.modulo : null
}

function avisarSiModuloNoActivado(status: number, datos: unknown) {
  if (status !== 404) return
  const modulo = moduloNoActivado(datos)
  if (modulo) for (const oyente of oyentesDeModuloNoActivado) oyente(modulo)
}

let refrescando: Promise<void> | null = null

/** Una sola consulta aunque fallen a la vez todas las peticiones de la pantalla. */
function refrescarSesiones(): Promise<void> {
  refrescando ??= import('./auth')
    .then(({ sesionActual }) => sesionActual())
    .then(({ cms, hermano }) => {
      const { cms: antes, ponerSesiones } = useAuthStore.getState()
      if (antes && !cms) {
        // La del CMS ha caducado con alguien dentro, quizá a medio escribir:
        // se le pide volver a entrar en una ventana (ver `cmsCaducada`) en
        // vez de vaciarla, que desmontaría el formulario con su texto.
        useAuthStore.setState({ status: 'listo', hermano, cmsCaducada: true })
        return
      }
      ponerSesiones({ cms, hermano })
    })
    // /auth/me no responde 401 nunca: si falla es la red o el servidor, y eso
    // no dice nada de las sesiones. Vaciarlas echaba también a la que seguía
    // viva; la siguiente petición que falle volverá a preguntar.
    .catch(() => undefined)
    .finally(() => { refrescando = null })
  return refrescando
}

export async function llamarApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
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
    throw new ErrorDeApi('No se ha podido conectar con el servidor. Inténtalo de nuevo en unos minutos.', 0)
  }

  const texto = await res.text()
  let datos: unknown = null
  try {
    datos = texto ? JSON.parse(texto) : null
  } catch {
    datos = texto
  }

  if (!res.ok) {
    avisarSiModuloNoActivado(res.status, datos)
    // `auth: false` marca las peticiones para las que un 401 es normal (login,
    // y sobre todo el /me del arranque cuando el visitante es un invitado).
    if (res.status === 401 && auth) {
      // Una de las dos sesiones ha caducado o se ha revocado, pero desde aquí
      // no sabemos cuál: la petición no lleva el área. Preguntamos al servidor,
      // que devuelve las dos, en vez de tirar las dos a ciegas y echar de la
      // buena a quien seguía dentro.
      void refrescarSesiones()
    }
    if (res.status === 403 && (datos as { error?: unknown } | null)?.error === FALTA_DOBLE_FACTOR) {
      void refrescarSesiones()
    }
    if (res.status === 403 && (datos as { error?: unknown } | null)?.error === PRIMER_ACCESO_PENDIENTE) {
      marcarPrimerAccesoPendiente()
    }
    throw new ErrorDeApi(mensajeDeError(datos) ?? `Error ${res.status}`, res.status, datos)
  }

  return datos as T
}

/**
 * Un fichero de la API (un PDF): el contenido y el nombre que propone el
 * servidor. Los errores llegan igual que en `llamarApi`, con su mensaje.
 * Con `json`, se pide por POST con ese cuerpo (las cartas aún sin guardar).
 */
export async function traerArchivo(path: string, json?: unknown): Promise<{ blob: Blob; nombre: string | null }> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      ...(json !== undefined && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) }),
    })
  } catch {
    throw new ErrorDeApi('No se ha podido conectar con el servidor. Inténtalo de nuevo en unos minutos.', 0)
  }
  if (!res.ok) {
    const texto = await res.text()
    let datos: unknown = texto
    try { datos = texto ? JSON.parse(texto) : null } catch { /* no era JSON: se queda el texto */ }
    avisarSiModuloNoActivado(res.status, datos)
    if (res.status === 401) void refrescarSesiones()
    throw new ErrorDeApi(mensajeDeError(datos) ?? `Error ${res.status}`, res.status, datos)
  }
  const nombre = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? null
  return { blob: await res.blob(), nombre }
}
