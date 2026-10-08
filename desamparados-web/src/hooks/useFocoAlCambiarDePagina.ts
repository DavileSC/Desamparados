import { useEffect, useRef, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'

/** Lo que se espera a que la página nueva pinte su título (carga perezosa, datos). */
const ESPERA_MAXIMA_MS = 4000

/**
 * Lleva el foco al título de la página nueva al navegar dentro de la web.
 *
 * En una SPA el navegador no recarga nada: el foco se quedaba en el enlace del
 * menú que se acababa de pulsar, y un lector de pantalla no anunciaba que la
 * página había cambiado. Así se anuncia el `<h1>` nuevo y el tabulador sigue
 * desde el contenido. Si la página no tiene `<h1>`, el foco va al `<main>`.
 *
 * - No en la primera carga: ahí el navegador ya empieza por arriba, y robar el
 *   foco saltaría por encima de la barra y del enlace de «Saltar al contenido».
 * - Solo cuando cambia la ruta, no la búsqueda (`?mostrar=19` de «Cargar más»
 *   no es otra página) ni cuando hay un `#ancla`, que tiene su propio destino.
 * - Con `preventScroll`: el desplazamiento es cosa de `ScrollRestoration`.
 *
 * El título puede tardar (la página es perezosa y a veces espera a la API), así
 * que se vigila el `<main>` hasta que aparece, con un tope.
 */
export function useFocoAlCambiarDePagina(principal: RefObject<HTMLElement | null>) {
  const { pathname, hash } = useLocation()
  const primera = useRef(true)

  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    const main = principal.current
    if (!main || hash) return

    const enfocar = (destino: HTMLElement) => {
      if (destino !== main && !destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1')
      destino.focus({ preventScroll: true })
    }
    const titulo = () => main.querySelector<HTMLElement>('h1')

    const yaEsta = titulo()
    if (yaEsta) {
      enfocar(yaEsta)
      return
    }

    const vigia = new MutationObserver(() => {
      const h1 = titulo()
      if (!h1) return
      terminar()
      enfocar(h1)
    })
    const tope = setTimeout(() => {
      terminar()
      enfocar(main)
    }, ESPERA_MAXIMA_MS)
    function terminar() {
      vigia.disconnect()
      clearTimeout(tope)
    }
    vigia.observe(main, { childList: true, subtree: true })
    return terminar
  }, [pathname, hash, principal])
}
