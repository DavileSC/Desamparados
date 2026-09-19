import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import { TemaCmsProvider } from '../../../app/temaCms'
import NewsAdminPage from '../NewsAdminPage'

const noticia = {
  id: 7, slug: 'apertura-curso-cofrade', titulo: 'Apertura del curso cofrade 2026-2027',
  extracto: 'El Grupo Parroquial abre el nuevo curso.', contenido: '<p>Texto</p>',
  imagenUrl: '/storage/public/apertura.jpg', visible: true, fecha: '2026-08-26T00:00:00.000Z',
}
const antigua = { ...noticia, id: 5, slug: 'besamanos', titulo: 'Besamanos de septiembre', imagenUrl: null, fecha: '2026-08-01T00:00:00.000Z' }
const borrador = {
  ...noticia, id: 9, slug: 'cultos-octubre', titulo: 'Cultos de octubre', extracto: '', imagenUrl: null,
  visible: false, fecha: '2026-09-14T00:00:00.000Z', updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
}

const resumen = (portada: number[] = [7], limite = 1) => ({ publicadas: 2, borradores: 1, incompletas: 2, ultimaPublicacion: '2026-08-26T00:00:00.000Z', portada: { limite, ids: portada } })

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const listado = (items: unknown[], extra = {}) => json({ data: items, meta: { total: items.length, page: 1, limit: 20, totalPages: 1 }, resumen: resumen(), ...extra })

function responder(items: unknown[], extra = {}) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(listado(items, extra)))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

const montar = (ruta = '/cms/noticias') => renderWithProviders(<TemaCmsProvider><NewsAdminPage /></TemaCmsProvider>, { ruta })

afterEach(() => { vi.unstubAllGlobals() })

describe('NewsAdminPage', () => {
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

  it('cuántas salen en la portada se cambia desde la línea de corte', async () => {
    const user = userEvent.setup()
    const simulado = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(
      init?.method === 'POST' ? json({ message: 'ok' }) : listado([noticia, antigua]),
    ))
    vi.stubGlobal('fetch', simulado)
    montar()

    await user.click(await screen.findByRole('button', { name: /cambiar cuántas/i }))
    const ventana = screen.getByRole('dialog', { name: /noticias en la portada/i })
    await user.click(within(ventana).getByRole('combobox', { name: /cuántas enseña/i }))
    await user.click(screen.getByRole('option', { name: '4' }))
    await user.click(within(ventana).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(simulado.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    const [url, init] = simulado.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(String(url)).toContain('/news/limit')
    expect(JSON.parse(String(init.body))).toEqual({ limit: 4 })
    expect(await screen.findByText(/la portada enseña ahora las 4 noticias más recientes/i)).toBeInTheDocument()
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
