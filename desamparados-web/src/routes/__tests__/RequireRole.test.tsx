import { useEffect } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import RequireRole from '../RequireRole'
import CmsLoginPage from '../../features/members/auth/CmsLoginPage'
import { apiFetch } from '../../lib/api/client'
import { useAuthStore, type AuthUser } from '../../features/members/auth/store'

function montarCon(user: AuthUser) {
  useAuthStore.setState({ status: 'autenticado', user })
  const router = createMemoryRouter(
    [
      { path: '/cms', element: <RequireRole roles={['ADMIN']}><div>panel</div></RequireRole> },
      { path: '/cms/acceso', element: <div>acceso del cms</div> },
      { path: '/area-hermano', element: <div>área de hermanos</div> },
    ],
    { initialEntries: ['/cms'] },
  )
  return render(<RouterProvider router={router} />)
}

const admin = (origen?: 'cms' | 'hermanos'): AuthUser => ({
  id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], ...(origen ? { origen } : {}),
})

beforeEach(() => {
  useAuthStore.setState({ status: 'cargando', user: null })
})

// El servidor ya rechaza estas sesiones en las rutas del CMS (checkRole); la
// guarda del navegador tiene que decir lo mismo o el panel se abriría vacío,
// con cada petición devolviendo 403.
describe('RequireRole', () => {
  it('una sesión nacida en el CMS con el rol pedido entra', () => {
    montarCon(admin('cms'))
    expect(screen.getByText('panel')).toBeInTheDocument()
  })

  it('una sesión del área de hermanos va al acceso del CMS', () => {
    montarCon(admin('hermanos'))
    expect(screen.getByText('acceso del cms')).toBeInTheDocument()
  })

  it('una sesión sin origen tampoco es del CMS', () => {
    montarCon(admin())
    expect(screen.getByText('acceso del cms')).toBeInTheDocument()
  })

  it('con sesión del CMS pero sin el rol, al área de hermanos', () => {
    montarCon({ ...admin('cms'), role: 'TESORERIA' })
    expect(screen.getByText('área de hermanos')).toBeInTheDocument()
  })
})

// El caso de las dos pestañas, de punta a punta: el CMS abierto pide datos, el
// servidor dice que la cookie ya es de una sesión del área de hermanos, y la
// persona acaba en el acceso del CMS con el aviso de por qué, no en una
// pantalla llena de «no tienes permisos».
describe('una pestaña del CMS cuando otra entra por el área de hermanos', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  function PantallaDelCms() {
    useEffect(() => { apiFetch('/news/admin/archive').catch(() => undefined) }, [])
    return <div>archivo de noticias</div>
  }

  it('lleva al acceso del CMS con el aviso de la sesión de hermanos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url
      const cuerpo = url.includes('/auth/me')
        ? { status: 200, json: { user: admin('hermanos') } }
        : { status: 403, json: { error: 'SESION_NO_CMS', message: 'Esta sesión no da acceso al gestor de contenidos.' } }
      return Promise.resolve(new Response(JSON.stringify(cuerpo.json), {
        status: cuerpo.status, headers: { 'Content-Type': 'application/json' },
      }))
    }))

    useAuthStore.setState({ status: 'autenticado', user: admin('cms') })
    const router = createMemoryRouter(
      [
        { path: '/cms', element: <RequireRole roles={['ADMIN']}><PantallaDelCms /></RequireRole> },
        { path: '/cms/acceso', element: <CmsLoginPage /> },
      ],
      { initialEntries: ['/cms'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/tu sesión actual es la del área de hermanos/i)).toBeInTheDocument()
    expect(screen.queryByText('archivo de noticias')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/cms/acceso')
  })
})
