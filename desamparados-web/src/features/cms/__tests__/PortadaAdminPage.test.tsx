import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import PortadaAdminPage, { MAX_FOTOS_PORTADA } from '../PortadaAdminPage'

const FOTOS = [
  { id: 1, url: '/storage/public/primera.webp', descripcion: 'Primera', orden: 0 },
  { id: 2, url: '/storage/public/segunda.webp', descripcion: 'Segunda', orden: 1 },
]

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

/** Monta la pantalla con la respuesta a la lectura inicial y las que vengan después, en orden. */
function montar(inicial: Response, ...siguientes: Response[]) {
  const fetchMock = vi.fn().mockResolvedValueOnce(inicial)
  for (const r of siguientes) fetchMock.mockResolvedValueOnce(r)
  vi.stubGlobal('fetch', fetchMock)
  // PantallaEdicion usa useBlocker, que exige un data router.
  const router = createMemoryRouter(
    [
      { path: '/cms', element: <h1>Panel</h1> },
      { path: '/cms/portada', element: <PortadaAdminPage /> },
    ],
    { initialEntries: ['/cms/portada'] },
  )
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
  return fetchMock
}

const foto = (numero: number) => screen.getByRole('group', { name: `Foto ${numero}` })

describe('PortadaAdminPage', () => {
  it('carga las fotos en su orden, deja reordenar y quitar, y guarda la lista entera tal y como queda', async () => {
    const fetchMock = montar(respuesta(FOTOS), respuesta({ message: 'ok', data: [] }))
    expect(await screen.findByRole('group', { name: 'Foto 1' })).toBeInTheDocument()
    expect(within(foto(1)).getByRole('img', { name: /foto actual/i })).toHaveAttribute('src', '/storage/public/primera.webp')
    expect(screen.getByRole('button', { name: /subir la foto 1/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /bajar la foto 1/i }))
    expect(within(foto(1)).getByRole('img')).toHaveAttribute('src', '/storage/public/segunda.webp')
    expect(within(foto(2)).getByRole('img')).toHaveAttribute('src', '/storage/public/primera.webp')

    await userEvent.click(within(foto(2)).getByRole('button', { name: /quitar foto/i }))
    expect(screen.queryByRole('group', { name: 'Foto 2' })).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/descripción para lectores de pantalla/i), ' de noche')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toMatch(/\/portada\/imagenes$/)
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({
      imagenes: [{ url: '/storage/public/segunda.webp', descripcion: 'Segunda de noche' }],
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(/fotos guardadas/i)
  })

  it('la foto que se sube se añade al final de la lista', async () => {
    montar(respuesta(FOTOS), respuesta({ data: { url: 'http://localhost:3001/storage/public/nueva.webp', filename: 'nueva.webp' } }, 201))
    await screen.findByRole('group', { name: 'Foto 1' })

    const anadir = screen.getByRole('group', { name: /añadir una foto/i })
    await userEvent.upload(within(anadir).getByLabelText(/subir foto/i), new File(['x'], 'nueva.webp', { type: 'image/webp' }))

    expect(await screen.findByRole('group', { name: 'Foto 3' })).toBeInTheDocument()
    expect(within(foto(3)).getByRole('img')).toHaveAttribute('src', '/storage/public/nueva.webp')
    // Y el control de añadir queda libre para la siguiente.
    expect(within(anadir).queryByRole('img')).not.toBeInTheDocument()
  })

  it('con el máximo de fotos ya no ofrece añadir más', async () => {
    const llenas = Array.from({ length: MAX_FOTOS_PORTADA }, (_, i) => ({ id: i, url: `/storage/public/${i}.webp`, descripcion: '', orden: i }))
    montar(respuesta(llenas))
    await screen.findByRole('group', { name: `Foto ${MAX_FOTOS_PORTADA}` })
    expect(screen.queryByRole('group', { name: /añadir una foto/i })).not.toBeInTheDocument()
    expect(screen.getByText(/el máximo/i)).toBeInTheDocument()
  })

  it('sin fotos explica que se usa la de siempre y ofrece añadir', async () => {
    montar(respuesta([]))
    expect(await screen.findByRole('group', { name: /añadir una foto/i })).toBeInTheDocument()
    expect(screen.getByText(/la foto de siempre/i)).toBeInTheDocument()
  })

  it('explica el fallo si la lista no se puede cargar', async () => {
    montar(respuesta({ error: 'caído' }, 500))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se han podido cargar/i)
  })
})
