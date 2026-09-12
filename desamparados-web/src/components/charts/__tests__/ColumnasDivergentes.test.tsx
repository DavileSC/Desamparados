import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import ColumnasDivergentes from '../ColumnasDivergentes'
import { graficasCms } from '../../../theme/cms'

const paleta = graficasCms('claro')
const meses = [
  { mes: '2026-01', arriba: 5, abajo: 1 },
  { mes: '2026-02', arriba: 6, abajo: 3 },
  { mes: '2026-03', arriba: 7, abajo: 3 },
]

describe('ColumnasDivergentes', () => {
  it('lleva leyenda con los totales de cada serie', () => {
    renderWithProviders(
      <ColumnasDivergentes meses={meses} paleta={paleta} etiquetaArriba="Altas" etiquetaAbajo="Bajas" />,
    )
    expect(screen.getByText('Altas')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument() // 5+6+7
    expect(screen.getByText('Bajas')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument() // 1+3+3
  })

  it('pinta el cero y las columnas a sus dos lados', () => {
    const { container } = renderWithProviders(
      <ColumnasDivergentes meses={meses} paleta={paleta} etiquetaArriba="Altas" etiquetaAbajo="Bajas" />,
    )
    expect(container.querySelectorAll('[data-testid="columna-arriba"]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-testid="columna-abajo"]')).toHaveLength(3)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('un mes sin movimiento no pinta columna, pero sigue ocupando su sitio', () => {
    const conHueco = [{ mes: '2026-01', arriba: 0, abajo: 0 }, ...meses]
    const { container } = renderWithProviders(
      <ColumnasDivergentes meses={conHueco} paleta={paleta} etiquetaArriba="Altas" etiquetaAbajo="Bajas" />,
    )
    expect(container.querySelectorAll('[data-testid="columna-arriba"]')).toHaveLength(3)
  })

  it('sin datos lo dice', () => {
    renderWithProviders(
      <ColumnasDivergentes meses={[]} paleta={paleta} etiquetaArriba="Altas" etiquetaAbajo="Bajas" />,
    )
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })
})
