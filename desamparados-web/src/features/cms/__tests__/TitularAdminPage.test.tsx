import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import TitularAdminPage from '../TitularAdminPage'

const contenido = {
  ceja: 'Sagrada Titular',
  titulo: 'Nuestra Señora de los Desamparados',
  subtitulo: 'Imágenes de la Titular.',
  galeria: [
    { tipo: 'foto', url: '/storage/public/camarin.webp', portada: '', alt: 'La Virgen en su camarín', pie: 'Camarín' },
  ],
}

/** Monta la pantalla con su data router: PantallaEdicion usa useBlocker y lo exige. */
function responder() {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo: init?.body ? JSON.parse(String(init.body)) : null })
    return Promise.resolve(new Response(
      JSON.stringify(init?.method === 'PUT' ? { message: 'Guardado', data: contenido } : contenido),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
  }))
  const router = createMemoryRouter(
    [
      { path: '/cms', element: <h1>Panel</h1> },
      { path: '/cms/titular', element: <TitularAdminPage /> },
    ],
    { initialEntries: ['/cms/titular'] },
  )
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

describe('TitularAdminPage', () => {
  it('carga los medios que ya hay', async () => {
    responder()

    expect(await screen.findByDisplayValue('La Virgen en su camarín')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Imágenes de la Titular.')).toBeInTheDocument()
  })

  it('un vídeo se añade pegando su dirección, no subiendo el fichero', async () => {
    const user = userEvent.setup()
    responder()

    await user.click(await screen.findByRole('button', { name: /añadir vídeo/i }))
    const campos = screen.getAllByLabelText(/dirección del vídeo/i)
    expect(campos).toHaveLength(1)
    expect(campos[0]).toHaveAccessibleDescription(/youtube|vimeo/i)
  })

  it('avisa antes de guardar si un medio se ha quedado sin descripción', async () => {
    const user = userEvent.setup()
    const llamadas = responder()

    await user.clear(await screen.findByDisplayValue('La Virgen en su camarín'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText(/sin descripción/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })

  it('guarda la galería entera de una vez', async () => {
    const user = userEvent.setup()
    const llamadas = responder()

    await user.type(await screen.findByDisplayValue('Imágenes de la Titular.'), ' Y de sus cultos.')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      const envio = llamadas.find((l) => l.metodo === 'PUT')
      expect(envio).toBeDefined()
      expect(envio!.url).toContain('/contenido/titular')
      expect((envio!.cuerpo as { datos: { subtitulo: string } }).datos.subtitulo).toContain('Y de sus cultos.')
    })
  })

  it('se puede quitar un medio', async () => {
    const user = userEvent.setup()
    responder()

    const fila = (await screen.findByDisplayValue('La Virgen en su camarín')).closest('.MuiPaper-root')!
    await user.click(within(fila as HTMLElement).getByRole('button', { name: /quitar el medio/i }))

    expect(screen.queryByDisplayValue('La Virgen en su camarín')).not.toBeInTheDocument()
  })
})
