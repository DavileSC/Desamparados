import { useEffect } from 'react'

/**
 * Cierto cuando es la propia web la que deja la página a propósito: lo que
 * hubiera a medias ya no sirve y preguntar solo deja elegir «Quedarse».
 */
let saliendoAProposito = false

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
      if (saliendoAProposito) return
      evento.preventDefault()
      // Chrome y Edge antiguos solo preguntan si además se rellena esto.
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [activo])
}

/**
 * Carga otra dirección de la web desde cero sin el aviso de cambios sin
 * guardar. Cuando otra cuenta entra en la ventana de sesión caducada, lo que
 * hay en pantalla es de la anterior: si el aviso dejaba elegir «Quedarse», la
 * pantalla seguía con el formulario de A y la sesión y los datos de B.
 */
export function irSinAviso(direccion: string): void {
  saliendoAProposito = true
  window.location.assign(direccion)
}
