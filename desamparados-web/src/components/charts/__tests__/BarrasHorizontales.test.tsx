import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BarrasHorizontales from '../BarrasHorizontales'

const filas = [
  { etiqueta: 'Nazarenos', valor: 168 },
  { etiqueta: 'Hombres de trono', valor: 96 },
  { etiqueta: 'Músicos', valor: 34 },
]

describe('BarrasHorizontales', () => {
  it('enseña cada etiqueta con su cifra', () => {
    renderWithProviders(<BarrasHorizontales filas={filas} />)
    expect(screen.getByText('Nazarenos')).toBeInTheDocument()
    expect(screen.getByText('168')).toBeInTheDocument()
    expect(screen.getByText('Músicos')).toBeInTheDocument()
  })

  it('la barra mayor ocupa todo el ancho y las demás su proporción', () => {
    const { container } = renderWithProviders(<BarrasHorizontales filas={filas} />)
    const barras = container.querySelectorAll('[data-testid="barra"]')
    expect(barras[0]).toHaveStyle({ width: '100%' })
    expect(barras[2]).toHaveStyle({ width: `${(34 / 168) * 100}%` })
  })

  it('con todos los valores a cero no rompe', () => {
    const ceros = [{ etiqueta: 'Nazarenos', valor: 0 }, { etiqueta: 'Músicos', valor: 0 }]
    const { container } = renderWithProviders(<BarrasHorizontales filas={ceros} />)
    const barras = container.querySelectorAll('[data-testid="barra"]')
    expect(barras[0]).toHaveStyle({ width: '0%' })
  })

  it('sin filas avisa en vez de pintar nada', () => {
    renderWithProviders(<BarrasHorizontales filas={[]} />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })
})
