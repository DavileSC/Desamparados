import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Lo que queda de pantalla desde el elemento hasta el pie, contando el margen
 * de abajo de los contenedores del CMS (sin él, la página bajaba esos
 * píxeles). La mesa tiene que caber sin bajar (20-10-2026): el panel y la
 * tabla toman este alto y, si no les llega, bajan por dentro, no la página.
 * Nunca menos de `minimo`: en una pantalla muy baja, mejor bajar que no leer.
 */
export function useAltoHastaElPie(ref: RefObject<HTMLElement | null>, minimo: number): number | null {
  const [alto, setAlto] = useState<number | null>(null)
  useLayoutEffect(() => {
    const medir = () => {
      const el = ref.current
      if (!el) return
      let margen = 0
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        margen += parseFloat(getComputedStyle(p).paddingBottom) || 0
        if (p.tagName === 'MAIN') break
      }
      setAlto(Math.max(minimo, Math.floor(window.innerHeight - el.getBoundingClientRect().top - window.scrollY - margen)))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  })
  return alto
}
