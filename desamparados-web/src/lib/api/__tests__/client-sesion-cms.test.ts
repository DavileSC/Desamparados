import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { apiFetch, ApiError, SESION_NO_CMS } from '../client'
import { useAuthStore, type AuthUser } from '../../../features/members/auth/store'

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
  useAuthStore.setState({ status: 'listo', cms: cmsUser, hermano: null })
})

afterEach(() => { vi.unstubAllGlobals() })

// Con cookies separadas por área, un 401 puede ser el final de cualquiera de
// las dos sesiones (o de las dos), y la petición que lo recibe no sabe de cuál
// era: no lleva el área. En vez de vaciar las dos a ciegas, se pregunta al
// servidor qué queda vivo y se reparte lo que responda.
describe('apiFetch ante un 401', () => {
  it('consulta /auth/me y reparte las sesiones que devuelva', async () => {
    const fetchMock = servidor({
      '/contabilidad': () => respuesta({ error: 'No autenticado' }, 401),
      '/auth/me': () => respuesta({ cms: null, hermano: hermanoUser }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/contabilidad')).rejects.toBeInstanceOf(ApiError)

    // La sesión del CMS ha caducado, pero la del área de hermanos seguía viva:
    // se reparte tal cual, no se vacían las dos.
    await waitFor(() => {
      expect(useAuthStore.getState()).toMatchObject({ status: 'listo', cms: null, hermano: hermanoUser })
    })
  })

  it('varias peticiones fallando a la vez preguntan una sola vez', async () => {
    const fetchMock = servidor({
      '/contabilidad': () => respuesta({ error: 'No autenticado' }, 401),
      '/auth/me': () => respuesta({ cms: cmsUser, hermano: null }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await Promise.allSettled([
      apiFetch('/contabilidad'),
      apiFetch('/contabilidad?page=2'),
      apiFetch('/contabilidad?page=3'),
    ])

    await waitFor(() => expect(useAuthStore.getState().cms).toEqual(cmsUser))
    const consultasMe = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/auth/me'))
    expect(consultasMe).toHaveLength(1)
  })

  it('si /auth/me también falla, se vacían las dos sesiones en vez de dejarlas a medias', async () => {
    const fetchMock = servidor({
      '/contabilidad': () => respuesta({ error: 'No autenticado' }, 401),
      '/auth/me': () => respuesta({ message: 'Caído' }, 503),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/contabilidad')).rejects.toBeInstanceOf(ApiError)

    await waitFor(() => {
      expect(useAuthStore.getState()).toMatchObject({ status: 'listo', cms: null, hermano: null })
    })
  })

  it('con auth: false (login, el /me del arranque) un 401 no consulta nada ni toca la sesión', async () => {
    const fetchMock = servidor({
      '/auth/login': () => respuesta({ error: 'Credenciales inválidas' }, 401),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/auth/login', { auth: false })).rejects.toBeInstanceOf(ApiError)

    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/auth/me'))).toBe(false)
    expect(useAuthStore.getState().cms).toEqual(cmsUser)
  })
})

// SESION_NO_CMS ya no dispara ningún rescate: con cookies separadas por área
// significa solo «has llegado al CMS sin haber entrado por su acceso», no
// «otra pestaña te ha pisado la cookie». Es un 403 de permisos más.
describe('apiFetch ante un 403', () => {
  it('un 403 (SESION_NO_CMS incluido) no toca la sesión ni consulta /auth/me', async () => {
    const fetchMock = servidor({
      '/contabilidad': () => respuesta({ error: SESION_NO_CMS, message: 'Esta sesión no da acceso al gestor de contenidos.' }, 403),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/contabilidad')).rejects.toMatchObject({ status: 403 })

    expect(useAuthStore.getState()).toMatchObject({ status: 'listo', cms: cmsUser, hermano: null })
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/auth/me'))).toBe(false)
  })
})
