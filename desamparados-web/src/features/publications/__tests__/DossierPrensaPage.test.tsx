import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import DossierPrensaPage from '../DossierPrensaPage'

const dossier = {
  id: 9, titulo: 'Dossier de prensa 2026', descripcion: 'Apariciones en medios locales.', imagenUrl: null,
  archivoUrl: '/storage/dossier-2026.pdf', fecha: '2026-02-10T00:00:00.000Z',
  categoria: 'dossier', visible: true,
}

function responder(data: unknown[], meta: Record<string, number>) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data, meta }), { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

afterEach(() => { vi.unstubAllGlobals() })

describe('DossierPrensaPage', () => {
  it('pinta los dossieres que llegan en data y ofrece pasar de página', async () => {
    const simulado = responder([dossier], { total: 45, page: 1, limit: 20, totalPages: 3 })
    renderWithProviders(<DossierPrensaPage />)

    expect(await screen.findByRole('heading', { name: 'Dossier de prensa 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
    // La categoría no puede perderse al paginar, o la pantalla listaría de todo.
    expect(String(simulado.mock.calls[0]?.[0])).toContain('/publications/category/dossier?')
  })
})
