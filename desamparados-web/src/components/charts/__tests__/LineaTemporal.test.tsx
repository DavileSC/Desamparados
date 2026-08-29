import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import LineaTemporal from '../LineaTemporal'

const puntos = [
  { x: '2026-06', y: 338 },
  { x: '2026-07', y: 341 },
  { x: '2026-08', y: 342 },
]

describe('LineaTemporal', () => {
  it('se anuncia con su descripción y el último valor', () => {
    renderWithProviders(<LineaTemporal puntos={puntos} etiqueta="Hermanos activos" />)
    const grafico = screen.getByRole('img', { name: /hermanos activos/i })
    expect(grafico).toBeInTheDocument()
    expect(grafico).toHaveAccessibleName(/342/)
  })

  it('dibuja un trazo con un punto por dato', () => {
    const { container } = renderWithProviders(<LineaTemporal puntos={puntos} etiqueta="Hermanos activos" />)
    const trazo = container.querySelector('path[data-testid="linea"]')
    expect(trazo?.getAttribute('d')?.match(/L|M/g)).toHaveLength(3)
  })

  it('sin datos no pinta el gráfico, avisa', () => {
    // Un Grupo Parroquial recién instalado tiene todo a cero: el gráfico no
    // debe dividir por cero ni pintar un área rota.
    renderWithProviders(<LineaTemporal puntos={[]} etiqueta="Hermanos activos" />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('aguanta que todos los valores sean iguales', () => {
    // Si max === min, la escala vertical se anula: sin protección sale NaN.
    const planos = [{ x: 'a', y: 5 }, { x: 'b', y: 5 }]
    const { container } = renderWithProviders(<LineaTemporal puntos={planos} etiqueta="Plano" />)
    expect(container.querySelector('path[data-testid="linea"]')?.getAttribute('d')).not.toContain('NaN')
  })

  it('con dos series las pinta juntas y pone leyenda', () => {
    // Dos series obligan a leyenda: el color por sí solo no identifica nada
    // para quien no lo distingue.
    const gastos = [{ x: '2026-06', y: 100 }, { x: '2026-07', y: 120 }, { x: '2026-08', y: 90 }]
    const { container } = renderWithProviders(
      <LineaTemporal puntos={puntos} etiqueta="Ingresos" comparar={{ etiqueta: 'Gastos', puntos: gastos }} />,
    )
    expect(container.querySelector('path[data-testid="linea-comparada"]')).toBeTruthy()
    expect(screen.getByText('Ingresos')).toBeInTheDocument()
    expect(screen.getByText('Gastos')).toBeInTheDocument()
    // Cada serie pinta su propio ultimo valor, sin pisarse (aqui quedan a
    // 120px de separacion vertical: nada de solape evidente).
    expect(screen.getByText('342')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('pinta el ultimo valor como texto visible, tambien con una sola serie', () => {
    // El color no puede ser el unico portador del dato: verde y ambar de la
    // paleta no llegan a 3:1 sobre el lienzo claro del CMS.
    renderWithProviders(<LineaTemporal puntos={puntos} etiqueta="Hermanos activos" />)
    expect(screen.getByText('342')).toBeInTheDocument()
  })

  it('las dos series comparten escala', () => {
    // Con escalas distintas, dos líneas que se cruzan no significan nada.
    const bajos = [{ x: '2026-06', y: 1 }, { x: '2026-07', y: 2 }, { x: '2026-08', y: 3 }]
    const { container } = renderWithProviders(
      <LineaTemporal puntos={puntos} etiqueta="Altos" comparar={{ etiqueta: 'Bajos', puntos: bajos }} />,
    )
    // Los valores de la serie baja quedan pegados al suelo (y alta), no repartidos.
    const d = container.querySelector('path[data-testid="linea-comparada"]')!.getAttribute('d')!
    const ys = [...d.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]))
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(5)
  })
})
