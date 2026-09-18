import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import AgendaPage from '../AgendaPage'
import { stubFetchPublico } from '../../../../test/fetchPublico'

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
  stubFetchPublico(simulado)
  return simulado
}

afterEach(() => {
  vi.unstubAllGlobals()
  // La agenda parte del tamaño guardado en sessionStorage (lo escribe el
  // selector del CMS): sin limpiarlo, un test heredaría el de otro.
  window.sessionStorage.clear()
})

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

  it('el visitante no ve el selector de resultados por página', async () => {
    // Es una herramienta del CMS (la cadena selector → limit se prueba en
    // AgendaAdminPage); en la agenda pública solo estorba.
    responder([evento], { total: 45, page: 1, limit: 20, totalPages: 3 })
    renderWithProviders(<AgendaPage />)

    expect(await screen.findByText(/besapiés/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/resultados por página/i)).not.toBeInTheDocument()
  })
})

describe('AgendaPage: el error de una página no se queda pegado', () => {
  it('vuelve a pintar los eventos cuando la siguiente carga va bien', async () => {
    // Con el efecto atado a [pagina, porPagina], un fallo pasajero al pasar de
    // página dejaba `error` puesto para siempre: la rejilla está condicionada a
    // !error, así que el visitante veía el paginador, una alerta y ni un solo
    // evento hasta recargar a mano.
    vi.stubGlobal('scrollTo', vi.fn()) // jsdom no implementa el scroll suave
    stubFetchPublico(vi.fn().mockImplementation((url: RequestInfo | URL) =>
      Promise.resolve(String(url).includes('page=2')
        ? new Response(JSON.stringify({ message: 'La agenda no responde.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
        : new Response(
          JSON.stringify({ data: [evento], meta: { total: 45, page: 1, limit: 20, totalPages: 3 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ))))
    const usuario = userEvent.setup()
    renderWithProviders(<AgendaPage />)

    expect(await screen.findByText(/besapiés/i)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /ir a la página 2/i }))
    expect(await screen.findByText(/la agenda no responde/i)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /ir a la página 1/i }))
    expect(await screen.findByText(/besapiés/i)).toBeInTheDocument()
    expect(screen.queryByText(/la agenda no responde/i)).not.toBeInTheDocument()
  })
})
