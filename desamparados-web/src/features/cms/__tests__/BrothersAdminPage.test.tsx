import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import BrothersAdminPage from '../BrothersAdminPage'
import { useAuthStore } from '../../members/auth/store'

type Censo = { data: unknown[]; meta: { total: number; page: number; limit: number; totalPages: number } }

/** El censo y las solicitudes son dos llamadas distintas: responde por URL. */
function responderCenso(censo: Censo, solicitudes: unknown[]) {
  // Desde la Tarea 6 las solicitudes también llegan paginadas.
  const paginaSolicitudes = { data: solicitudes, meta: { total: solicitudes.length, page: 1, limit: 20, totalPages: Math.ceil(solicitudes.length / 20) } }
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const cuerpo = String(url).includes('solicitudes') ? paginaSolicitudes : censo
    return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }))
}

const censoVacio: Censo = { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } }

function respuestaCenso(data: unknown[], total = data.length) {
  return new Response(JSON.stringify({ data, meta: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const solicitud = {
  id: 3, email: 'nueva@ejemplo.invalido', nombre: 'Lucía', apellidos: 'Ramos Gil',
  createdAt: '2026-08-20T10:00:00.000Z', hermanos: [],
}

beforeEach(() => {
  useAuthStore.setState({ status: 'autenticado', user: { id: 1, email: 'secre@ejemplo.es', role: 'SECRETARIA', perfiles: [] } })
  // La vista vive en la URL y el `BrowserRouter` de los tests comparte el
  // `window.location`: sin esto, un test empieza donde lo dejó el anterior.
  window.history.replaceState({}, '', '/cms/hermanos')
})

afterEach(() => { vi.unstubAllGlobals() })

describe('BrothersAdminPage', () => {
  it('la pestaña de solicitudes se ve aunque no haya ninguna', async () => {
    // Antes el bloque entero desaparecía sin solicitudes: la función existía y
    // era invisible, así que nadie sabía que estaba.
    const user = userEvent.setup()
    responderCenso(censoVacio, [])
    renderWithProviders(<BrothersAdminPage />)
    await user.click(await screen.findByRole('tab', { name: /solicitudes/i }))
    expect(screen.getByText(/no hay solicitudes pendientes/i)).toBeInTheDocument()
  })

  it('la pestaña lleva el número de pendientes', async () => {
    responderCenso(censoVacio, [
      { id: 1, email: 'nuevo@ejemplo.invalido', nombre: 'Nuevo', apellidos: 'Hermano', createdAt: '2026-08-01T00:00:00.000Z', hermanos: [{ id: 9 }] },
      { id: 2, email: 'otra@ejemplo.invalido', nombre: 'Otra', apellidos: 'Solicitante', createdAt: '2026-08-02T00:00:00.000Z', hermanos: [{ id: 10 }] },
    ])
    renderWithProviders(<BrothersAdminPage />)
    expect(await screen.findByRole('tab', { name: /solicitudes \(2\)/i })).toBeInTheDocument()
  })

  it('el Hermano Mayor gestiona el censo como secretaría', async () => {
    // Ve las solicitudes y edita fichas: el servidor le deja las dos cosas
    // (rolesGestionCenso en hermano.routes.ts).
    useAuthStore.setState({ status: 'autenticado', user: { id: 2, email: 'mayor@ejemplo.es', role: 'HERMANO_MAYOR', perfiles: [] } })
    responderCenso(
      { data: [{ id: 5, nombre: 'Rocío', apellidos: 'Gómez Marín', numeroHermano: 118, email: null, activo: true }], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } },
      [{ id: 1, email: 'nuevo@ejemplo.invalido', nombre: 'Nuevo', apellidos: 'Hermano', createdAt: '2026-08-01T00:00:00.000Z', hermanos: [{ id: 9 }] }],
    )
    renderWithProviders(<BrothersAdminPage />)

    expect(await screen.findByRole('tab', { name: /solicitudes \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /editar rocío/i })).toHaveAttribute('href', '/cms/hermanos/5/editar')
  })

  it('un hermano raso que llegara al listado no ve el botón de editar', async () => {
    // La guarda de ruta ya no le deja entrar, pero el botón no depende de eso.
    useAuthStore.setState({ status: 'autenticado', user: { id: 3, email: 'raso@ejemplo.es', role: 'USER', perfiles: [] } })
    responderCenso(
      { data: [{ id: 5, nombre: 'Rocío', apellidos: 'Gómez Marín', numeroHermano: 118, email: null, activo: true }], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } },
      [],
    )
    renderWithProviders(<BrothersAdminPage />)

    await screen.findByText('Rocío Gómez Marín')
    expect(screen.queryByRole('link', { name: /editar rocío/i })).not.toBeInTheDocument()
  })

  it('el censo no se mezcla con las solicitudes', async () => {
    const user = userEvent.setup()
    responderCenso(censoVacio, [
      { id: 1, email: 'nuevo@ejemplo.invalido', nombre: 'Nuevo', apellidos: 'Hermano', createdAt: '2026-08-01T00:00:00.000Z', hermanos: [{ id: 9 }] },
    ])
    renderWithProviders(<BrothersAdminPage />)
    // En la pestaña del censo está el buscador y no las solicitudes.
    expect(await screen.findByLabelText(/buscar por nombre/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /solicitudes/i }))
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/buscar por nombre/i)).not.toBeInTheDocument()
  })

  // Las llamadas al censo se identifican por su URL (contiene '/search'), no
  // por su posición: la Tarea 6 va a paginar también las solicitudes y ese
  // Promise.all volverá a cambiar de orden sin que haya ningún defecto.
  function llamadasAlCenso(fetchSimulado: ReturnType<typeof vi.fn>) {
    return fetchSimulado.mock.calls
      .map((llamada) => String(llamada[0]))
      .filter((url) => url.includes('/hermanos/admin/search'))
  }

  it('pide la página que dice la URL', async () => {
    // mockImplementation, no mockResolvedValue: cada llamada a fetch consume su
    // propio Response, tanto la del censo como la de solicitudes (Promise.all
    // dispara las dos). Compartir una única instancia rompería el segundo
    // `.json()` con la Fetch API real.
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(respuestaCenso([])))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<BrothersAdminPage />, { ruta: '/cms/hermanos?pagina=3&porPagina=30' })

    await waitFor(() => {
      expect(llamadasAlCenso(fetchSimulado).some((url) => url.includes('page=3') && url.includes('limit=30'))).toBe(true)
    })
  })

  it('buscar vuelve a la primera página', async () => {
    const user = userEvent.setup()
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(respuestaCenso([])))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<BrothersAdminPage />, { ruta: '/cms/hermanos?pagina=5' })

    await user.type(screen.getByLabelText(/buscar/i), 'Rocío')

    await waitFor(() => {
      const ultimaAlCenso = llamadasAlCenso(fetchSimulado).at(-1)
      expect(ultimaAlCenso).toBeDefined()
      expect(ultimaAlCenso).toContain('page=1')
      expect(ultimaAlCenso).toContain('q=Roc')
    })
  })

  it('la pestaña cuenta todas las solicitudes, no las de la página', async () => {
    // Con doce pendientes y diez por página, «Solicitudes (10)» sería mentira
    // justo en el aviso que empuja a entrar a mirarlas.
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
      Promise.resolve(String(url).includes('solicitudes')
        ? new Response(JSON.stringify({ data: [solicitud], meta: { total: 12, page: 1, limit: 10, totalPages: 2 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : respuestaCenso([]))))

    renderWithProviders(<BrothersAdminPage />)
    expect(await screen.findByRole('tab', { name: /solicitudes \(12\)/i })).toBeInTheDocument()
  })

  // --- Hallazgo D10: rechazar borraba sin preguntar y los botones no se
  // deshabilitaban (un doble clic en «Aprobar» daba un 500 o un número saltado).

  /** Solicitudes en la lista; aprobar y rechazar responden con lo que diga la prueba. */
  function servidorSolicitudes(acciones: { aprobar?: () => Promise<unknown>; rechazar?: () => Promise<unknown> } = {}) {
    const llamadas: { url: string; metodo: string }[] = []
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
      const metodo = init.method ?? 'GET'
      llamadas.push({ url: String(url), metodo })
      let cuerpo: unknown
      if (metodo === 'POST') cuerpo = await (acciones.aprobar?.() ?? Promise.resolve({ message: 'ok' }))
      else if (metodo === 'DELETE') cuerpo = await (acciones.rechazar?.() ?? Promise.resolve({ message: 'ok' }))
      else if (String(url).includes('solicitudes')) cuerpo = { data: [{ ...solicitud, hermanos: [{ id: 9 }] }], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } }
      else cuerpo = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
      return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    return llamadas
  }

  it('rechazar pregunta antes de borrar', async () => {
    const user = userEvent.setup()
    const llamadas = servidorSolicitudes()
    renderWithProviders(<BrothersAdminPage />, { ruta: '/cms/hermanos?vista=solicitudes' })

    await user.click(await screen.findByRole('button', { name: 'Rechazar' }))
    const dialogo = screen.getByRole('dialog', { name: /rechazar la solicitud/i })
    expect(dialogo).toHaveTextContent(/lucía ramos gil/i)
    expect(dialogo).toHaveTextContent(/no se puede deshacer/i)

    // «Volver» no borra nada.
    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false)

    // El diálogo tarda en cerrarse: hasta entonces el resto de la página queda oculto.
    await user.click(await screen.findByRole('button', { name: 'Rechazar' }))
    await user.click(screen.getByRole('button', { name: 'Rechazar solicitud' }))
    await waitFor(() => {
      const borrado = llamadas.find((l) => l.metodo === 'DELETE')
      expect(borrado?.url).toContain('/hermanos/admin/solicitudes/3/rechazar')
    })
  })

  it('mientras se aprueba, ningún botón de la solicitud responde', async () => {
    const user = userEvent.setup()
    let terminar!: (valor: unknown) => void
    const llamadas = servidorSolicitudes({ aprobar: () => new Promise((r) => { terminar = r }) })
    renderWithProviders(<BrothersAdminPage />, { ruta: '/cms/hermanos?vista=solicitudes' })

    await user.click(await screen.findByRole('button', { name: 'Aprobar' }))
    const ocupado = screen.getByRole('button', { name: /procesando/i })
    expect(ocupado).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDisabled()
    expect(llamadas.filter((l) => l.metodo === 'POST')).toHaveLength(1)

    terminar({ message: 'Solicitud aprobada.' })
    expect(await screen.findByText(/solicitud aprobada correctamente/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeEnabled()
  })

  it('ofrece asignar números a los hermanos que no lo tienen', async () => {
    // El menú lleva un contador de «hermanos sin número» que hasta ahora no
    // tenía ninguna forma de bajar desde la interfaz.
    const usuario = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit = {}) =>
      Promise.resolve((init.method ?? 'GET') === 'POST'
        ? new Response(JSON.stringify({
            message: 'Se han asignado 2 números de hermano.',
            asignados: [{ id: 7, numeroHermano: 1285 }, { id: 9, numeroHermano: 1286 }],
          }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : respuestaCenso([]))))
    renderWithProviders(<BrothersAdminPage />)

    const boton = await screen.findByRole('button', { name: /asignar n[úu]meros/i })
    await usuario.click(boton)
    await usuario.click(await screen.findByRole('button', { name: /confirmar|asignar/i }))

    expect(await screen.findByText(/se han asignado 2 n[úu]meros/i)).toBeInTheDocument()
  })
})
