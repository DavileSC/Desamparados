import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuthStore } from '../store'
import { useCargarSesion } from '../session'

const user = {
  id: 1,
  email: 'test@test.com',
  role: 'USER',
  perfiles: [{ id: 10, nombre: 'Test', esTitular: true, puesto: null }],
}

describe('useCargarSesion', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'cargando', user: null })
    localStorage.setItem('desamparados-auth', '{"state":{"token":"viejo"}}')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('deja autenticado cuando /me responde con usuario', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user }), { status: 200 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(useAuthStore.getState().status).toBe('autenticado'))
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('deja invitado cuando /me responde 401, sin tratarlo como error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'NO_TOKEN_PROVIDED' }), { status: 401 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(useAuthStore.getState().status).toBe('invitado'))
  })

  it('borra el token que zustand/persist dejaba en el navegador', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'NO_TOKEN_PROVIDED' }), { status: 401 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(localStorage.getItem('desamparados-auth')).toBeNull())
  })
})
