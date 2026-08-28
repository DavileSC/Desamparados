import { useEffect, useRef } from 'react'
import { sesionActual, cerrarSesionApi } from '../../../lib/api/auth'
import { useAuthStore, CLAVE_PERSISTENCIA_ANTIGUA } from './store'

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

    sesionActual()
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
