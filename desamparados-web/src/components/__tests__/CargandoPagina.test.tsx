import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CargandoPagina from '../CargandoPagina'

describe('CargandoPagina', () => {
  it('esconde el pie mientras carga y lo devuelve al irse', () => {
    // Se rompe si el pie vuelve a pintarse bajo el cargador: al recargar, la
    // página se bajaba y se quedaba a la vista el pie solo.
    const { rerender } = render(
      <>
        <CargandoPagina />
        <footer data-pie-publico="">Pie</footer>
      </>,
    )
    const pie = document.querySelector('[data-pie-publico]') as HTMLElement
    expect(getComputedStyle(pie).display).toBe('none')

    rerender(<footer data-pie-publico="">Pie</footer>)
    expect(getComputedStyle(document.querySelector('[data-pie-publico]') as HTMLElement).display).not.toBe('none')
  })
})
