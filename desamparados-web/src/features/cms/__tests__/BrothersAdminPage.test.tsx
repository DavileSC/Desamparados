import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import BrothersAdminPage from '../BrothersAdminPage'
import { useAuthStore } from '../../members/auth/store'

type Censo = { data: unknown[]; meta: { total: number; page: number; limit: number; totalPages: number } }

/** El censo y las solicitudes son dos llamadas distintas: responde por URL. */
function responderCenso(censo: Censo, solicitudes: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const cuerpo = String(url).includes('solicitudes') ? solicitudes : censo
    return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }))
}

const censoVacio: Censo = { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } }

function respuestaCenso(data: unknown[], total = data.length) {
  return new Response(JSON.stringify({ data, meta: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } })
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
    const fetchSimulado = vi.fn().mockResolvedValue(respuestaCenso([]))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<BrothersAdminPage />, { ruta: '/cms/hermanos?pagina=3&porPagina=30' })

    await waitFor(() => {
      expect(llamadasAlCenso(fetchSimulado).some((url) => url.includes('page=3') && url.includes('limit=30'))).toBe(true)
    })
  })

  it('buscar vuelve a la primera página', async () => {
    const user = userEvent.setup()
    const fetchSimulado = vi.fn().mockResolvedValue(respuestaCenso([]))
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
})
