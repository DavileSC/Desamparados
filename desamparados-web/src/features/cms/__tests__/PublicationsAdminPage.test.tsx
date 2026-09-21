import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import { TemaCmsProvider } from '../../../app/temaCms'
import PublicationsAdminPage from '../PublicationsAdminPage'

const PDF = '/storage/public/0123456789abcdef0123456789abcdef.pdf'
const publicacion = {
  id: 4, titulo: 'Boletín informativo n.º 12', descripcion: 'Crónica del curso.', imagenUrl: '/storage/public/boletin-12.jpg',
  archivoUrl: PDF, fecha: '2026-03-01T00:00:00.000Z', categoria: 'boletin', visible: true, fijada: false,
}
const anuario = { ...publicacion, id: 3, titulo: 'Anuario 2024-2025', categoria: 'anuario', imagenUrl: null, fecha: '2025-10-01T00:00:00.000Z' }
const antigua = { ...publicacion, id: 2, titulo: 'Boletín informativo n.º 11', fecha: '2025-03-01T00:00:00.000Z' }
const vieja = { ...publicacion, id: 1, titulo: 'Boletín informativo n.º 10', fecha: '2024-03-01T00:00:00.000Z' }
const borrador = {
  ...publicacion, id: 9, titulo: 'Dossier de cuaresma', categoria: 'dossier', descripcion: '', imagenUrl: null,
  visible: false, updatedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
}

const resumen = { publicadas: 4, borradores: 1, incompletas: 2, ultimaPublicacion: '2026-03-01T00:00:00.000Z', portada: { limite: 3, ids: [4, 3, 2], fijada: null } }

/**
 * Una instancia de Response por llamada: `apiFetch` lee el cuerpo con
 * `res.text()` y reutilizar la misma la dejaría consumida en la segunda.
 */
function responder(data: unknown[], meta: Record<string, number> = { total: data.length, page: 1, limit: 20, totalPages: 1 }) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data, meta, resumen }), { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

const montar = (ruta = '/cms/publicaciones') => renderWithProviders(<TemaCmsProvider><PublicationsAdminPage /></TemaCmsProvider>, { ruta })

afterEach(() => { vi.unstubAllGlobals() })

describe('PublicationsAdminPage', () => {
  it('pinta las publicaciones que llegan en data y ofrece pasar de página', async () => {
    responder([publicacion], { total: 45, page: 1, limit: 20, totalPages: 3 })
    montar()

    expect(await screen.findByRole('heading', { name: publicacion.titulo })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /editar boletín informativo n.º 12/i })).toHaveAttribute('href', '/cms/publicaciones/4/editar')
  })

  it('crear lleva a una ficha nueva, no a una ventana', async () => {
    responder([publicacion])
    montar()
    expect(await screen.findByRole('heading', { name: publicacion.titulo })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /nueva publicación/i })).toHaveAttribute('href', '/cms/publicaciones/nueva')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('los borradores van aparte, arriba, y dicen qué les falta', async () => {
    responder([borrador, publicacion])
    montar()

    const enPreparacion = (await screen.findByRole('heading', { name: /en preparación/i })).closest('section')!
    expect(within(enPreparacion).getByRole('heading', { name: 'Dossier de cuaresma' })).toBeInTheDocument()
    expect(enPreparacion).toHaveTextContent('Le faltan la descripción y la portada')
    expect(enPreparacion).toHaveTextContent('Dossier de prensa')
    expect(enPreparacion).toHaveTextContent(/editada hace 3 horas/)
    expect(within(enPreparacion).getByRole('link', { name: /seguir escribiendo dossier/i })).toHaveAttribute('href', '/cms/publicaciones/9/editar')
  })

  it('marca las tres que salen en la portada y dónde se corta, sin ofrecer cambiar cuántas', async () => {
    responder([publicacion, anuario, antigua, vieja])
    montar()

    const fila = (await screen.findByRole('heading', { name: publicacion.titulo })).closest('li')!
    expect(fila).toHaveTextContent('En portada')
    expect(screen.getByRole('heading', { name: vieja.titulo }).closest('li')).not.toHaveTextContent('En portada')
    expect(screen.getByText(/hasta aquí sale en la portada: las 3 más recientes/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cambiar cuántas/i })).not.toBeInTheDocument()
  })

  it('con un tipo elegido no pinta la raya: faltarían las de otros tipos', async () => {
    responder([publicacion, antigua, vieja])
    montar('/cms/publicaciones?tipo=boletin')
    await screen.findByRole('heading', { name: publicacion.titulo })
    expect(screen.queryByText(/hasta aquí sale en la portada/i)).not.toBeInTheDocument()
  })

  it('avisa de lo publicado que queda cojo en la web, y del PDF de relleno', async () => {
    responder([anuario, { ...vieja, archivoUrl: '/storage/public/documentos/pendiente.pdf' }])
    montar()
    expect((await screen.findByRole('heading', { name: anuario.titulo })).closest('li')).toHaveTextContent('Sin portada')
    expect(screen.getByRole('heading', { name: vieja.titulo }).closest('li')).toHaveTextContent('PDF de relleno')
  })

  it('el resumen de arriba cuenta las publicadas y los borradores', async () => {
    responder([publicacion])
    montar()
    expect(await screen.findByText(/4 publicadas · 1 borrador · la última salió/)).toBeInTheDocument()
  })

  it('el tipo y el apartado se piden al servidor y quedan en la URL', async () => {
    const user = userEvent.setup()
    const simulado = responder([publicacion])
    montar()
    await user.click(await screen.findByRole('button', { name: /borradores/i }))
    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('estado=borradores'))

    await user.click(screen.getByRole('combobox', { name: 'Tipo' }))
    await user.click(screen.getByRole('option', { name: 'Anuario' }))
    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('categoria=anuario'))
  })

  it('publicar desde el menú pregunta antes', async () => {
    const user = userEvent.setup()
    const simulado = responder([borrador])
    montar()
    await user.click(await screen.findByRole('button', { name: /más acciones para dossier/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Publicar' }))

    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveTextContent('Se podrá descargar desde la web al momento')
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }))
    await waitFor(() => {
      const put = simulado.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      expect(put?.[0]).toMatch(/\/publications\/9$/)
      expect(JSON.parse(String((put![1] as RequestInit).body))).toEqual({ visible: true })
    })
  })

  it('antes de borrar pregunta, y avisa de que se van también el PDF y la portada', async () => {
    const user = userEvent.setup()
    responder([publicacion])
    montar()
    await user.click(await screen.findByRole('button', { name: /más acciones para boletín/i }))
    await user.click(screen.getByRole('menuitem', { name: /eliminar/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent(/se borran también su pdf y su portada/i)
  })

  it('pide la página que dice la URL', async () => {
    const simulado = responder([], { total: 60, page: 2, limit: 20, totalPages: 3 })
    montar('/cms/publicaciones?pagina=2')
    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })

  it('destacar manda solo la marca y avisa de que va la primera', async () => {
    const user = userEvent.setup()
    const simulado = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(new Response(
      JSON.stringify(init?.method === 'PUT'
        ? { ...vieja, fijada: true }
        : { data: [publicacion, vieja], meta: { total: 2, page: 1, limit: 20, totalPages: 1 }, resumen }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    vi.stubGlobal('fetch', simulado)
    montar()

    await user.click(await screen.findByRole('button', { name: /más acciones para boletín informativo n.º 10/i }))
    await user.click(screen.getByRole('menuitem', { name: /destacar en la portada/i }))

    await waitFor(() => expect(simulado.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true))
    const [url, init] = simulado.mock.calls.find(([, i]) => i?.method === 'PUT')!
    expect(String(url)).toContain('/publications/1')
    expect(JSON.parse(String(init.body))).toEqual({ fijada: true })
    expect(await screen.findByText(/va la primera de la portada/i)).toBeInTheDocument()
  })
})
