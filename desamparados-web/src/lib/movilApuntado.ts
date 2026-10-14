import type { CredencialesDelMovil } from './api/aprobacion'

/**
 * Lo que este navegador sabe de sí mismo como móvil apuntado para aprobar la
 * entrada al CMS: su número, su clave y el nombre con que se apuntó.
 *
 * En IndexedDB y no en localStorage porque es lo único que también puede leer
 * un service worker. La clave no sale de aquí salvo hacia la API: el servidor
 * guarda solo su hash, y sin ella nadie puede aprobar desde otra pestaña.
 *
 * Todo falla en silencio (navegación privada, almacenamiento bloqueado, las
 * pruebas): sin la clave, el móvil sencillamente no está apuntado y queda el
 * código de la app.
 */
export interface MovilDeEsteNavegador extends CredencialesDelMovil {
  nombre: string
}

const BASE = 'avisos-en-el-movil'
const ALMACEN = 'credenciales'
const CLAVE = 'este-movil'

function abrir(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const peticion = indexedDB.open(BASE, 1)
      peticion.onupgradeneeded = () => { peticion.result.createObjectStore(ALMACEN) }
      peticion.onsuccess = () => resolve(peticion.result)
      peticion.onerror = () => resolve(null)
      peticion.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Una operación sobre el almacén; `undefined` si no se pudo, sin lanzar. */
async function enAlmacen<T>(modo: IDBTransactionMode, hacer: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<{ ok: boolean; valor?: T }> {
  const base = await abrir()
  if (!base) return { ok: false }
  return new Promise((resolve) => {
    try {
      const tx = base.transaction(ALMACEN, modo)
      const peticion = hacer(tx.objectStore(ALMACEN))
      tx.oncomplete = () => { base.close(); resolve({ ok: true, valor: peticion.result }) }
      tx.onerror = () => { base.close(); resolve({ ok: false }) }
      tx.onabort = () => { base.close(); resolve({ ok: false }) }
    } catch {
      base.close()
      resolve({ ok: false })
    }
  })
}

export async function leerEsteMovil(): Promise<MovilDeEsteNavegador | null> {
  const { valor } = await enAlmacen('readonly', (almacen) => almacen.get(CLAVE))
  const movil = valor as Partial<MovilDeEsteNavegador> | undefined
  if (!movil || !Number.isInteger(movil.dispositivo) || typeof movil.clave !== 'string' || !movil.clave) return null
  return { dispositivo: movil.dispositivo!, clave: movil.clave, nombre: typeof movil.nombre === 'string' ? movil.nombre : '' }
}

/** false si no se pudo guardar: entonces el móvil no podría aprobar nada. */
export async function guardarEsteMovil(movil: MovilDeEsteNavegador): Promise<boolean> {
  return (await enAlmacen('readwrite', (almacen) => almacen.put(movil, CLAVE))).ok
}

export async function olvidarEsteMovil(): Promise<void> {
  await enAlmacen('readwrite', (almacen) => almacen.delete(CLAVE))
}

// ===================================================================
//  Los avisos del navegador (Web Push)
// ===================================================================

/**
 * Dónde se registra el service worker: el CMS (aprobar la entrada) y el área
 * de hermanos (sus avisos) son registros aparte, cada uno con su suscripción,
 * y quitar uno no toca el otro.
 */
export type Ambito = '/cms/' | '/area-hermano/'

/** El navegador sabe recibir avisos. En iPhone, solo con la web en la pantalla de inicio. */
export function admiteAvisos(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** iPhone o iPad (el iPad se presenta como un Mac, pero con pantalla táctil). */
export function esIphone(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Abierta desde el icono de la pantalla de inicio, no desde el navegador. */
export function enPantallaDeInicio(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Un móvil o una tableta: el ordenador no se apunta, es el que pide entrar. */
export function esPantallaTactil(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches === true
}

/** Nombre de partida para la lista de «Mi seguridad»; quien apunta lo cambia. */
export function nombreSugerido(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/iPad/.test(ua) || (esIphone() && !/iPhone|iPod/.test(ua))) return 'iPad'
  if (esIphone()) return 'iPhone'
  if (/Android/.test(ua)) return 'Móvil Android'
  return 'Este móvil'
}

/**
 * Nombre que se pone solo en los avisos del área («Android · Chrome»): al
 * hermano no se le pregunta, solo tiene que reconocerlo en la lista.
 */
export function nombreDelDispositivo(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const sistema = /iPad/.test(ua) || (esIphone() && !/iPhone|iPod/.test(ua)) ? 'iPad'
    : esIphone() ? 'iPhone'
      : /Android/.test(ua) ? 'Android'
        : /Windows/.test(ua) ? 'Windows'
          : /Mac OS X/.test(ua) ? 'Mac'
            : 'Otro'
  const navegador = /Edg\//.test(ua) ? 'Edge'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
      : /Firefox\/|FxiOS/.test(ua) ? 'Firefox'
        : /Chrome\/|CriOS/.test(ua) ? 'Chrome'
          : /Safari\//.test(ua) ? 'Safari'
            : 'navegador'
  return `${sistema} · ${navegador}`
}

/** La clave pública del servidor viene en base64url; el navegador la quiere en bytes. */
function deBase64Url(texto: string): Uint8Array<ArrayBuffer> {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (texto.length % 4)) % 4)
  return Uint8Array.from(atob(base64), (letra) => letra.charCodeAt(0))
}

/**
 * Pide permiso, registra el service worker y da una suscripción nueva. Si ya
 * había una (de un apuntado anterior que se quitó), se da de baja antes: así
 * el servidor no guarda un endpoint que otro registro ya conoce.
 */
export async function suscribirEsteNavegador(clavePublica: string, ambito: Ambito = '/cms/'): Promise<PushSubscription> {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    throw new Error('El móvil no ha dado permiso para mostrar avisos. Actívalo en los ajustes de notificaciones del navegador y vuelve a probar.')
  }
  await navigator.serviceWorker.register('/sw.js', { scope: ambito })
  // `ready` es el registro que controla esta página: la página está siempre
  // dentro de su ámbito (Mi seguridad en /cms/, Mi perfil en /area-hermano/).
  const registro = await navigator.serviceWorker.ready
  const anterior = await registro.pushManager.getSubscription()
  if (anterior) await anterior.unsubscribe()
  return registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deBase64Url(clavePublica) })
}

/** Deja de recibir avisos en este navegador. Sin suscripción, no hace nada. */
export async function darDeBajaEsteNavegador(ambito: Ambito = '/cms/'): Promise<void> {
  try {
    const registro = await navigator.serviceWorker?.getRegistration(ambito)
    const suscripcion = await registro?.pushManager.getSubscription()
    await suscripcion?.unsubscribe()
  } catch {
    // Si no se puede, el servidor ya no tiene el móvil: los avisos no llegarán.
  }
}

/** ¿Tiene este navegador suscripción en ese ámbito? Sin ella, el servidor no puede avisarle aquí. */
export async function tieneSuscripcion(ambito: Ambito): Promise<boolean> {
  try {
    const registro = await navigator.serviceWorker?.getRegistration(ambito)
    return Boolean(await registro?.pushManager.getSubscription())
  } catch {
    return false
  }
}
