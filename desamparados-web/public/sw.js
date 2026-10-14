/*
 * El service worker de los avisos al móvil, y nada más: los de aprobar la
 * entrada al CMS (módulo `avisos-en-el-movil`, ámbito `/cms/`) y los del área
 * de hermanos (`avisos-a-los-hermanos`, ámbito `/area-hermano/`). Cada ámbito
 * es un registro aparte con su propia suscripción. Nada de caché offline: la
 * web no es una PWA y no quiere serlo, y nunca controla la web pública.
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

/** Un aviso a un hermano solo lleva a su área. */
function rutaDelArea(url) {
  return typeof url === 'string' && /^\/area-hermano(\/[A-Za-z0-9_-]+)*$/.test(url) ? url : null
}

/** Adónde puede llevar un aviso, según de quién sea. */
function rutaDe(aviso) {
  if (!aviso) return null
  if (aviso.tipo === 'aprobar-entrada') return rutaDeAprobar(aviso.url)
  if (aviso.tipo === 'aviso') return rutaDelArea(aviso.url)
  return null
}

self.addEventListener('push', (event) => {
  let aviso = null
  try {
    aviso = event.data ? event.data.json() : null
  } catch {
    aviso = null
  }
  const url = rutaDe(aviso)
  if (!url) return

  if (aviso.tipo === 'aviso') {
    event.waitUntil(
      self.registration.showNotification(aviso.titulo || 'Aviso', {
        body: aviso.cuerpo || '',
        // Uno nuevo de lo mismo (otra vuelta del mismo aviso) sustituye al anterior.
        tag: typeof aviso.etiqueta === 'string' ? aviso.etiqueta : 'aviso',
        data: { url },
      }),
    )
    return
  }

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
  const datos = event.notification.data || {}
  const url = rutaDeAprobar(datos.url) || rutaDelArea(datos.url)
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
