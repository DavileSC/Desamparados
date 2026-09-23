import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import TablaDeDatos from '../TablaDeDatos'

// La tabla va fuera de la vista pero en la página: la encuentran los lectores
// de pantalla (y estas consultas) sin pulsar nada.
describe('TablaDeDatos', () => {
  it('deja la tabla para los lectores de pantalla, sin «Ver tabla»', () => {
    renderWithProviders(
      <TablaDeDatos titulo="Censo de hermanos" columnas={['Mes', 'Activos']} filas={[['Enero', 1253]]} />,
    )
    expect(screen.queryByText('Ver tabla')).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Censo de hermanos' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Activos' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '1253' })).toBeInTheDocument()
  })

  it('las cifras de la tabla son las mismas que le llegan', () => {
    renderWithProviders(
      <TablaDeDatos titulo="Papeletas" columnas={['Año', 'Total']} filas={[['2025', '604'], ['2026', '612']]} />,
    )
    expect(screen.getByRole('cell', { name: '604' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '612' })).toBeInTheDocument()
  })

  it('sin filas no pinta nada: la gráfica ya dice que no hay datos', () => {
    const { container } = renderWithProviders(
      <TablaDeDatos titulo="Vacía" columnas={['Mes', 'Activos']} filas={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
