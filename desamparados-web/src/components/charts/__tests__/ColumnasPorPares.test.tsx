import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import ColumnasPorPares from '../ColumnasPorPares'
import { graficasCms } from '../../../theme/cms'

const paleta = graficasCms('claro')
const puntos = [
  { clave: '2026-01', a: 9800, b: 3100 },
  { clave: '2026-03', a: 3900, b: 9400 },
]
const props = {
  puntos,
  paleta,
  etiquetaA: 'Ingresos',
  etiquetaB: 'Gastos',
  formatoValor: (v: number) => `${v} €`,
  etiquetaX: (c: string) => c.slice(5),
  etiquetaXLarga: (c: string) => `mes ${c.slice(5)}`,
}

describe('ColumnasPorPares', () => {
  it('pinta dos columnas por punto y el eje en euros', () => {
    const { container } = renderWithProviders(<ColumnasPorPares {...props} />)
    expect(container.querySelectorAll('[data-testid="columna"]')).toHaveLength(4)
    expect(screen.getByText('0 €')).toBeInTheDocument()
  })

  it('al pasar el ratón por un mes enseña sus dos cifras', async () => {
    const { container } = renderWithProviders(<ColumnasPorPares {...props} />)
    await userEvent.hover(container.querySelectorAll('[data-testid="zona"]')[1])
    expect(screen.getByText('mes 03')).toBeInTheDocument()
    expect(screen.getByText(/3900 €/)).toBeInTheDocument()
    expect(screen.getByText(/9400 €/)).toBeInTheDocument()
  })

  it('sin pasar el ratón ya se lee el máximo de cada serie', () => {
    renderWithProviders(<ColumnasPorPares {...props} />)
    expect(screen.getByText('9800 €')).toBeInTheDocument()
    expect(screen.getByText('9400 €')).toBeInTheDocument()
  })

  it('sin datos lo dice', () => {
    renderWithProviders(<ColumnasPorPares {...props} puntos={[]} />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })
})
