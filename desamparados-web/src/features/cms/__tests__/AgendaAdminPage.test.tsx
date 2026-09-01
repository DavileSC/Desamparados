import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import AgendaAdminPage from '../AgendaAdminPage'

const evento = {
  id: 3, title: 'Besapiés', description: null, location: 'Parroquia',
  startDate: '2026-09-12T18:00:00.000Z', endDate: null, visibility: 'public', type: 'CULTO',
}

/**
 * Una instancia de Response por llamada: `apiFetch` lee el cuerpo con
 * `res.text()` y reutilizar la misma la dejaría consumida en la segunda.
 */
function responder(data: unknown[], meta: Record<string, number>) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data, meta }), { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

afterEach(() => { vi.unstubAllGlobals() })

describe('AgendaAdminPage', () => {
  it('pinta los eventos que llegan en data y ofrece pasar de página', async () => {
    responder([evento], { total: 45, page: 1, limit: 20, totalPages: 3 })
    renderWithProviders(<AgendaAdminPage />)

    expect(await screen.findByRole('heading', { name: 'Besapiés' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /editar besapiés/i })).toHaveAttribute('href', '/cms/agenda/3/editar')
  })

  it('pide la página que dice la URL', async () => {
    const simulado = responder([], { total: 60, page: 2, limit: 20, totalPages: 3 })
    renderWithProviders(<AgendaAdminPage />, { ruta: '/cms/agenda?pagina=2' })

    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })
})
