import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import TreasuryAdminPage from '../TreasuryAdminPage'

function responder(total: number) {
  // mockImplementation, no mockResolvedValue: esta pantalla llama a fetch más
  // de una vez (carga inicial y al cambiar de año), y compartir una única
  // instancia de Response rompería el segundo `.text()` con la Fetch API real
  // (el cuerpo solo se puede leer una vez).
  return vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data: [], meta: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('TreasuryAdminPage', () => {
  it('dice cuántos recibos hay en total, no cuántos se ven', async () => {
    // 1.167 recibos y una pantalla que enseñaba 200 sin decirlo.
    vi.stubGlobal('fetch', responder(1167))
    renderWithProviders(<TreasuryAdminPage />)
    expect(await screen.findByText(/de 1167/i)).toBeInTheDocument()
  })

  it('cambiar de año vuelve a la primera página', async () => {
    const user = userEvent.setup()
    const fetchSimulado = responder(1167)
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<TreasuryAdminPage />, { ruta: '/cms/tesoreria?pagina=4' })

    await user.clear(screen.getByLabelText(/año/i))
    await user.type(screen.getByLabelText(/año/i), '2025')

    await waitFor(() => {
      const ultima = String(fetchSimulado.mock.calls.at(-1)?.[0])
      expect(ultima).toContain('page=1')
      expect(ultima).toContain('year=2025')
    })
  })
})
