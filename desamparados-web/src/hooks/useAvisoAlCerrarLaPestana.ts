import { useEffect } from 'react'

/**
 * Pide confirmación al cerrar la pestaña, recargar o salir a otra web mientras
 * `activo` sea cierto. `useBlocker` solo ve la navegación dentro de la web: la
 * X de la pestaña o un F5 se llevaban los cambios sin preguntar. El texto lo
 * pone el navegador; desde aquí solo se puede pedir que pregunte.
 */
export function useAvisoAlCerrarLaPestana(activo: boolean): void {
  useEffect(() => {
    if (!activo) return
    const alSalir = (evento: BeforeUnloadEvent) => {
      evento.preventDefault()
      // Chrome y Edge antiguos solo preguntan si además se rellena esto.
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [activo])
}
