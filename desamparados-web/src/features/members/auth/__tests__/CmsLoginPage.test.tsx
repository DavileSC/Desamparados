import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import CmsLoginPage from '../CmsLoginPage'
import { useAuthStore } from '../store'

const ok = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

function entrada(role: string, origen: 'cms' | 'hermanos' = 'cms') {
  return {
    id: 1,
    email: 'cuenta@cofradia.com',
    role,
    perfiles: [],
    origen,
  }
}

/** Responde según la URL: los tests de esta página encadenan varias llamadas. */
function mockPorUrl(rutas: Record<string, unknown>) {
  return vi.fn().mockImplementation((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url
    for (const [sufijo, cuerpo] of Object.entries(rutas)) {
      if (url.includes(sufijo)) return ok(cuerpo)
    }
    return ok({}, 404)
  })
}

function montar(rutas: Parameters<typeof createMemoryRouter>[0], inicial = '/cms/acceso') {
  const router = createMemoryRouter(rutas, { initialEntries: [inicial] })
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  useAuthStore.setState({ status: 'invitado', user: null })
})

afterEach(() => { vi.unstubAllGlobals() })

describe('CmsLoginPage', () => {
  it('una cuenta de hermano raso no consigue sesión: se cierra y se le indica su acceso', async () => {
    const fetchMock = mockPorUrl({
      '/auth/login': { status: 'OK', user: entrada('USER') },
      '/auth/logout': {},
    })
    vi.stubGlobal('fetch', fetchMock)

    montar([
      { path: '/cms/acceso', element: <CmsLoginPage /> },
      { path: '/cms', element: <div>panel del cms</div> },
    ])

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'hermano@cofradia.com')
    await user.type(screen.getByLabelText(/contraseña/i), 'Desamparados2026')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    // Se le expulsa con mensaje, no con un cambio de página.
    expect(await screen.findByText(/no pertenece al equipo del cms/i)).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('invitado')

    // La sesión que el backend acaba de crear se cierra en el acto.
    const llamadas = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(llamadas.some((u) => u.includes('/auth/logout'))).toBe(true)
    // Y nunca se llegó al panel.
    expect(screen.queryByText('panel del cms')).not.toBeInTheDocument()
  })

  it('el staff entra y aterriza en el panel', async () => {
    vi.stubGlobal('fetch', mockPorUrl({
      '/auth/login': { status: 'OK', user: entrada('SECRETARIA') },
    }))

    montar([
      { path: '/cms/acceso', element: <CmsLoginPage /> },
      { path: '/cms', element: <div>panel del cms</div> },
    ])

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'secretaria@cofradia.com')
    await user.type(screen.getByLabelText(/contraseña/i), 'Desamparados2026')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('panel del cms')).toBeInTheDocument()
    expect(useAuthStore.getState().user?.role).toBe('SECRETARIA')
  })

  it('marca "recordarme" y envía contexto cms en el cuerpo del login', async () => {
    const fetchMock = mockPorUrl({
      '/auth/login': { status: 'OK', user: entrada('ADMIN') },
    })
    vi.stubGlobal('fetch', fetchMock)

    montar([
      { path: '/cms/acceso', element: <CmsLoginPage /> },
      { path: '/cms', element: <div>panel</div> },
    ])

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'admin@cofradia.com')
    await user.type(screen.getByLabelText(/contraseña/i), 'Desamparados2026')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(useAuthStore.getState().status).toBe('autenticado'))
    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(cuerpo.recordarme).toBe(true)
    expect(cuerpo.contexto).toBe('cms')
  })

  it('quien ya tiene sesión de staff no ve el formulario: directo al panel', () => {
    useAuthStore.setState({
      status: 'autenticado',
      user: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [] },
    })

    montar([
      { path: '/cms/acceso', element: <CmsLoginPage /> },
      { path: '/cms', element: <div>panel directo</div> },
    ])

    expect(screen.getByText('panel directo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument()
  })
})
