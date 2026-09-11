import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import NewsAdminPage from '../NewsAdminPage'

const noticia = {
  id: 7, slug: 'apertura-curso-cofrade', titulo: 'Apertura del curso cofrade 2026-2027',
  extracto: 'El Grupo Parroquial abre el nuevo curso.', contenido: '<p>Texto</p>',
  imagenUrl: null, visible: true, fecha: '2026-08-26T00:00:00.000Z',
}

function responder(items: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: items, meta: { total: items.length, page: 1, limit: 50, totalPages: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('NewsAdminPage', () => {
  it('antes de borrar pregunta, y dice qué se va a borrar', async () => {
    // Hasta ahora era un window.confirm: no decía de qué noticia hablaba.
    const user = userEvent.setup()
    responder([noticia])
    renderWithProviders(<NewsAdminPage />)
    await user.click(await screen.findByRole('button', { name: /eliminar apertura/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Apertura del curso cofrade 2026-2027')
  })

  it('quien cancela no borra nada', async () => {
    const user = userEvent.setup()
    responder([noticia])
    renderWithProviders(<NewsAdminPage />)
    await user.click(await screen.findByRole('button', { name: /eliminar apertura/i }))

    const llamadas = vi.fn()
    vi.stubGlobal('fetch', llamadas)
    await user.click(screen.getByRole('button', { name: 'Volver' }))

    expect(llamadas).not.toHaveBeenCalled()
    // El diálogo de MUI se va con una transición: sigue en el DOM un instante.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('editar lleva a la pantalla de la noticia, no al formulario de abajo', async () => {
    responder([noticia])
    renderWithProviders(<NewsAdminPage />)
    const editar = await screen.findByRole('link', { name: /editar apertura/i })
    expect(editar).toHaveAttribute('href', '/cms/noticias/7/editar')
  })

  it('al entrar se ve el archivo y un botón para crear, sin formulario', async () => {
    responder([noticia])
    renderWithProviders(<NewsAdminPage />)

    expect(await screen.findByRole('heading', { name: noticia.titulo })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nueva noticia/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/contenido html/i)).not.toBeInTheDocument()
  })

  it('la ventana de nueva noticia la crea, se cierra y avisa', async () => {
    const user = userEvent.setup()
    const simulado = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(new Response(
      JSON.stringify(init?.method === 'POST' ? { ...noticia, id: 8 } : { data: [noticia], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } }),
      { status: init?.method === 'POST' ? 201 : 200, headers: { 'Content-Type': 'application/json' } },
    )))
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<NewsAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nueva noticia/i }))
    const ventana = screen.getByRole('dialog', { name: /nueva noticia/i })
    await user.type(within(ventana).getByLabelText(/título/i), 'Triduo de septiembre')
    await user.type(within(ventana).getByLabelText(/contenido html/i), 'Texto')
    await user.click(within(ventana).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const alta = simulado.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(alta?.[1]?.body))).toMatchObject({ titulo: 'Triduo de septiembre', contenido: 'Texto' })
    expect(screen.getByText(/noticia creada correctamente/i)).toBeInTheDocument()
  })

  it('si el servidor rechaza la noticia, la ventana sigue abierta con lo escrito y el motivo', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(new Response(
      JSON.stringify(init?.method === 'POST' ? { error: 'Ya existe una noticia con ese slug.' } : { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      { status: init?.method === 'POST' ? 409 : 200, headers: { 'Content-Type': 'application/json' } },
    ))))
    renderWithProviders(<NewsAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nueva noticia/i }))
    const ventana = screen.getByRole('dialog', { name: /nueva noticia/i })
    await user.type(within(ventana).getByLabelText(/título/i), 'Triduo')
    await user.type(within(ventana).getByLabelText(/contenido html/i), 'Texto')
    await user.click(within(ventana).getByRole('button', { name: 'Guardar' }))

    expect(await within(ventana).findByText(/ya existe una noticia con ese slug/i)).toBeInTheDocument()
    expect(within(ventana).getByLabelText(/título/i)).toHaveValue('Triduo')
  })

  it('pide la página que dice la URL', async () => {
    const fetchSimulado = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [], meta: { total: 60, page: 2, limit: 20, totalPages: 3 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<NewsAdminPage />, { ruta: '/cms/noticias?pagina=2' })

    await waitFor(() => expect(String(fetchSimulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })
})
