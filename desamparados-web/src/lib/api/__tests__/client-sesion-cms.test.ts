import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { apiFetch, ApiError } from '../client'
import { useAuthStore, type AuthUser } from '../../../features/members/auth/store'

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const admin = (origen: 'cms' | 'hermanos'): AuthUser => ({
  id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen,
})

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
  useAuthStore.setState({ status: 'autenticado', user: admin('cms') })
})

afterEach(() => { vi.unstubAllGlobals() })

// Otra pestaña entra por el área de hermanos y la cookie del CMS se sustituye:
// cada petición del CMS abierto recibe un 403 con este código.
describe('apiFetch ante una sesión que ya no es del CMS', () => {
  it('rehace el estado con la sesión que tiene ahora la cookie', async () => {
    const fetchMock = servidor({
      '/news/admin': () => respuesta({ error: 'SESION_NO_CMS', message: 'Esta sesión no da acceso al gestor de contenidos.' }, 403),
      '/auth/me': () => respuesta({ user: admin('hermanos') }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/news/admin')).rejects.toBeInstanceOf(ApiError)

    // Con origen hermanos, el guarda del CMS lleva al acceso y este explica por qué.
    await waitFor(() => expect(useAuthStore.getState().user?.origen).toBe('hermanos'))
    expect(useAuthStore.getState().status).toBe('autenticado')
  })

  it('si la cookie ya no es de nadie, queda como invitado', async () => {
    vi.stubGlobal('fetch', servidor({
      '/news/admin': () => respuesta({ error: 'SESION_NO_CMS', message: '…' }, 403),
      '/auth/me': () => respuesta({ error: 'NO_TOKEN_PROVIDED' }, 401),
    }))

    await expect(apiFetch('/news/admin')).rejects.toBeInstanceOf(ApiError)
    await waitFor(() => expect(useAuthStore.getState().status).toBe('invitado'))
  })

  it('varias peticiones fallando a la vez preguntan una sola vez', async () => {
    const fetchMock = servidor({
      '/news/admin': () => respuesta({ error: 'SESION_NO_CMS', message: '…' }, 403),
      '/auth/me': () => respuesta({ user: admin('hermanos') }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await Promise.allSettled([apiFetch('/news/admin'), apiFetch('/news/admin?page=2'), apiFetch('/news/admin?page=3')])
    await waitFor(() => expect(useAuthStore.getState().user?.origen).toBe('hermanos'))
    const consultasMe = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/auth/me'))
    expect(consultasMe).toHaveLength(1)
  })

  it('un 403 de permisos normal no toca la sesión', async () => {
    const fetchMock = servidor({
      '/contabilidad': () => respuesta({ error: 'No tienes permisos para realizar esta acción' }, 403),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/contabilidad')).rejects.toMatchObject({ status: 403 })
    expect(useAuthStore.getState()).toMatchObject({ status: 'autenticado', user: admin('cms') })
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/auth/me'))).toBe(false)
  })
})
