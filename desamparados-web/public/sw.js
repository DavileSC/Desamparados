/*
 * Ya no hay avisos al móvil (quitados el 28-11-2026: todo va por correo, y
 * volverán con la app). Este fichero se queda para que se vaya solo el
 * service worker que instalaron los móviles que los activaron: el navegador
 * vuelve a pedir este fichero al entrar en el área, ve que ha cambiado,
 * instala este y este se da de baja. Si el fichero diera 404, el navegador se
 * quedaría con el viejo para siempre.
 *
 * Va sin pasar por Vite (está en `public/`): JavaScript del navegador tal cual.
 * nginx lo sirve con `no-cache`, para que el cambio llegue en la siguiente visita.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // La suscripción del servicio de avisos, también: sin ella nadie puede volver a mandarle nada.
    const suscripcion = await self.registration.pushManager?.getSubscription()
    await suscripcion?.unsubscribe().catch(() => undefined)
    await self.registration.unregister()
  })())
})
