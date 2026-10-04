import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import CifrasQueRuedan from '../CifrasQueRuedan'

describe('CifrasQueRuedan', () => {
  it('cada cifra es una tira que se desplaza hasta la suya; lo demás va tal cual', () => {
    const { container } = render(<CifrasQueRuedan texto="16,50 €" />)
    const tiras = [...container.querySelectorAll('[aria-hidden] > span > span')].filter((t) => t.childElementCount === 10)
    expect(tiras.map((t) => getComputedStyle(t).transform)).toEqual(['translateY(-1em)', 'translateY(-6em)', 'translateY(-5em)', 'translateY(0em)'])
    expect(container.querySelector('[aria-hidden]')?.textContent).toContain(',')
  })

  it('al lector de pantalla le llega el texto entero, una sola vez', () => {
    const { container } = render(<CifrasQueRuedan texto="(7)" />)
    const visible = [...container.querySelectorAll('span')].find((s) => !s.closest('[aria-hidden]') && s.textContent === '(7)')
    expect(visible).toBeDefined()
  })

  it('al pasar de 9 a 10, la cifra de las unidades sigue siendo la misma y rueda', () => {
    const { container, rerender } = render(<CifrasQueRuedan texto="9" />)
    const unidades = container.querySelector('[aria-hidden] > span')
    rerender(<CifrasQueRuedan texto="10" />)
    const cifras = container.querySelectorAll('[aria-hidden] > span')
    expect(cifras).toHaveLength(2)
    expect(cifras[1]).toBe(unidades)
  })
})
