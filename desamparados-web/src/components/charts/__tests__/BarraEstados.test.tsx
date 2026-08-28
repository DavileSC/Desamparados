import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BarraEstados from '../BarraEstados'

const segmentos = [
  { etiqueta: 'Cobrados', valor: 289, estado: 'ok' as const },
  { etiqueta: 'Pendientes', valor: 41, estado: 'aviso' as const },
  { etiqueta: 'Devueltos', valor: 12, estado: 'error' as const },
]

describe('BarraEstados', () => {
  it('cada estado lleva su etiqueta de texto, no solo color', () => {
    // Requisito de accesibilidad: el ámbar no llega a 3:1 sobre fondo claro,
    // así que el color no puede ser el único portador de la información.
    renderWithProviders(<BarraEstados segmentos={segmentos} />)
    expect(screen.getByText(/cobrados/i)).toBeInTheDocument()
    expect(screen.getByText(/pendientes/i)).toBeInTheDocument()
    expect(screen.getByText(/devueltos/i)).toBeInTheDocument()
  })

  it('se anuncia con el reparto completo', () => {
    renderWithProviders(<BarraEstados segmentos={segmentos} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(/289.*41.*12/)
  })

  it('reparte el ancho en proporción', () => {
    const { container } = renderWithProviders(<BarraEstados segmentos={segmentos} />)
    const trozos = container.querySelectorAll('[data-testid="segmento"]')
    expect(trozos).toHaveLength(3)
    expect(trozos[0]).toHaveStyle({ flexGrow: '289' })
  })

  it('con todo a cero avisa en vez de pintar una barra vacía', () => {
    renderWithProviders(<BarraEstados segmentos={[{ etiqueta: 'Cobrados', valor: 0, estado: 'ok' }]} />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })
})
