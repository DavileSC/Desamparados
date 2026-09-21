import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import { TemaCmsProvider } from '../../../app/temaCms'
import NoticiasAdminPage from '../NoticiasAdminPage'

const noticia = {
  id: 7, slug: 'apertura-curso-cofrade', titulo: 'Apertura del curso cofrade 2026-2027',
  extracto: 'El Grupo Parroquial abre el nuevo curso.', contenido: '<p>Texto</p>',
  imagenUrl: '/storage/public/apertura.jpg', visible: true, fijada: false, fecha: '2026-08-26T00:00:00.000Z',
}
const antigua = { ...noticia, id: 5, slug: 'besamanos', titulo: 'Besamanos de septiembre', imagenUrl: null, fecha: '2026-08-01T00:00:00.000Z' }
const borrador = {
  ...noticia, id: 9, slug: 'cultos-octubre', titulo: 'Cultos de octubre', extracto: '', imagenUrl: null,
  visible: false, fecha: '2026-09-14T00:00:00.000Z', updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
}

const resumen = (portada: number[] = [7], limite = 1, fijada: number | null = null) => ({ publicadas: 2, borradores: 1, incompletas: 2, ultimaPublicacion: '2026-08-26T00:00:00.000Z', portada: { limite, ids: portada, fijada } })

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const listado = (items: unknown[], extra = {}) => json({ data: items, meta: { total: items.length, page: 1, limit: 20, totalPages: 1 }, resumen: resumen(), ...extra })

function responder(items: unknown[], extra = {}) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(listado(items, extra)))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

const montar = (ruta = '/cms/noticias') => renderWithProviders(<TemaCmsProvider><NoticiasAdminPage /></TemaCmsProvider>, { ruta })

afterEach(() => { vi.unstubAllGlobals() })

describe('NoticiasAdminPage', () => {
  it('antes de borrar pregunta, y dice qué se va a borrar', async () => {
    const user = userEvent.setup()
    responder([noticia])
    montar()
    await user.click(await screen.findByRole('button', { name: /más acciones para apertura/i }))
    await user.click(screen.getByRole('menuitem', { name: /eliminar/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Apertura del curso cofrade 2026-2027')
  })

  it('quien cancela no borra nada', async () => {
    const user = userEvent.setup()
    responder([noticia])
    montar()
    await user.click(await screen.findByRole('button', { name: /más acciones para apertura/i }))
    await user.click(screen.getByRole('menuitem', { name: /eliminar/i }))

    const llamadas = vi.fn()
    vi.stubGlobal('fetch', llamadas)
    await user.click(screen.getByRole('button', { name: 'Volver' }))

    expect(llamadas).not.toHaveBeenCalled()
    // El diálogo de MUI se va con una transición: sigue en el DOM un instante.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('editar lleva a la ficha de la noticia', async () => {
    responder([noticia])
    montar()
    const editar = await screen.findByRole('link', { name: /editar apertura/i })
    expect(editar).toHaveAttribute('href', '/cms/noticias/7/editar')
  })

  it('crear lleva a una ficha nueva, no a una ventana', async () => {
    responder([noticia])
    montar()

    expect(await screen.findByRole('heading', { name: noticia.titulo })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /nueva noticia/i })).toHaveAttribute('href', '/cms/noticias/nueva')
    expect(screen.queryByRole('textbox', { name: /contenido de la noticia/i })).not.toBeInTheDocument()
  })

  it('los borradores van aparte, arriba, y dicen qué les falta', async () => {
    responder([borrador, noticia])
    montar()

    const enPreparacion = (await screen.findByRole('heading', { name: /en preparación/i })).closest('section')!
    expect(within(enPreparacion).getByRole('heading', { name: 'Cultos de octubre' })).toBeInTheDocument()
    expect(enPreparacion).toHaveTextContent('Le faltan el extracto y la foto')
    expect(enPreparacion).toHaveTextContent(/editada anteayer/)
    expect(within(enPreparacion).getByRole('link', { name: /seguir escribiendo cultos/i })).toHaveAttribute('href', '/cms/noticias/9/editar')

    const publicadas = screen.getByRole('heading', { name: /^publicadas/i }).closest('section')!
    expect(within(publicadas).queryByText('Cultos de octubre')).not.toBeInTheDocument()
  })

  it('marca lo que sale en la portada y dónde se corta', async () => {
    responder([noticia, antigua])
    montar()

    const fila = (await screen.findByRole('heading', { name: noticia.titulo })).closest('li')!
    expect(fila).toHaveTextContent('En portada')
    expect(screen.getByRole('heading', { name: antigua.titulo }).closest('li')).not.toHaveTextContent('En portada')
    expect(screen.getByText(/hasta aquí sale en la portada: la más reciente/i)).toBeInTheDocument()
  })

  it('si la foto ya no está en el servidor, la miniatura queda en hueco y no rota', async () => {
    responder([noticia])
    montar()
    const fila = (await screen.findByRole('heading', { name: noticia.titulo })).closest('li')!
    fireEvent.error(fila.querySelector('img')!)
    expect(fila.querySelector('img')).toBeNull()
  })

  it('avisa de lo publicado que queda cojo en la web', async () => {
    responder([antigua])
    montar()
    const fila = (await screen.findByRole('heading', { name: antigua.titulo })).closest('li')!
    expect(fila).toHaveTextContent('Sin foto')
  })

  it('el resumen de arriba cuenta el archivo entero', async () => {
    responder([noticia])
    montar()
    expect(await screen.findByText(/2 publicadas · 1 borrador · la última salió/)).toBeInTheDocument()
  })

  it('los apartados piden al servidor lo suyo y quedan en la URL', async () => {
    const user = userEvent.setup()
    const simulado = responder([noticia])
    montar()
    await user.click(await screen.findByRole('button', { name: /borradores/i }))
    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('estado=borradores'))
  })

  it('publicar desde el listado pregunta antes y manda solo el estado', async () => {
    const user = userEvent.setup()
    const simulado = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(
      init?.method === 'PUT' ? json({ ...borrador, visible: true }) : listado([borrador]),
    ))
    vi.stubGlobal('fetch', simulado)
    montar()

    await user.click(await screen.findByRole('button', { name: /más acciones para cultos/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Publicar' }))
    const dialogo = screen.getByRole('dialog', { name: /publicar la noticia/i })
    expect(simulado.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }))

    await waitFor(() => expect(simulado.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true))
    const [url, init] = simulado.mock.calls.find(([, i]) => i?.method === 'PUT')!
    expect(String(url)).toContain('/news/9')
    expect(JSON.parse(String(init.body))).toEqual({ visible: true })
    expect(await screen.findByText(/noticia publicada/i)).toBeInTheDocument()
  })

  it('la destacada se distingue de las que salen por fecha, y la raya lo explica', async () => {
    // La destacada es la vieja: por fecha no saldría, y sale la primera. Hacen
    // falta más publicadas que plazas, o no hay nada bajo la raya que cortar.
    const destacada = { ...antigua, fijada: true }
    const tercera = { ...noticia, id: 3, slug: 'triduo', titulo: 'Triduo de mayo', fecha: '2026-07-01T00:00:00.000Z' }
    const cuarta = { ...noticia, id: 2, slug: 'via-crucis', titulo: 'Vía crucis de marzo', fecha: '2026-03-01T00:00:00.000Z' }
    responder([destacada, noticia, tercera, cuarta], { resumen: resumen([5, 7, 3], 3, 5) })
    montar()

    const fila = (await screen.findByRole('heading', { name: antigua.titulo })).closest('li')!
    expect(fila).toHaveTextContent('Destacada')
    // La reciente sale por fecha, no destacada: la etiqueta de siempre.
    expect(screen.getByRole('heading', { name: noticia.titulo }).closest('li')).toHaveTextContent('En portada')
    expect(screen.getByText(/hasta aquí sale en la portada: la destacada y las 2 más recientes/i)).toBeInTheDocument()
  })

  it('destacar desde el listado no pregunta y manda solo la marca', async () => {
    const user = userEvent.setup()
    const simulado = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(
      init?.method === 'PUT' ? json({ ...antigua, fijada: true }) : listado([noticia, antigua]),
    ))
    vi.stubGlobal('fetch', simulado)
    montar()

    await user.click(await screen.findByRole('button', { name: /más acciones para besamanos/i }))
    await user.click(screen.getByRole('menuitem', { name: /destacar en la portada/i }))

    await waitFor(() => expect(simulado.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true))
    const [url, init] = simulado.mock.calls.find(([, i]) => i?.method === 'PUT')!
    expect(String(url)).toContain('/news/5')
    expect(JSON.parse(String(init.body))).toEqual({ fijada: true })
    expect(await screen.findByText(/va la primera de la portada/i)).toBeInTheDocument()
  })

  it('un borrador no se puede destacar: no se vería en la web', async () => {
    const user = userEvent.setup()
    responder([borrador])
    montar()
    await user.click(await screen.findByRole('button', { name: /más acciones para cultos/i }))
    expect(screen.queryByRole('menuitem', { name: /destacar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Publicar' })).toBeInTheDocument()
  })

  it('la línea de la portada dice cuántas salen y no ofrece cambiarlo', async () => {
    // Eran de 1 a 20, pero la portada cortaba en tres de todos modos: el CMS
    // prometía cinco y salían tres. Ahora son tres fijas, como en Publicaciones.
    responder([noticia, antigua])
    montar()
    expect(await screen.findByText(/hasta aquí sale en la portada/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cambiar cuántas/i })).not.toBeInTheDocument()
  })

  it('sin resultados lo dice y deja volver a verlas todas', async () => {
    responder([])
    montar('/cms/noticias?q=procesion')
    expect(await screen.findByText('Ninguna noticia coincide con «procesion».')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver todas' })).toBeInTheDocument()
  })

  it('pide la página que dice la URL', async () => {
    const fetchSimulado = vi.fn().mockResolvedValue(json({ data: [], meta: { total: 60, page: 2, limit: 20, totalPages: 3 }, resumen: resumen() }))
    vi.stubGlobal('fetch', fetchSimulado)
    montar('/cms/noticias?pagina=2')

    await waitFor(() => expect(String(fetchSimulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })
})
