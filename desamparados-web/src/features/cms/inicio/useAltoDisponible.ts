import { useCallback, useEffect, useState } from 'react'

/**
 * El alto que queda de ventana desde donde empieza el elemento hasta abajo:
 * así el Inicio cabe entero sin scroll, tenga o no la barra de arriba del
 * móvil. Se rehace al cambiar el tamaño de la ventana.
 */
export function useAltoDisponible() {
  const [nodo, setNodo] = useState<HTMLElement | null>(null)
  const [alto, setAlto] = useState<number | null>(null)
  const referencia = useCallback((n: HTMLElement | null) => setNodo(n), [])

  useEffect(() => {
    if (!nodo) return
    const medir = () => setAlto(Math.max(0, window.innerHeight - (nodo.getBoundingClientRect().top + window.scrollY)))
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [nodo])

  return { referencia, alto }
}
