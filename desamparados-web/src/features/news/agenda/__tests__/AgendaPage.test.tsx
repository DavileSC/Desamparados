import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import AgendaPage from '../AgendaPage'

const evento = {
  id: 1, title: 'Besapiés', description: null, location: 'Parroquia',
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

describe('AgendaPage', () => {
  it('pinta los eventos que llegan en data y ofrece pasar de página', async () => {
    const simulado = responder([evento], { total: 45, page: 1, limit: 20, totalPages: 3 })
    renderWithProviders(<AgendaPage />)

    expect(await screen.findByText(/besapiés/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
    expect(String(simulado.mock.calls[0]?.[0])).toContain('/events?')
  })

  it('pide la página que dice la URL', async () => {
    const simulado = responder([], { total: 60, page: 2, limit: 20, totalPages: 3 })
    renderWithProviders(<AgendaPage />, { ruta: '/actualidad/agenda?pagina=2' })

    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })
})
