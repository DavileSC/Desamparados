import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import IncidenciasDePago from '../IncidenciasDePago'

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
const INCIDENCIA = { id: 7, pedido: '00000042AB7Z', fecha: '2026-10-02T10:00:00.000Z', importe: 30, metodo: 'TARJETA', autorizacion: '654321', motivo: 'No se pudo aplicar el pago: «Cuota 2026» no está pendiente de pago.', correo: 'hermano@example.com' }

afterEach(() => { vi.unstubAllGlobals() })

describe('IncidenciasDePago', () => {
  it('sin incidencias no enseña nada', async () => {
    const fetch = vi.fn().mockResolvedValue(json([]))
    vi.stubGlobal('fetch', fetch)
    const { container } = renderWithProviders(<IncidenciasDePago />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('enseña lo que hay que devolver y lo marca como devuelto', async () => {
    const user = userEvent.setup()
    let pendientes = [INCIDENCIA]
    const fetch = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => {
      if (init.method === 'POST') { pendientes = []; return Promise.resolve(json({ message: 'ok' })) }
      return Promise.resolve(json(pendientes))
    })
    vi.stubGlobal('fetch', fetch)
    renderWithProviders(<IncidenciasDePago />)

    expect(await screen.findByText('Un pago en línea por devolver')).toBeInTheDocument()
    expect(screen.getByText(/pedido 00000042AB7Z · autorización 654321/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Devuelto' }))
    await waitFor(() => expect(screen.queryByText('Un pago en línea por devolver')).not.toBeInTheDocument())
    expect(fetch.mock.calls.some(([url, init]) => String(url).includes('/incidencias/7/resolver') && (init as RequestInit).method === 'POST')).toBe(true)
  })
})
