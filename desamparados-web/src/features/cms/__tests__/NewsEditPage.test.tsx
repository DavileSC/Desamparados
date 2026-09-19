import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TemaCmsProvider } from '../../../app/temaCms'
import NewsEditPage from '../NewsEditPage'

const noticia = {
  id: 7, slug: 'apertura-curso-cofrade', titulo: 'Apertura del curso cofrade 2026-2027',
  extracto: 'El Grupo Parroquial abre el nuevo curso.', contenido: '<p>Texto</p>',
  imagenUrl: null, visible: true, fecha: '2026-08-26T00:00:00.000Z',
}
const borrador = { ...noticia, id: 9, slug: 'cultos-octubre', titulo: 'Cultos de octubre', visible: false }

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

/** El listado de verdad no hace falta: basta con ver que se vuelve a él y con qué aviso. */
function Listado() {
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso
  return <><h1>Archivo editorial</h1>{aviso && <p>{aviso}</p>}</>
}

function montar(ruta: string) {
  // La lectura por id pide la noticia suelta al servidor (GET /news/admin/:id),
  // ya no el archivo completo para buscar dentro con un .find(). Lo que se
  // guarda (POST o PUT) devuelve lo mismo que se manda.
  const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' || init?.method === 'PUT') return Promise.resolve(json({ id: 1, ...JSON.parse(String(init.body)) }))
    const id = Number(String(url).match(/\/news\/admin\/(\d+)/)?.[1])
    const encontrada = [noticia, borrador].find((n) => n.id === id)
    return Promise.resolve(encontrada ? json(encontrada) : json({ error: 'Noticia no encontrada' }, 404))
  })
  vi.stubGlobal('fetch', simulado)
  const router = createMemoryRouter(
    [
      { path: '/cms/noticias', element: <Listado /> },
      { path: '/cms/noticias/nueva', element: <NewsEditPage /> },
      { path: '/cms/noticias/:id/editar', element: <NewsEditPage /> },
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

describe('NewsEditPage', () => {
  it('carga la noticia en el formulario, sin el archivo detrás', async () => {
    montar('/cms/noticias/7/editar')
    expect(await screen.findByDisplayValue('Apertura del curso cofrade 2026-2027')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /archivo editorial/i })).not.toBeInTheDocument()
  })

  it('explica el fallo si la noticia no existe', async () => {
    montar('/cms/noticias/999/editar')
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })

  it('una publicada dice dónde verla y su dirección ya no se puede cambiar', async () => {
    montar('/cms/noticias/7/editar')
    expect(await screen.findByRole('link', { name: /ver en la web/i })).toHaveAttribute('href', '/actualidad/noticias/apertura-curso-cofrade')
    expect(screen.getByText('/actualidad/noticias/apertura-curso-cofrade')).toBeInTheDocument()
    expect(screen.queryByLabelText(/dirección/i)).not.toBeInTheDocument()
  })
})

describe('una noticia nueva', () => {
  it('se crea en la misma ficha, vacía y sin guardar', async () => {
    montar('/cms/noticias/nueva')
    expect(await screen.findByRole('heading', { level: 1, name: 'Nueva noticia' })).toBeInTheDocument()
    expect(screen.getByText('Sin guardar todavía')).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('')
    expect(screen.getByText('Le faltan el título, el extracto, el texto y la foto')).toBeInTheDocument()
  })

  it('sin título no se guarda, y sin texto no se publica', async () => {
    const user = userEvent.setup()
    montar('/cms/noticias/nueva')
    const guardarBorrador = await screen.findByRole('button', { name: 'Guardar borrador' })
    const publicar = screen.getByRole('button', { name: 'Publicar' })
    expect(guardarBorrador).toBeDisabled()
    expect(publicar).toBeDisabled()

    await user.type(screen.getByLabelText('Título'), 'Cultos de noviembre')
    expect(guardarBorrador).toBeEnabled()
    expect(publicar).toBeDisabled()
  })

  it('«Guardar borrador» la crea oculta, sin preguntar, y vuelve al listado', async () => {
    const user = userEvent.setup()
    const simulado = montar('/cms/noticias/nueva')
    await user.type(await screen.findByLabelText('Título'), 'Cultos de noviembre')
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(await screen.findByText(/borrador guardado/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const peticion = guardado(simulado)!
    expect(peticion.metodo).toBe('POST')
    expect(peticion.cuerpo).toMatchObject({ titulo: 'Cultos de noviembre', visible: false })
    // Sin tocar la fecha, la pone el servidor con su hora: así se respeta el orden del día.
    expect(peticion.cuerpo).not.toHaveProperty('fecha')
    // El editor vacío no puede ir vacío: el esquema pide contenido.
    expect(peticion.cuerpo.contenido).toBe('<p></p>')
  })

  it('la dirección se escribe solo con lo que admite el servidor', async () => {
    const user = userEvent.setup()
    montar('/cms/noticias/nueva')
    const direccion = await screen.findByLabelText(/dirección/i)
    await user.type(direccion, 'Cultos Nov ¡2026!')
    expect(direccion).toHaveValue('cultos-nov-2026')
  })
})

describe('publicar y retirar', () => {
  it('«Publicar» un borrador pregunta antes y lo deja visible', async () => {
    const user = userEvent.setup()
    const simulado = montar('/cms/noticias/9/editar')
    await user.click(await screen.findByRole('button', { name: 'Publicar' }))

    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveTextContent('¿Publicar la noticia?')
    expect(guardado(simulado)).toBeNull()

    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(guardado(simulado)).not.toBeNull())
    const peticion = guardado(simulado)!
    expect(peticion).toMatchObject({ metodo: 'PUT', cuerpo: { visible: true } })
    expect(peticion.url).toMatch(/\/news\/9$/)
    expect(await screen.findByText(/noticia publicada/i)).toBeInTheDocument()
  })

  it('«Pasar a borrador» una publicada pregunta antes y la oculta', async () => {
    const user = userEvent.setup()
    const simulado = montar('/cms/noticias/7/editar')
    await user.click(await screen.findByRole('button', { name: 'Pasar a borrador' }))
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveTextContent('Dejará de verse en la web')

    await user.click(within(dialogo).getByRole('button', { name: 'Pasar a borrador' }))
    await waitFor(() => expect(guardado(simulado)).toMatchObject({ metodo: 'PUT', cuerpo: { visible: false } }))
    expect(await screen.findByText(/pasada a borrador/i)).toBeInTheDocument()
  })

  it('quien se arrepiente de publicar no cambia nada', async () => {
    const user = userEvent.setup()
    const simulado = montar('/cms/noticias/9/editar')
    await user.click(await screen.findByRole('button', { name: 'Publicar' }))
    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(guardado(simulado)).toBeNull()
  })

  it('una publicada sin cambios no tiene nada que guardar', async () => {
    const user = userEvent.setup()
    montar('/cms/noticias/7/editar')
    const guardar = await screen.findByRole('button', { name: 'Guardar cambios' })
    expect(guardar).toBeDisabled()
    await user.type(screen.getByLabelText('Extracto'), ' Con misa.')
    expect(guardar).toBeEnabled()
  })
})

describe('el cuerpo se escribe con formato, no con etiquetas', () => {
  it('ya no hay un campo «Contenido HTML»: hay un editor con sus botones', async () => {
    montar('/cms/noticias/7/editar')

    expect(await screen.findByDisplayValue('Apertura del curso cofrade 2026-2027')).toBeInTheDocument()
    expect(screen.queryByLabelText(/contenido html/i)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /contenido/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Negrita' })).toBeInTheDocument()
  })
})
