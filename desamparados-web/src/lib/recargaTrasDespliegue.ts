/**
 * Tras cada despliegue cambian los nombres de los trozos de código: quien
 * tuviera la web abierta pide, al navegar, un trozo que ya no existe, y la
 * página se rompe con «Failed to fetch dynamically imported module». Lo que lo
 * arregla es cargar la versión nueva, así que se recarga la página una vez.
 *
 * Solo una: si el trozo falla otra vez enseguida (sin red, el servidor caído),
 * recargar en bucle dejaría la página parpadeando. La marca va en
 * sessionStorage, que sobrevive a la recarga y no a cerrar la pestaña.
 */

const CLAVE = 'recarga-tras-despliegue'
/** Si la anterior fue hace menos que esto, no se vuelve a intentar. */
const MARGEN_MS = 10_000

/** El texto con que cada navegador dice que no pudo bajar un trozo de código. */
const FALLO_DE_TROZO = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

export function esFalloDeTrozo(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return FALLO_DE_TROZO.test(mensaje)
}

/** Ya se ha pedido la recarga en esta página: lo que se pinte mientras, sobra. */
let recargando = false

/**
 * Recarga la página si no se ha hecho hace un momento. Devuelve si recarga.
 * Se puede llamar al pintar: dos llamadas seguidas (el doble pintado de
 * StrictMode) dan la misma respuesta.
 */
export function recargarUnaVez(ahora = Date.now()): boolean {
  if (recargando) return true
  try {
    const anterior = Number(sessionStorage.getItem(CLAVE))
    if (anterior && ahora - anterior < MARGEN_MS) return false
    sessionStorage.setItem(CLAVE, String(ahora))
  } catch {
    // Sin sessionStorage no hay forma de saber si ya se intentó: mejor el aviso que un bucle.
    return false
  }
  recargando = true
  window.location.reload()
  return true
}

/**
 * Vite avisa con `vite:preloadError` cuando no puede bajar un trozo: si se
 * recarga, se cancela el error y nadie llega a verlo.
 */
export function recargarAlFallarUnTrozo() {
  window.addEventListener('vite:preloadError', (evento) => {
    if (recargarUnaVez()) evento.preventDefault()
  })
}
