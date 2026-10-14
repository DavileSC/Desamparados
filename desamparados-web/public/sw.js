/*
 * El service worker de los avisos al móvil del área de hermanos (módulo
 * `avisos-a-los-hermanos`), y nada más. Se registra con el ámbito
 * `/area-hermano/` al activar los avisos en «Mi perfil», así que nunca
 * controla la web pública. Nada de caché offline: la web no es una PWA y no
 * quiere serlo.
 *
 * Va sin pasar por Vite (está en `public/`): JavaScript del navegador tal cual.
 * nginx lo sirve con `no-cache`, para que un cambio llegue en la siguiente visita.
 */

self.addEventListener('install', () => {
  // Sin páginas en caché que proteger: la versión nueva entra en el acto.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/** Un aviso solo lleva al área de hermanos: a ningún otro sitio. */
function rutaDelArea(url) {
  return typeof url === 'string' && /^\/area-hermano(\/[A-Za-z0-9_-]+)*$/.test(url) ? url : null
}

self.addEventListener('push', (event) => {
  let aviso = null
  try {
    aviso = event.data ? event.data.json() : null
  } catch {
    aviso = null
  }
  if (!aviso || aviso.tipo !== 'aviso') return
  const url = rutaDelArea(aviso.url)
  if (!url) return

  event.waitUntil(
    self.registration.showNotification(aviso.titulo || 'Aviso', {
      body: aviso.cuerpo || '',
      // Uno nuevo de lo mismo (otra vuelta del mismo aviso) sustituye al anterior.
      tag: typeof aviso.etiqueta === 'string' ? aviso.etiqueta : 'aviso',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = rutaDelArea(event.notification.data && event.notification.data.url)
  if (!url) return

  event.waitUntil((async () => {
    // Si la web ya está abierta en una ventana, se lleva allí en vez de abrir otra.
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const ventana of ventanas) {
      if (new URL(ventana.url).origin !== self.location.origin) continue
      try {
        const llevada = await ventana.navigate(url)
        if (llevada) return llevada.focus()
      } catch {
        // Una ventana que no controla este worker no se deja llevar: se abre otra.
      }
    }
    return self.clients.openWindow(url)
  })())
})
