import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { crearTemaCms } from '../../../theme/cms'
import NewsEditPage from '../NewsEditPage'

const noticia = {
  id: 7, slug: 'apertura-curso-cofrade', titulo: 'Apertura del curso cofrade 2026-2027',
  extracto: 'El Grupo Parroquial abre el nuevo curso.', contenido: '<p>Texto</p>',
  imagenUrl: null, visible: true, fecha: '2026-08-26T00:00:00.000Z',
}

afterEach(() => { vi.unstubAllGlobals() })

function montar(id = 7) {
  // La lectura por id pide la noticia suelta al servidor (GET /news/admin/:id),
  // ya no el archivo completo para buscar dentro con un .find().
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    id === 7
      ? new Response(JSON.stringify(noticia), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response(JSON.stringify({ error: 'Noticia no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
  ))
  const router = createMemoryRouter(
    [
      { path: '/cms/noticias', element: <h1>Archivo editorial</h1> },
      { path: '/cms/noticias/:id/editar', element: <NewsEditPage /> },
    ],
    { initialEntries: [`/cms/noticias/${id}/editar`] },
  )
  return render(<HelmetProvider><ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
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

describe('el cuerpo se escribe con formato, no con etiquetas', () => {
  it('ya no hay un campo «Contenido HTML»: hay un editor con sus botones', async () => {
    montar()

    expect(await screen.findByDisplayValue('Apertura del curso cofrade 2026-2027')).toBeInTheDocument()
    expect(screen.queryByLabelText(/contenido html/i)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /contenido/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Negrita' })).toBeInTheDocument()
  })
})
