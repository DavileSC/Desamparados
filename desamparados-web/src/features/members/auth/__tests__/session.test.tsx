import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuthStore } from '../store'
import { useCargarSesion, ESPERAS_REINTENTO_MS } from '../session'

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

  it('un 429 pasajero en /me no expulsa: reintenta y deja autenticado', async () => {
    // El 11-09-2026 el limitador global devolvió 429 a /me y el arranque lo
    // trataba como «no hay sesión»: el editor acababa en el login con la
    // cookie todavía válida. Se rompe si vuelve a pasar por «invitado».
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const simulado = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Demasiadas peticiones' }), { status: 429 }))
      .mockResolvedValue(new Response(JSON.stringify({ user }), { status: 200 }))
    const estados: string[] = []
    const dejarDeEscuchar = useAuthStore.subscribe((estado) => { estados.push(estado.status) })

    renderHook(() => useCargarSesion())
    await vi.advanceTimersByTimeAsync(ESPERAS_REINTENTO_MS[0])

    await waitFor(() => expect(useAuthStore.getState().status).toBe('autenticado'))
    expect(simulado).toHaveBeenCalledTimes(2)
    expect(estados).not.toContain('invitado')
    dejarDeEscuchar()
    vi.useRealTimers()
  })

  it('si el servidor sigue sin responder tras los reintentos, queda como invitado', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const simulado = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ message: 'Caído' }), { status: 503 })))

    renderHook(() => useCargarSesion())
    await vi.advanceTimersByTimeAsync(ESPERAS_REINTENTO_MS.reduce((a, b) => a + b, 0))

    await waitFor(() => expect(useAuthStore.getState().status).toBe('invitado'))
    expect(simulado).toHaveBeenCalledTimes(ESPERAS_REINTENTO_MS.length + 1)
    vi.useRealTimers()
  })

  it('un 401 no se reintenta: es la respuesta definitiva de «no hay sesión»', async () => {
    const simulado = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'NO_TOKEN_PROVIDED' }), { status: 401 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(useAuthStore.getState().status).toBe('invitado'))
    expect(simulado).toHaveBeenCalledTimes(1)
  })

  it('borra el token que zustand/persist dejaba en el navegador', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'NO_TOKEN_PROVIDED' }), { status: 401 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(localStorage.getItem('desamparados-auth')).toBeNull())
  })
})
