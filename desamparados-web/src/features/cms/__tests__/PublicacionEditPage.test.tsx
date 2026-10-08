import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { TemaCmsProvider } from '../../../app/temaCms'
import PublicacionEditPage from '../PublicacionEditPage'

const publicacion = {
  id: 12, titulo: 'Boletín informativo n.º 12', descripcion: 'Crónica del curso.',
  imagenUrl: '/storage/public/boletin-12.jpg', archivoUrl: '/storage/public/0123456789abcdef0123456789abcdef.pdf',
  fecha: '2026-08-21T00:00:00.000Z', categoria: 'boletin', visible: true,
}
const borrador = { ...publicacion, id: 9, titulo: 'Dossier de cuaresma', categoria: 'dossier', visible: false }

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

/** El listado de verdad no hace falta: basta con ver que se vuelve a él y con qué aviso. */
function Listado() {
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso
  return <><h1>Listado de publicaciones</h1>{aviso && <p>{aviso}</p>}</>
}

function montar(ruta: string) {
  // Lo que se guarda (POST o PUT) devuelve lo mismo que se manda.
  const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' || init?.method === 'PUT') return Promise.resolve(json({ id: 1, ...JSON.parse(String(init.body)) }))
    const id = Number(String(url).match(/\/publications\/(\d+)/)?.[1])
    const encontrada = [publicacion, borrador].find((p) => p.id === id)
    return Promise.resolve(encontrada ? json(encontrada) : json({ error: 'Publicación no encontrada' }, 404))
  })
  vi.stubGlobal('fetch', simulado)
  const router = createMemoryRouter(
    [
      { path: '/cms/publicaciones', element: <Listado /> },
      { path: '/cms/publicaciones/nueva', element: <PublicacionEditPage /> },
      { path: '/cms/publicaciones/:id/editar', element: <PublicacionEditPage /> },
    ],
    { initialEntries: [ruta] },
  )
  render(<QueryClientProvider client={new QueryClient()}><HelmetProvider><TemaCmsProvider><RouterProvider router={router} /></TemaCmsProvider></HelmetProvider></QueryClientProvider>)
  return simulado
}

/** La última petición que guardó algo: método, dirección y cuerpo. */
function guardado(simulado: ReturnType<typeof montar>) {
  const llamada = simulado.mock.calls.findLast(([, init]) => init?.method === 'POST' || init?.method === 'PUT')
  if (!llamada) return null
  const [url, init] = llamada as [string, RequestInit]
  return { metodo: init.method, url: String(url), cuerpo: JSON.parse(String(init.body)) }
}

describe('PublicacionEditPage', () => {
  it('carga la publicación en la ficha, con la tarjeta tal como sale en la web', async () => {
    montar('/cms/publicaciones/12/editar')
    expect(await screen.findByDisplayValue(publicacion.titulo)).toBeInTheDocument()
    expect(screen.getByTestId('vista-previa-tarjeta')).toHaveTextContent('Crónica del curso.')
    expect(screen.getByText('Lista para publicar')).toBeInTheDocument()
  })

  it('explica el fallo si la publicación no existe', async () => {
    montar('/cms/publicaciones/999/editar')
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })

  it('enseña la portada actual con botones para cambiarla, sin casilla de URL', async () => {
    montar('/cms/publicaciones/12/editar')
    const portada = await screen.findByRole('group', { name: /portada de la publicación/i })
    expect(within(portada).getByRole('img', { name: /foto actual/i })).toHaveAttribute('src', publicacion.imagenUrl)
    expect(within(portada).getByLabelText(/cambiar foto/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/url de imagen/i)).not.toBeInTheDocument()
  })

  it('el PDF se sube con un botón, no se escribe su URL', async () => {
    montar('/cms/publicaciones/12/editar')
    const pdf = await screen.findByRole('group', { name: /lo que se descarga/i })
    expect(within(pdf).getByRole('link', { name: /abrir el pdf/i })).toHaveAttribute('href', publicacion.archivoUrl)
    expect(within(pdf).getByLabelText(/cambiar pdf/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/url del archivo pdf/i)).not.toBeInTheDocument()
  })

  it('sin PDF no se guarda, y dice por qué', async () => {
    const user = userEvent.setup()
    const simulado = montar('/cms/publicaciones/12/editar')
    const pdf = await screen.findByRole('group', { name: /lo que se descarga/i })

    await user.click(within(pdf).getByRole('button', { name: /quitar pdf/i }))
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(screen.getByText('Para guardar hace falta el PDF.')).toBeInTheDocument()
    expect(guardado(simulado)).toBeNull()
  })
})

describe('una publicación nueva', () => {
  it('se crea en la misma ficha, vacía y sin guardar', async () => {
    montar('/cms/publicaciones/nueva')
    expect(await screen.findByRole('heading', { level: 1, name: 'Nueva publicación' })).toBeInTheDocument()
    expect(screen.getByText('Sin guardar todavía')).toBeInTheDocument()
    expect(screen.getByText('Le faltan el título, la descripción, el PDF y la portada')).toBeInTheDocument()
    expect(screen.getByText('Para guardar hace falta el título y el PDF.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled()
  })
})

describe('publicar y retirar', () => {
  it('«Guardar borrador» guarda los cambios oculta, sin preguntar, y vuelve al listado', async () => {
    const user = userEvent.setup()
    const simulado = montar('/cms/publicaciones/9/editar')
    await user.type(await screen.findByLabelText('Descripción'), ' Con el vía crucis.')
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(await screen.findByText(/borrador guardado/i)).toBeInTheDocument()
    expect(guardado(simulado)).toMatchObject({ metodo: 'PUT', cuerpo: { visible: false, descripcion: 'Crónica del curso. Con el vía crucis.' } })
  })

  it('«Publicar» un borrador pregunta antes y lo deja visible', async () => {
    const user = userEvent.setup()
    const simulado = montar('/cms/publicaciones/9/editar')
    await user.click(await screen.findByRole('button', { name: 'Publicar' }))

    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveTextContent('¿Publicarla en la web?')
    expect(guardado(simulado)).toBeNull()

    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(guardado(simulado)).toMatchObject({ metodo: 'PUT', cuerpo: { visible: true } }))
    expect(guardado(simulado)!.url).toMatch(/\/publications\/9$/)
    expect(await screen.findByText(/ya se puede descargar/i)).toBeInTheDocument()
  })

  it('«Pasar a borrador» una publicada pregunta antes y la oculta', async () => {
    const user = userEvent.setup()
    const simulado = montar('/cms/publicaciones/12/editar')
    await user.click(await screen.findByRole('button', { name: 'Pasar a borrador' }))
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveTextContent('Dejará de verse en la web')

    await user.click(within(dialogo).getByRole('button', { name: 'Pasar a borrador' }))
    await waitFor(() => expect(guardado(simulado)).toMatchObject({ metodo: 'PUT', cuerpo: { visible: false } }))
  })

  it('una publicada sin cambios no tiene nada que guardar', async () => {
    const user = userEvent.setup()
    montar('/cms/publicaciones/12/editar')
    const guardar = await screen.findByRole('button', { name: 'Guardar cambios' })
    expect(guardar).toBeDisabled()
    await user.click(screen.getByRole('combobox', { name: 'Tipo' }))
    await user.click(screen.getByRole('option', { name: 'Anuario' }))
    expect(guardar).toBeEnabled()
  })
})
