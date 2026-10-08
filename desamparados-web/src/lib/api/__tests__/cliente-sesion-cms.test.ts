import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { llamarApi, ErrorDeApi, SESION_NO_CMS } from '../cliente'
import { useAuthStore, type AuthUser } from '../../../features/altas/auth/store'

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const cmsUser: AuthUser = { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms' }
const hermanoUser: AuthUser = { id: 2, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'hermanos' }

function servidor(rutas: Record<string, () => Response>) {
  return vi.fn().mockImplementation((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url
    for (const [sufijo, responder] of Object.entries(rutas)) {
      if (url.includes(sufijo)) return Promise.resolve(responder())
    }
    return Promise.resolve(respuesta({}, 404))
  })
}

beforeEach(() => {
  useAuthStore.setState({ status: 'listo', cms: cmsUser, hermano: null, cmsCaducada: false })
})

afterEach(() => { vi.unstubAllGlobals() })

// Con cookies separadas por área, un 401 puede ser el final de cualquiera de
// las dos sesiones (o de las dos), y la petición que lo recibe no sabe de cuál
// era: no lleva el área. En vez de vaciar las dos a ciegas, se pregunta al
// servidor qué queda vivo y se reparte lo que responda.
describe('llamarApi ante un 401', () => {
  it('consulta /auth/me y reparte las sesiones que devuelva', async () => {
    useAuthStore.setState({ cms: null })
    const fetchMock = servidor({
      '/contabilidad': () => respuesta({ error: 'No autenticado' }, 401),
      '/auth/me': () => respuesta({ cms: null, hermano: hermanoUser }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(llamarApi('/contabilidad')).rejects.toBeInstanceOf(ErrorDeApi)

    await waitFor(() => {
      expect(useAuthStore.getState()).toMatchObject({ status: 'listo', cms: null, hermano: hermanoUser, cmsCaducada: false })
    })
  })

  // Vaciar `cms` hacía que ExigeRol cambiara la pantalla por el acceso y el
  // formulario que se estaba escribiendo se desmontaba con su texto. Se
  // rompe si la caducidad vuelve a vaciar la sesión en vez de marcarla.
  it('si caduca la del CMS con alguien dentro, la marca como caducada sin vaciarla; la de hermanos se reparte', async () => {
    const fetchMock = servidor({
      '/contabilidad': () => respuesta({ error: 'No autenticado' }, 401),
      '/auth/me': () => respuesta({ cms: null, hermano: hermanoUser }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(llamarApi('/contabilidad')).rejects.toBeInstanceOf(ErrorDeApi)

    await waitFor(() => {
      expect(useAuthStore.getState()).toMatchObject({ status: 'listo', cms: cmsUser, hermano: hermanoUser, cmsCaducada: true })
    })
  })

  it('volver a entrar quita la marca de caducada', () => {
    useAuthStore.setState({ cmsCaducada: true })
    useAuthStore.getState().entrarSesion('cms', cmsUser)
    expect(useAuthStore.getState().cmsCaducada).toBe(false)
  })

  it('varias peticiones fallando a la vez preguntan una sola vez', async () => {
    const fetchMock = servidor({
      '/contabilidad': () => respuesta({ error: 'No autenticado' }, 401),
      '/auth/me': () => respuesta({ cms: cmsUser, hermano: null }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await Promise.allSettled([
      llamarApi('/contabilidad'),
      llamarApi('/contabilidad?page=2'),
      llamarApi('/contabilidad?page=3'),
    ])

    await waitFor(() => expect(useAuthStore.getState().cms).toEqual(cmsUser))
    const consultasMe = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/auth/me'))
    expect(consultasMe).toHaveLength(1)
  })

  // Un fallo de red o un 5xx de /auth/me no dice nada de las sesiones: antes
  // vaciaba las dos y echaba también a la que seguía viva.
  it('si /auth/me falla por la red o el servidor, no se toca ninguna sesión', async () => {
    useAuthStore.setState({ hermano: hermanoUser })
    const fetchMock = servidor({
      '/contabilidad': () => respuesta({ error: 'No autenticado' }, 401),
      '/auth/me': () => respuesta({ message: 'Caído' }, 503),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(llamarApi('/contabilidad')).rejects.toBeInstanceOf(ErrorDeApi)

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/auth/me'))).toBe(true)
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(useAuthStore.getState()).toMatchObject({ status: 'listo', cms: cmsUser, hermano: hermanoUser, cmsCaducada: false })
  })

  it('con auth: false (login, el /me del arranque) un 401 no consulta nada ni toca la sesión', async () => {
    const fetchMock = servidor({
      '/auth/login': () => respuesta({ error: 'Credenciales inválidas' }, 401),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(llamarApi('/auth/login', { auth: false })).rejects.toBeInstanceOf(ErrorDeApi)

    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/auth/me'))).toBe(false)
    expect(useAuthStore.getState().cms).toEqual(cmsUser)
  })
})

// SESION_NO_CMS ya no dispara ningún rescate: con cookies separadas por área
// significa solo «has llegado al CMS sin haber entrado por su acceso», no
// «otra pestaña te ha pisado la cookie». Es un 403 de permisos más.
describe('llamarApi ante un 403', () => {
  it('un 403 (SESION_NO_CMS incluido) no toca la sesión ni consulta /auth/me', async () => {
    const fetchMock = servidor({
      '/contabilidad': () => respuesta({ error: SESION_NO_CMS, message: 'Esta sesión no da acceso al gestor de contenidos.' }, 403),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(llamarApi('/contabilidad')).rejects.toMatchObject({ status: 403 })

    expect(useAuthStore.getState()).toMatchObject({ status: 'listo', cms: cmsUser, hermano: null })
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/auth/me'))).toBe(false)
  })
})
