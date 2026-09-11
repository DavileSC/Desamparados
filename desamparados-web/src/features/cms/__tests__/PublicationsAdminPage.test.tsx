import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import PublicationsAdminPage from '../PublicationsAdminPage'

const publicacion = {
  id: 4, titulo: 'Boletín 2026', descripcion: 'Revista anual del Grupo Parroquial.', imagenUrl: null,
  archivoUrl: '/storage/boletin-2026.pdf', fecha: '2026-03-01T00:00:00.000Z',
  categoria: 'boletin', visible: true,
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

describe('PublicationsAdminPage', () => {
  it('pinta las publicaciones que llegan en data y ofrece pasar de página', async () => {
    responder([publicacion], { total: 45, page: 1, limit: 20, totalPages: 3 })
    renderWithProviders(<PublicationsAdminPage />)

    expect(await screen.findByRole('heading', { name: 'Boletín 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /editar boletín 2026/i })).toHaveAttribute('href', '/cms/publicaciones/4/editar')
  })

  it('al entrar no hay formulario: el alta está detrás del botón', async () => {
    responder([publicacion], { total: 1, page: 1, limit: 20, totalPages: 1 })
    renderWithProviders(<PublicationsAdminPage />)

    expect(await screen.findByRole('heading', { name: 'Boletín 2026' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/url del archivo pdf/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nueva publicación/i })).toBeInTheDocument()
  })

  it('la nueva publicación sube su portada con un botón en vez de pedir una URL', async () => {
    const user = userEvent.setup()
    responder([publicacion], { total: 1, page: 1, limit: 20, totalPages: 1 })
    renderWithProviders(<PublicationsAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nueva publicación/i }))
    const portada = within(screen.getByRole('dialog', { name: /nueva publicación/i })).getByRole('group', { name: /portada/i })
    expect(within(portada).getByLabelText(/subir foto/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/url de imagen/i)).not.toBeInTheDocument()
  })

  it('la nueva publicación sube su PDF con un botón y no se puede guardar sin él', async () => {
    const user = userEvent.setup()
    responder([publicacion], { total: 1, page: 1, limit: 20, totalPages: 1 })
    renderWithProviders(<PublicationsAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nueva publicación/i }))
    const ventana = screen.getByRole('dialog', { name: /nueva publicación/i })
    const pdf = within(ventana).getByRole('group', { name: /archivo pdf/i })
    expect(within(pdf).getByLabelText(/subir pdf/i)).toBeInTheDocument()

    await user.type(within(ventana).getByLabelText('Título'), 'Boletín 2027')
    expect(within(ventana).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('pide la página que dice la URL', async () => {
    const simulado = responder([], { total: 60, page: 2, limit: 20, totalPages: 3 })
    renderWithProviders(<PublicationsAdminPage />, { ruta: '/cms/publicaciones?pagina=2' })

    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })
})
