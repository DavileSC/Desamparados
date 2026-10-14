/*
 * El service worker del CMS: solo los avisos para aprobar la entrada desde el
 * móvil (módulo `avisos-en-el-movil`). Nada de caché offline: la web no es una
 * PWA y no quiere serlo. Se registra con el ámbito `/cms/` al apuntar el móvil
 * en «Mi seguridad», así que nunca controla la web pública.
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

/** Solo se abren rutas de aprobar: el aviso no puede llevar a ningún otro sitio. */
function rutaDeAprobar(url) {
  return typeof url === 'string' && /^\/cms\/aprobar\/[A-Za-z0-9_-]+$/.test(url) ? url : null
}

self.addEventListener('push', (event) => {
  let aviso = null
  try {
    aviso = event.data ? event.data.json() : null
  } catch {
    aviso = null
  }
  if (!aviso || aviso.tipo !== 'aprobar-entrada' || !rutaDeAprobar(aviso.url)) return

  event.waitUntil(
    self.registration.showNotification(aviso.titulo || '¿Eres tú?', {
      body: aviso.cuerpo || 'Entrada al CMS',
      // Un aviso nuevo sustituye al anterior en vez de apilarse: solo vale el último.
      tag: 'aprobar-entrada',
      renotify: true,
      // Caduca en dos minutos: que no se esconda solo antes de abrirlo.
      requireInteraction: true,
      data: { url: aviso.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = rutaDeAprobar(event.notification.data && event.notification.data.url)
  if (!url) return

  event.waitUntil((async () => {
    // Si el CMS ya está abierto en una ventana, se lleva allí en vez de abrir otra.
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
