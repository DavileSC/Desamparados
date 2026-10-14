/**
 * Los avisos del navegador (Web Push) del área de hermanos: si este navegador
 * puede recibirlos, pedir permiso, suscribirse y darse de baja. Lo que se
 * guarda de cada móvil está en el servidor (ver `lib/api/avisos.ts`).
 */

/**
 * Dónde se registra el service worker: el área de hermanos, la única que
 * recibe avisos. La página que se suscribe está siempre dentro de ese ámbito.
 */
export type Ambito = '/area-hermano/'

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

/** Un móvil o una tableta: solo ahí se pregunta al entrar si se quieren los avisos. */
export function esPantallaTactil(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches === true
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
export async function suscribirEsteNavegador(clavePublica: string, ambito: Ambito = '/area-hermano/'): Promise<PushSubscription> {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    throw new Error('El móvil no ha dado permiso para mostrar avisos. Actívalo en los ajustes de notificaciones del navegador y vuelve a probar.')
  }
  await navigator.serviceWorker.register('/sw.js', { scope: ambito })
  // `ready` es el registro que controla esta página: «Mi perfil» está dentro
  // de su ámbito.
  const registro = await navigator.serviceWorker.ready
  const anterior = await registro.pushManager.getSubscription()
  if (anterior) await anterior.unsubscribe()
  return registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deBase64Url(clavePublica) })
}

/** Deja de recibir avisos en este navegador. Sin suscripción, no hace nada. */
export async function darDeBajaEsteNavegador(ambito: Ambito = '/area-hermano/'): Promise<void> {
  try {
    const registro = await navigator.serviceWorker?.getRegistration(ambito)
    const suscripcion = await registro?.pushManager.getSubscription()
    await suscripcion?.unsubscribe()
  } catch {
    // Si no se puede, el servidor ya no tiene el móvil: los avisos no llegarán.
  }
}

