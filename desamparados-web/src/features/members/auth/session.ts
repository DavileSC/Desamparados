import { useEffect, useRef } from 'react'
import { sesionActual, cerrarSesionApi } from '../../../lib/api/auth'
import { ApiError } from '../../../lib/api/client'
import { useAuthStore, CLAVE_PERSISTENCIA_ANTIGUA } from './store'

/**
 * Esperas entre intentos cuando /me falla por algo pasajero (429, 5xx, sin
 * red). Mientras tanto el estado sigue en `cargando` y los guardas esperan.
 */
export const ESPERAS_REINTENTO_MS = [1000, 3000, 8000]

// Solo un 401 dice de verdad «no hay sesión». Un 429 del limitador, un 5xx o
// un backend reiniciándose no dicen nada de la cookie, y tratarlos como
// invitado mandaba al login a quien tenía la sesión intacta.
const esPasajero = (error: unknown) =>
  !(error instanceof ApiError) || error.status === 429 || error.status >= 500

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
    localStorage.removeItem(CLAVE_PERSISTENCIA_ANTIGUA)

    preguntarSesion()
      .then(({ user }) => useAuthStore.getState().entrarSesion(user))
      .catch(() => useAuthStore.getState().salirSesion())
  }, [])
}

/** Cierra la sesión en el servidor (que borra la cookie) y luego en el cliente. */
export async function cerrarSesion(): Promise<void> {
  try {
    await cerrarSesionApi()
  } catch {
    // Si el servidor no responde, al menos limpiamos el estado local.
  }
  useAuthStore.getState().salirSesion()
}
