import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import LineaTemporal from '../LineaTemporal'
import { graficasCms } from '../../../theme/cms'

const paleta = graficasCms('claro')
const puntos = [
  { x: '2025-10', y: 1253 },
  { x: '2026-08', y: 1282 },
  { x: '2026-09', y: 1284 },
]

describe('LineaTemporal', () => {
  it('escribe el primer y el último valor, para no depender del ratón', () => {
    renderWithProviders(<LineaTemporal puntos={puntos} etiqueta="Hermanos activos" paleta={paleta} />)
    expect(screen.getByText('1253')).toBeInTheDocument()
    expect(screen.getByText('1284')).toBeInTheDocument()
  })

  it('describe la serie para quien no ve el dibujo', () => {
    renderWithProviders(<LineaTemporal puntos={puntos} etiqueta="Hermanos activos" paleta={paleta} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(/Hermanos activos: de 1253 a 1284/)
  })

  it('pinta el eje con sus marcas y sus valores', () => {
    const { container } = renderWithProviders(
      <LineaTemporal puntos={puntos} etiqueta="Hermanos activos" paleta={paleta} />,
    )
    expect(container.querySelectorAll('line').length).toBeGreaterThanOrEqual(3)
    // Las marcas son números redondos, no los datos.
    expect(screen.getByText('1240')).toBeInTheDocument()
  })

  it('usa el color que le da el tema, no una constante suya', () => {
    const { container } = renderWithProviders(
      <LineaTemporal puntos={puntos} etiqueta="Hermanos" paleta={graficasCms('oscuro')} />,
    )
    expect(container.querySelector('[data-testid="linea"]')).toHaveAttribute('stroke', graficasCms('oscuro').acento)
  })

  it('formatea los valores si se le pide', () => {
    renderWithProviders(
      <LineaTemporal puntos={puntos} etiqueta="Saldo" paleta={paleta} formatoValor={(v) => `${v} €`} />,
    )
    expect(screen.getByText('1284 €')).toBeInTheDocument()
  })

  it('con una serie vacía lo dice y no revienta', () => {
    renderWithProviders(<LineaTemporal puntos={[]} etiqueta="Hermanos activos" paleta={paleta} />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })

  it('aguanta una serie plana sin dividir por cero', () => {
    const planos = [{ x: 'a', y: 7 }, { x: 'b', y: 7 }]
    const { container } = renderWithProviders(
      <LineaTemporal puntos={planos} etiqueta="Plano" paleta={paleta} />,
    )
    expect(container.querySelector('[data-testid="linea"]')?.getAttribute('d')).not.toContain('NaN')
  })
})
