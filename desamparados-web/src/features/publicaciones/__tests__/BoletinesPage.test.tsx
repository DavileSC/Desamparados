import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BoletinesPage from '../BoletinesPage'
import { precargarBloques } from '../../../test/bloques'
import { stubFetchPublico } from '../../../test/fetchPublico'

// La página es de bloques y el listado se descarga aparte: aquí se mira lo que pinta.
beforeAll(async () => { await precargarBloques() })

const boletin = {
  id: 4, titulo: 'Boletín 2026', descripcion: 'Revista anual del Grupo Parroquial.', imagenUrl: null,
  archivoUrl: '/storage/boletin-2026.pdf', fecha: '2026-03-01T00:00:00.000Z',
  categoria: 'boletin', visible: true,
}

function responder(data: unknown[], meta: Record<string, number>) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data, meta }), { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  stubFetchPublico(simulado)
  return simulado
}

afterEach(() => { vi.unstubAllGlobals() })

describe('BoletinesPage', () => {
  it('pinta los boletines que llegan en data y ofrece pasar de página', async () => {
    const simulado = responder([boletin], { total: 45, page: 1, limit: 20, totalPages: 3 })
    renderWithProviders(<BoletinesPage />)

    expect(await screen.findByRole('heading', { name: 'Boletín 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
    // La categoría no puede perderse al paginar, o la pantalla listaría de todo.
    expect(String(simulado.mock.calls[0]?.[0])).toContain('/publications/category/boletin?')
  })
})
