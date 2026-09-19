import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloqueTarjetas from '../BloqueTarjetas'

const tarjetas = (n: number) => Array.from({ length: n }, (_, i) => ({ titulo: `Tarjeta ${i + 1}`, descripcion: 'Texto.', enlace: '' }))
/** La celda de la rejilla que envuelve cada tarjeta, con las clases de columnas de MUI. */
const celdas = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.closest('.MuiGrid-root')!.className)

describe('BloqueTarjetas', () => {
  it('dos tarjetas se reparten la fila a medias, sin dejar un tercio vacío', () => {
    renderWithProviders(<BloqueTarjetas bloque={{ tipo: 'tarjetas', titulo: '', tarjetas: tarjetas(2) }} />)
    for (const clases of celdas()) {
      expect(clases).toContain('grid-md-6')
      expect(clases).not.toContain('grid-lg-4')
    }
  })

  it('tres o más van de tres en tres, y una sola ocupa la fila', () => {
    const { unmount } = renderWithProviders(<BloqueTarjetas bloque={{ tipo: 'tarjetas', titulo: '', tarjetas: tarjetas(5) }} />)
    for (const clases of celdas()) expect(clases).toContain('grid-lg-4')
    unmount()

    renderWithProviders(<BloqueTarjetas bloque={{ tipo: 'tarjetas', titulo: '', tarjetas: tarjetas(1) }} />)
    expect(celdas()[0]).toContain('grid-xs-12')
    expect(celdas()[0]).not.toContain('grid-md-6')
  })
})
