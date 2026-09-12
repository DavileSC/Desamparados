import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import ColumnasPorAnio from '../ColumnasPorAnio'
import { graficasCms } from '../../../theme/cms'

const paleta = graficasCms('claro')
const datos = [
  { anio: 2022, total: 548 },
  { anio: 2023, total: 571 },
  { anio: 2026, total: 612 },
]

describe('ColumnasPorAnio', () => {
  it('escribe el valor sobre cada columna y el año debajo', () => {
    renderWithProviders(<ColumnasPorAnio datos={datos} paleta={paleta} destacado={2026} />)
    for (const texto of ['548', '571', '612', '2022', '2023', '2026']) {
      expect(screen.getByText(texto)).toBeInTheDocument()
    }
  })

  it('destaca el ejercicio elegido y deja el resto en gris', () => {
    const { container } = renderWithProviders(
      <ColumnasPorAnio datos={datos} paleta={paleta} destacado={2026} />,
    )
    const columnas = container.querySelectorAll('[data-testid="columna"]')
    expect(columnas[2]).toHaveAttribute('fill', paleta.enfasis)
    expect(columnas[0]).toHaveAttribute('fill', paleta.contexto)
  })

  it('si el año destacado no está en los datos, no destaca ninguno', () => {
    const { container } = renderWithProviders(
      <ColumnasPorAnio datos={datos} paleta={paleta} destacado={2019} />,
    )
    const colores = [...container.querySelectorAll('[data-testid="columna"]')].map((c) => c.getAttribute('fill'))
    expect(colores.every((c) => c === paleta.contexto)).toBe(true)
  })

  it('sin datos lo dice', () => {
    renderWithProviders(<ColumnasPorAnio datos={[]} paleta={paleta} destacado={2026} />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })
})
