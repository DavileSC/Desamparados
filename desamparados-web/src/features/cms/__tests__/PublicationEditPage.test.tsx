import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import cmsTheme from '../../../theme/cms'
import PublicationEditPage from '../PublicationEditPage'

const publicacion = {
  id: 12, titulo: 'Boletín informativo n.º 12', descripcion: 'Crónica del curso.',
  imagenUrl: '/storage/public/boletin-12.jpg', archivoUrl: '/storage/public/0123456789abcdef0123456789abcdef.pdf',
  fecha: '2026-08-21T00:00:00.000Z', categoria: 'boletin', visible: true,
}

afterEach(() => { vi.unstubAllGlobals() })

function montar() {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(
    new Response(JSON.stringify(publicacion), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ))
  vi.stubGlobal('fetch', simulado)
  const router = createMemoryRouter(
    [
      { path: '/cms/publicaciones', element: <h1>Publicaciones</h1> },
      { path: '/cms/publicaciones/:id/editar', element: <PublicationEditPage /> },
    ],
    { initialEntries: ['/cms/publicaciones/12/editar'] },
  )
  render(<HelmetProvider><ThemeProvider theme={cmsTheme}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
  return simulado
}

describe('PublicationEditPage', () => {
  it('enseña la portada actual con botones para cambiarla, sin casilla de URL', async () => {
    montar()
    const portada = await screen.findByRole('group', { name: /portada/i })
    expect(within(portada).getByRole('img', { name: /foto actual/i })).toHaveAttribute('src', publicacion.imagenUrl)
    expect(within(portada).getByLabelText(/cambiar foto/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/url de imagen/i)).not.toBeInTheDocument()
  })

  it('el PDF se sube con un botón, no se escribe su URL', async () => {
    montar()
    const pdf = await screen.findByRole('group', { name: /archivo pdf/i })
    expect(within(pdf).getByRole('link', { name: /abrir el pdf/i })).toHaveAttribute('href', publicacion.archivoUrl)
    expect(within(pdf).getByLabelText(/cambiar pdf/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/url del archivo pdf/i)).not.toBeInTheDocument()
  })

  it('sin PDF no se guarda: avisa en vez de mandar una publicación sin descarga', async () => {
    const user = userEvent.setup()
    const simulado = montar()
    const pdf = await screen.findByRole('group', { name: /archivo pdf/i })

    await user.click(within(pdf).getByRole('button', { name: /quitar pdf/i }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText(/falta el pdf de la publicación/i)).toBeInTheDocument()
    expect(simulado.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false)
  })
})
