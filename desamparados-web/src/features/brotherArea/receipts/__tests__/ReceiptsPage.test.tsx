import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import ReceiptsPage from '../ReceiptsPage'

const familia = {
  id: 7,
  nombre: 'Ana',
  apellidos: 'Pérez Ruiz',
  esTitular: true,
  recibos: [{
    id: 10,
    year: 2026,
    concepto: 'Cuota anual',
    importe: 30,
    fechaEmision: '2026-01-15T00:00:00.000Z',
    fechaPago: null,
    estado: 'PENDIENTE',
  }],
}

/**
 * Una instancia de `Response` por llamada: `apiFetch` lee el cuerpo con
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

describe('ReceiptsPage', () => {
  it('dice cuántos recibos propios hay', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [], meta: { total: 30, page: 1, limit: 20, totalPages: 2 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    renderWithProviders(<ReceiptsPage />)
    expect(await screen.findByText(/de 30/i)).toBeInTheDocument()
  })

  it('pinta los recibos que llegan en data y ofrece pasar de página', async () => {
    const simulado = responder([familia], { total: 45, page: 1, limit: 20, totalPages: 3 })
    renderWithProviders(<ReceiptsPage />)

    expect(await screen.findByText(/cuota anual/i)).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez Ruiz')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
    expect(String(simulado.mock.calls[0]?.[0])).toContain('/recibos/mis-recibos?')
  })

  it('pide la página que dice la URL', async () => {
    const simulado = responder([], { total: 45, page: 2, limit: 20, totalPages: 3 })
    renderWithProviders(<ReceiptsPage />, { ruta: '/area-hermano/recibos?pagina=2' })

    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })
})
