import { useEffect, useRef } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { sesionActual, cerrarSesionApi } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { useAuthStore, CLAVE_PERSISTENCIA_ANTIGUA, type AuthUser } from './store'

/**
 * Esperas entre intentos cuando /me falla por algo pasajero (429, 5xx, sin
 * red). Mientras tanto el estado sigue en `cargando` y los guardas esperan.
 */
export const ESPERAS_REINTENTO_MS = [1000, 3000, 8000]

// Solo un 401 decía «no hay sesión», pero /auth/me ya no devuelve 401 nunca:
// solo quedan los fallos pasajeros que sí merecen reintento.
const esPasajero = (error: unknown) =>
  !(error instanceof ErrorDeApi) || error.status === 429 || error.status >= 500

async function preguntarSesion() {
  for (let intento = 0; ; intento++) {
    try {
      return await sesionActual()
    } catch (error) {
      if (!esPasajero(error) || intento >= ESPERAS_REINTENTO_MS.length) throw error
      await new Promise((resolver) => setTimeout(resolver, ESPERAS_REINTENTO_MS[intento]))
    }
  }
}

/**
 * Pregunta al servidor si hay sesión. Se llama una sola vez al arrancar la
 * aplicación: el token ya no es legible desde JavaScript, así que esta es la
 * única forma de saberlo tras recargar la página.
 */
export function useCargarSesion(): void {
  const yaLanzado = useRef(false)

  useEffect(() => {
    if (yaLanzado.current) return
    yaLanzado.current = true

    // Limpieza de una vez: borra el token y los datos personales que las
    // versiones anteriores guardaban en el navegador de cada usuario.
    // Con el almacenamiento bloqueado (modo estricto, política del equipo)
    // `localStorage` lanza al tocarlo: sin el try la web entera no arrancaba
    // por una limpieza que, en ese caso, ni siquiera tiene nada que limpiar.
    try {
      localStorage.removeItem(CLAVE_PERSISTENCIA_ANTIGUA)
    } catch {
      // Nada que hacer: si no se puede leer, tampoco quedó nada guardado.
    }

    preguntarSesion()
      // Deja el estado en 'listo' aunque no haya ninguna: sin eso los guardas
      // se quedarían esperando para siempre a un invitado.
      .then(({ cms, hermano }) => useAuthStore.getState().ponerSesiones({ cms, hermano }))
      .catch(() => useAuthStore.getState().salirSesion())
  }, [])
}

/** Cierra la sesión de un área en el servidor (que borra su cookie) y luego en el cliente. */
export async function cerrarSesion(area: 'cms' | 'hermanos'): Promise<void> {
  try {
    await cerrarSesionApi(area)
  } catch {
    // Si el servidor no responde, al menos limpiamos el estado local.
  }
  useAuthStore.getState().salirSesion(area)
}

/** Había alguien y ahora hay otro, o nadie. Entrar desde invitado no cuenta. */
const cambiaDeUsuario = (antes: AuthUser | null, ahora: AuthUser | null) => !!antes && antes.id !== ahora?.id

/**
 * Vacía la caché de React Query cuando sale quien estaba dentro o entra otra
 * persona. Las claves no llevan el usuario (`['mis-certificados']`), así
 * que en un ordenador compartido el siguiente hermano veía, al momento, los
 * certificados del anterior: la caché seguía fresca y no se volvía a pedir.
 * Se escucha el estado de sesión en vez de vaciar en cada «Cerrar sesión»
 * porque el usuario también cambia sin pulsar nada (una sesión que caduca, la
 * ventana de volver a entrar con otra cuenta). Devuelve cómo dejar de escuchar.
 */
export function vaciarCacheAlCambiarDeUsuario(queryClient: QueryClient): () => void {
  return useAuthStore.subscribe((ahora, antes) => {
    if (cambiaDeUsuario(antes.cms, ahora.cms) || cambiaDeUsuario(antes.hermano, ahora.hermano)) queryClient.clear()
  })
}

export function useVaciarCacheAlCambiarDeUsuario(queryClient: QueryClient): void {
  useEffect(() => vaciarCacheAlCambiarDeUsuario(queryClient), [queryClient])
}
