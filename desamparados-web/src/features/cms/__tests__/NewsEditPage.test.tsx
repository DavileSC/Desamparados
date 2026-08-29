import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import cmsTheme from '../../../theme/cms'
import NewsEditPage from '../NewsEditPage'

const noticia = {
  id: 7, slug: 'apertura-curso-cofrade', titulo: 'Apertura del curso cofrade 2026-2027',
  extracto: 'El Grupo Parroquial abre el nuevo curso.', contenido: '<p>Texto</p>',
  imagenUrl: null, visible: true, fecha: '2026-08-26T00:00:00.000Z',
}

afterEach(() => { vi.unstubAllGlobals() })

function montar(id = 7) {
  // La lectura por id pasa por el archivo del CMS, que es la única vista del
  // servidor que incluye los borradores.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: [noticia], meta: { total: 1, page: 1, limit: 50, lastPage: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ))
  const router = createMemoryRouter(
    [
      { path: '/cms/noticias', element: <h1>Archivo editorial</h1> },
      { path: '/cms/noticias/:id/editar', element: <NewsEditPage /> },
    ],
    { initialEntries: [`/cms/noticias/${id}/editar`] },
  )
  return render(<HelmetProvider><ThemeProvider theme={cmsTheme}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
}

describe('NewsEditPage', () => {
  it('carga la noticia en el formulario, sin el archivo detrás', async () => {
    montar()
    expect(await screen.findByDisplayValue('Apertura del curso cofrade 2026-2027')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /archivo editorial/i })).not.toBeInTheDocument()
  })

  it('explica el fallo si la noticia no existe', async () => {
    montar(999)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })
})
