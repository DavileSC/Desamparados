import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import ExigeSesion from '../ExigeSesion'
import ExigeRol from '../ExigeRol'
import { useAuthStore } from '../../features/altas/auth/store'

const TESORERO = { id: 1, email: 'a@b.es', role: 'TESORERIA', perfiles: [], origen: 'cms' as const }
const HERMANO = { id: 1, email: 'a@b.es', role: 'USER', perfiles: [], origen: 'hermanos' as const }
const Dentro = () => <p>dentro</p>

// El `MemoryRouter` de `renderWithProviders` no declara rutas: cuando el
// guarda redirige con `<Navigate>`, no hay ningún `<Route>` que recoja el
// destino, la ubicación cambia, el guarda se vuelve a montar y redirige otra
// vez, sin fin. `createMemoryRouter` sí lo resuelve: aquí se declaran siempre
// la ruta protegida y la ruta a la que redirige el guarda, para que quien
// aterrice ahí se quede montado y el guarda se desmonte.
function montarRuta(elemento: React.ReactElement, { ruta }: { ruta: string }) {
  const rutas: RouteObject[] = [
    { path: ruta, element: elemento },
    { path: '/cms/acceso', element: <p>acceso del cms</p> },
    { path: '/hermanos/acceso', element: <p>acceso de hermanos</p> },
    { path: '/cms', element: <p>inicio del cms</p> },
  ]
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] })
  return render(<RouterProvider router={router} />)
}

describe('los guardas de ruta', () => {
  beforeEach(() => { useAuthStore.setState({ status: 'listo', cms: null, hermano: null }) })

  it('el área de hermanos se abre con la sesión de hermanos', () => {
    useAuthStore.setState({ status: 'listo', cms: null, hermano: HERMANO })
    montarRuta(<ExigeSesion><Dentro /></ExigeSesion>, { ruta: '/area-hermano/perfil' })
    expect(screen.getByText('dentro')).toBeInTheDocument()
  })

  it('el CMS se abre con la sesión del CMS aunque no haya la de hermanos', () => {
    useAuthStore.setState({ status: 'listo', cms: TESORERO, hermano: null })
    montarRuta(
      <ExigeRol roles={['TESORERIA']}><Dentro /></ExigeRol>, { ruta: '/cms/tesoreria' },
    )
    expect(screen.getByText('dentro')).toBeInTheDocument()
  })

  it('estar dentro del portal del hermano no abre el CMS', () => {
    // El segundo factor solo se pide en /cms/acceso.
    useAuthStore.setState({ status: 'listo', cms: null, hermano: HERMANO })
    montarRuta(
      <ExigeRol roles={['TESORERIA']}><Dentro /></ExigeRol>, { ruta: '/cms/tesoreria' },
    )
    expect(screen.queryByText('dentro')).not.toBeInTheDocument()
    expect(screen.getByText('acceso del cms')).toBeInTheDocument()
  })

  it('estar dentro del CMS no abre el portal del hermano', () => {
    useAuthStore.setState({ status: 'listo', cms: TESORERO, hermano: null })
    montarRuta(<ExigeSesion><Dentro /></ExigeSesion>, { ruta: '/area-hermano/perfil' })
    expect(screen.queryByText('dentro')).not.toBeInTheDocument()
    expect(screen.getByText('acceso de hermanos')).toBeInTheDocument()
  })

  it('las dos sesiones a la vez abren las dos zonas', () => {
    // Es el hallazgo: el Tesorero quiere administrar y ver su perfil de hermano.
    useAuthStore.setState({ status: 'listo', cms: TESORERO, hermano: HERMANO })
    const { unmount } = montarRuta(
      <ExigeRol roles={['TESORERIA']}><Dentro /></ExigeRol>, { ruta: '/cms/tesoreria' },
    )
    expect(screen.getByText('dentro')).toBeInTheDocument()
    unmount()
    montarRuta(<ExigeSesion><Dentro /></ExigeSesion>, { ruta: '/area-hermano/perfil' })
    expect(screen.getByText('dentro')).toBeInTheDocument()
  })

  // Rescatado de routes/__tests__/ExigeRol.test.tsx (retirado: probaba el
  // guarda viejo, basado en `user.origen`). Fija un cambio deliberado: antes
  // el rol equivocado mandaba a /area-hermano, una sesión que aquí puede no
  // existir. El Inicio del CMS lo ven todos los cargos.
  it('con sesión del CMS pero sin el rol pedido, el guarda manda al Inicio del CMS', () => {
    useAuthStore.setState({ status: 'listo', cms: { ...TESORERO, role: 'SECRETARIA' }, hermano: null })
    montarRuta(
      <ExigeRol roles={['TESORERIA']}><Dentro /></ExigeRol>, { ruta: '/cms/tesoreria' },
    )
    expect(screen.getByText('inicio del cms')).toBeInTheDocument()
  })
})
