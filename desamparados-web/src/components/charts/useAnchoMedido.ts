import { useEffect, useRef, useState } from 'react'

/** Ancho de partida mientras nadie ha medido nada (y en los tests, que no miden). */
const ANCHO_POR_DEFECTO = 560

/**
 * El ancho real que tiene el hueco donde va la gráfica, en píxeles.
 *
 * Las gráficas se dibujaban con un `viewBox` fijo y `width="100%"`, así que el
 * navegador las escalaba: en una tarjeta de 900 px, un dibujo de 640×232 se
 * pintaba a 326 px de alto, y al ensanchar la tarjeta crecía más. Midiendo el
 * hueco, el `viewBox` va en píxeles de verdad (una unidad, un píxel): el alto es
 * el que se pida y no cambia nunca, y el texto no se estira.
 *
 * `ResizeObserver` no existe en jsdom (los tests lo sustituyen por uno que no
 * hace nada), así que el ancho de partida tiene que servir por sí solo.
 */
export function useAnchoMedido<T extends HTMLElement = HTMLDivElement>() {
  const referencia = useRef<T>(null)
  const [ancho, setAncho] = useState(ANCHO_POR_DEFECTO)

  useEffect(() => {
    const nodo = referencia.current
    if (!nodo || typeof ResizeObserver === 'undefined') return

    const medir = () => {
      const medido = Math.round(nodo.clientWidth)
      // Mientras el elemento está oculto (una pestaña cerrada) mide 0: ese
      // ancho no vale, y volverá a medirse al abrirla.
      if (medido > 0) setAncho(medido)
    }

    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [])

  return { referencia, ancho }
}
