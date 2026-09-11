import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import cmsTheme from '../../../theme/cms'
import PublicationEditPage from '../PublicationEditPage'

const publicacion = {
  id: 12, titulo: 'Boletín informativo n.º 12', descripcion: 'Crónica del curso.',
  imagenUrl: '/storage/public/boletin-12.jpg', archivoUrl: '/storage/public/boletin-12.pdf',
  fecha: '2026-08-21T00:00:00.000Z', categoria: 'boletin', visible: true,
}

afterEach(() => { vi.unstubAllGlobals() })

function montar() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(publicacion), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ))
  const router = createMemoryRouter(
    [
      { path: '/cms/publicaciones', element: <h1>Publicaciones</h1> },
      { path: '/cms/publicaciones/:id/editar', element: <PublicationEditPage /> },
    ],
    { initialEntries: ['/cms/publicaciones/12/editar'] },
  )
  return render(<HelmetProvider><ThemeProvider theme={cmsTheme}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
}

describe('PublicationEditPage', () => {
  it('enseña la portada actual con botones para cambiarla, sin casilla de URL', async () => {
    montar()
    const portada = await screen.findByRole('group', { name: /portada/i })
    expect(within(portada).getByRole('img', { name: /foto actual/i })).toHaveAttribute('src', publicacion.imagenUrl)
    expect(within(portada).getByLabelText(/cambiar foto/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/url de imagen/i)).not.toBeInTheDocument()
  })
})
