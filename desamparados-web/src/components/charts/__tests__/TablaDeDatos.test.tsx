import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import TablaDeDatos from '../TablaDeDatos'

// Las consultas van con `hidden: true`: el contenido vive dentro de un
// `<details>` plegado y jsdom no implementa el plegado igual que un navegador,
// así que comprobar la apertura a golpe de clic sería probar a jsdom, no a
// nuestro componente. Lo que importa es que la tabla esté y diga lo mismo.
describe('TablaDeDatos', () => {
  it('ofrece la tabla detrás de «Ver tabla»', () => {
    renderWithProviders(
      <TablaDeDatos titulo="Censo de hermanos" columnas={['Mes', 'Activos']} filas={[['Enero', 1253]]} />,
    )
    expect(screen.getByText('Ver tabla')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Activos', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '1253', hidden: true })).toBeInTheDocument()
  })

  it('las cifras de la tabla son las mismas que le llegan', () => {
    renderWithProviders(
      <TablaDeDatos titulo="Papeletas" columnas={['Año', 'Total']} filas={[['2025', '604'], ['2026', '612']]} />,
    )
    expect(screen.getByRole('cell', { name: '604', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '612', hidden: true })).toBeInTheDocument()
  })

  it('sin filas no pinta nada: la gráfica ya dice que no hay datos', () => {
    const { container } = renderWithProviders(
      <TablaDeDatos titulo="Vacía" columnas={['Mes', 'Activos']} filas={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
