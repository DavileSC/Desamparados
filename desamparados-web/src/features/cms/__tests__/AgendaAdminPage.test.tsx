import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

afterEach(() => {
  vi.unstubAllGlobals()
  // `cambiarTamano` recuerda la preferencia en sessionStorage: sin limpiarla, el
  // tamaño elegido en un test sería el de partida del siguiente.
  window.sessionStorage.clear()
})

describe('AgendaAdminPage', () => {
  it('al entrar no hay formulario: «Nuevo evento» abre la ventana de alta', async () => {
    const usuario = userEvent.setup()
    responder([evento], { total: 1, page: 1, limit: 20, totalPages: 1 })
    renderWithProviders(<AgendaAdminPage />)

    expect(await screen.findByRole('heading', { name: 'Besapiés' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/ubicación/i)).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /nuevo evento/i }))
    expect(screen.getByRole('dialog', { name: /nuevo evento/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/ubicación/i)).toBeInTheDocument()
  })

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

  it('el CMS pide su propio listado, el que incluye los eventos pasados', async () => {
    const simulado = responder([evento], { total: 1, page: 1, limit: 20, totalPages: 1 })
    renderWithProviders(<AgendaAdminPage />)

    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('/events/admin?'))
    expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('periodo=proximos')
    expect(screen.getByRole('tab', { name: 'Próximos' })).toHaveAttribute('aria-selected', 'true')
  })

  it('la pestaña «Pasados» pide los pasados desde la primera página', async () => {
    // Un evento fechado por error en el pasado desaparecía del CMS: sin esta
    // pestaña no había forma de corregirlo ni de borrarlo.
    const usuario = userEvent.setup()
    const simulado = responder([evento], { total: 60, page: 2, limit: 20, totalPages: 3 })
    renderWithProviders(<AgendaAdminPage />, { ruta: '/cms/agenda?pagina=2' })
    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('page=2'))

    await usuario.click(screen.getByRole('tab', { name: 'Pasados' }))

    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('periodo=pasados'))
    expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('page=1')
    expect(screen.getByRole('tab', { name: 'Pasados' })).toHaveAttribute('aria-selected', 'true')
  })

  it('con ?periodo=pasados en la URL (al volver de editar) abre esa pestaña', async () => {
    const simulado = responder([], { total: 0, page: 1, limit: 20, totalPages: 0 })
    renderWithProviders(<AgendaAdminPage />, { ruta: '/cms/agenda?periodo=pasados' })

    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('periodo=pasados'))
    expect(await screen.findByText('No hay eventos pasados.')).toBeInTheDocument()
  })

  it('al elegir otro tamaño en el selector, la petición lo lleva como limit', async () => {
    // La cadena entera —abrir el selector, elegir 50, que llegue al servidor
    // como limit=50— no estaba cubierta en ningún punto: el Paginador ya
    // comprueba que avisa, y esto comprueba que el aviso llega a la petición.
    // Vivía en la agenda pública hasta que el selector quedó solo para el CMS.
    const simulado = responder([evento], { total: 45, page: 1, limit: 20, totalPages: 3 })
    const usuario = userEvent.setup()
    renderWithProviders(<AgendaAdminPage />)

    expect(await screen.findByRole('heading', { name: 'Besapiés' })).toBeInTheDocument()
    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('limit=20'))

    await usuario.click(screen.getByLabelText(/resultados por página/i))
    await usuario.click(await screen.findByRole('option', { name: '50' }))

    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('limit=50'))
    // Y la preferencia queda guardada para el resto de la sesión.
    expect(window.sessionStorage.getItem('desamparados:porPagina')).toBe('50')
  })
})
