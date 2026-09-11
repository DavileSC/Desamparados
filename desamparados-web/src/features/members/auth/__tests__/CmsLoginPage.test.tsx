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

/** Como mockPorUrl, pero cada ruta decide su código HTTP. La más larga primero. */
function mockConEstados(rutas: Record<string, { cuerpo: unknown; status?: number }>) {
  const ordenadas = Object.entries(rutas).sort(([a], [b]) => b.length - a.length)
  return vi.fn().mockImplementation((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url
    for (const [sufijo, { cuerpo, status }] of ordenadas) {
      if (url.includes(sufijo)) return ok(cuerpo, status)
    }
    return ok({}, 404)
  })
}

async function escribirCredenciales(email = 'cuenta@cofradia.com') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/email/i), email)
  await user.type(screen.getByLabelText(/contraseña/i), 'Desamparados2026')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  return user
}

describe('CmsLoginPage', () => {
  it('una cuenta de hermano raso no consigue sesión: el servidor la rechaza y se le indica su acceso', async () => {
    const fetchMock = mockConEstados({
      '/auth/login': {
        status: 403,
        cuerpo: { error: 'CUENTA_SIN_CMS', message: 'Esta cuenta no pertenece al equipo del CMS.' },
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    montar([
      { path: '/cms/acceso', element: <CmsLoginPage /> },
      { path: '/cms', element: <div>panel del cms</div> },
    ])
    await escribirCredenciales('hermano@cofradia.com')

    // El aviso propio, con el enlace a su acceso.
    expect(await screen.findByRole('link', { name: /acceso del área de hermanos/i })).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('invitado')
    // Ya no hay sesión que cerrar: cerrar sesión ahora revoca las de la cuenta
    // en todos sus dispositivos, y no se le puede cerrar la del móvil por equivocarse de acceso.
    const llamadas = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(llamadas.some((u) => u.includes('/auth/logout'))).toBe(false)
    expect(screen.queryByText('panel del cms')).not.toBeInTheDocument()
  })

  it('si aun así llegara una sesión de hermano raso, se cierra y se le indica su acceso', async () => {
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
      user: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms' },
    })

    montar([
      { path: '/cms/acceso', element: <CmsLoginPage /> },
      { path: '/cms', element: <div>panel directo</div> },
    ])

    expect(screen.getByText('panel directo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument()
  })

  // El panel manda al acceso a toda sesión que no nació en el CMS; si esta
  // página la devolviera al panel por tener rol de staff, el navegador
  // entraría en un bucle de redirecciones.
  it('un cargo con sesión del área de hermanos ve el formulario, no vuelve al panel', () => {
    useAuthStore.setState({
      status: 'autenticado',
      user: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'hermanos' },
    })

    montar([
      { path: '/cms/acceso', element: <CmsLoginPage /> },
      { path: '/cms', element: <div>panel directo</div> },
    ])

    expect(screen.queryByText('panel directo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText(/tu sesión actual es la del área de hermanos/i)).toBeInTheDocument()
  })

  it('una sesión sin origen tampoco cuenta como del CMS', () => {
    useAuthStore.setState({
      status: 'autenticado',
      user: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [] },
    })

    montar([
      { path: '/cms/acceso', element: <CmsLoginPage /> },
      { path: '/cms', element: <div>panel directo</div> },
    ])

    expect(screen.queryByText('panel directo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('si el paso de la contraseña caducó, vuelve a pedirla en vez de seguir probando códigos', async () => {
    vi.stubGlobal('fetch', mockConEstados({
      '/auth/login': { cuerpo: { status: '2FA_NEEDED', message: 'Introduce el código de tu aplicación de autenticación.' } },
      '/auth/login/2fa': {
        status: 401,
        cuerpo: { error: 'PENDING_2FA_REQUIRED', message: 'La verificación ha caducado. Vuelve a introducir tu email y contraseña.' },
      },
    }))

    montar([
      { path: '/cms/acceso', element: <CmsLoginPage /> },
      { path: '/cms', element: <div>panel</div> },
    ])
    const user = await escribirCredenciales('secretaria@cofradia.com')

    await user.type(await screen.findByLabelText(/código de verificación/i), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByText(/la verificación ha caducado/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/código de verificación/i)).not.toBeInTheDocument()
  })

  // El backend ya solo borra la cookie del 2FA en este caso: la de sesión (aquí,
  // una del área de hermanos) sigue siendo buena y el estado no debe perderla.
  it('un testigo caducado no se lleva por delante la sesión del área de hermanos', async () => {
    const deHermanos = { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'hermanos' as const }
    useAuthStore.setState({ status: 'autenticado', user: deHermanos })
    vi.stubGlobal('fetch', mockConEstados({
      '/auth/login': { cuerpo: { status: '2FA_NEEDED', message: 'Introduce el código de tu aplicación de autenticación.' } },
      '/auth/login/2fa': {
        status: 401,
        cuerpo: { error: 'PENDING_2FA_REQUIRED', message: 'La verificación ha caducado. Vuelve a introducir tu email y contraseña.' },
      },
    }))

    montar([
      { path: '/cms/acceso', element: <CmsLoginPage /> },
      { path: '/cms', element: <div>panel</div> },
    ])
    const user = await escribirCredenciales('admin@cofradia.com')
    await user.type(await screen.findByLabelText(/código de verificación/i), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByText(/la verificación ha caducado/i)).toBeInTheDocument()
    expect(useAuthStore.getState()).toMatchObject({ status: 'autenticado', user: deHermanos })
  })
})
