import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import BuscadorPersonas from '../BuscadorPersonas'

const persona = (id: number, nombre: string, enCensoImportado: boolean) => ({
  id, nombre, apellidos: 'Ruiz Montes', fechaNacimiento: '1970-01-01T12:00:00.000Z', numeroHermano: null,
  situacion: 'activo', apuntado: null, enCensoImportado,
})

afterEach(() => { vi.unstubAllGlobals() })

describe('BuscadorPersonas', () => {
  // Una ficha del censo importado no tiene cuenta: el menor colgaría de la
  // de custodia, que no es de nadie. La API rechaza el alta; aquí ni se ofrece.
  it('al buscar tutor no ofrece las fichas del censo importado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify([persona(1, 'Rosa', true), persona(2, 'Antonio', false)]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))))
    renderWithProviders(<BuscadorPersonas etiqueta="Buscar al tutor" salida="sabado-de-pasion" sinCensoImportado onElegir={() => undefined} />)
    await userEvent.setup().type(screen.getByLabelText('Buscar al tutor'), 'Ruiz')
    expect(await screen.findByText('Antonio Ruiz Montes')).toBeInTheDocument()
    expect(screen.queryByText('Rosa Ruiz Montes')).not.toBeInTheDocument()
  })
})
