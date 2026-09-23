import { useEffect, useState } from 'react'
import { keyframes } from '@mui/material/styles'
import { designTokens } from '../../../theme'

/** Las cifras grandes: la Saira del CMS, estrecha y con dígitos de igual ancho. */
export const CIFRA = {
  fontFamily: designTokens.fonts.cms.heading,
  fontStretch: '78%',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
} as const

/**
 * Las animaciones del Inicio. Cada una cuenta algo del dato que mueve —la
 * cifra sube hasta su valor, la curva se dibuja en el orden de los meses, el
 * curso se llena hasta hoy, el cortejo se enciende tramo a tramo— y todas
 * parten de un estado visible: si no llegan a correr, el panel se lee igual.
 *
 * Con «reducir movimiento» en el sistema no corre ninguna.
 */

export const sinMovimiento = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } } as const

const entrar = keyframes`from { opacity: .55; transform: translateY(10px) } to { opacity: 1; transform: none }`
export const trazar = keyframes`from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 }`
/** Hasta `--hasta` (0 = entero): así se llena solo hasta el punto de hoy. */
export const llenarTrazo = keyframes`from { stroke-dashoffset: 1 } to { stroke-dashoffset: var(--hasta) }`
export const aparecerSuave = keyframes`from { opacity: 0 } to { opacity: 1 }`
export const crecerY = keyframes`from { transform: scaleY(0) } to { transform: scaleY(1) }`
export const crecerX = keyframes`from { transform: scaleX(0) } to { transform: scaleX(1) }`
export const aparecer = keyframes`from { transform: scale(.3); opacity: .2 } to { transform: scale(1); opacity: 1 }`
export const acercar = keyframes`from { transform: scale(1) } to { transform: scale(1.07) }`
/** Un cirio que se prende: del color apagado al encendido. */
export const encender = keyframes`from { background-color: var(--apagado) } to { background-color: var(--encendido) }`
export const latido = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(227, 73, 72, .45) }
  60% { box-shadow: 0 0 0 7px rgba(227, 73, 72, 0) }
`

/**
 * Entrada escalonada de una pieza: `orden` la retrasa 70 ms por puesto.
 * `y` encadena otra animación que siga después (el vaivén del resplandor).
 */
export const entrada = (orden = 0, y?: string) => ({
  animation: `${entrar} .6s cubic-bezier(.2, .7, .2, 1) backwards${y ? `, ${y}` : ''}`,
  animationDelay: `${orden * 70}ms${y ? ', 0s' : ''}`,
  ...sinMovimiento,
})

/**
 * ¿Hay que animar? Solo cuando el sistema dice expresamente que no se ha pedido
 * reducir el movimiento. Donde no se sabe (los tests, navegadores sin
 * matchMedia) no se anima y se enseña el valor final desde el principio.
 */
export function puedeAnimar(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: no-preference)').matches
}

/** La cifra, contando desde cero hasta `valor` (con frenada al final). */
export function useCuenta(valor: number, duracion = 1400): number {
  const [animar] = useState(puedeAnimar)
  const [actual, setActual] = useState(0)

  useEffect(() => {
    if (!animar) return
    let marco = 0
    const inicio = performance.now()
    const paso = (ahora: number) => {
      const p = Math.min(1, (ahora - inicio) / duracion)
      setActual(valor * (1 - Math.pow(1 - p, 3)))
      if (p < 1) marco = requestAnimationFrame(paso)
    }
    marco = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(marco)
  }, [animar, valor, duracion])

  return animar ? actual : valor
}
