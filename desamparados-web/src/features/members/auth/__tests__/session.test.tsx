import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuthStore } from '../store'
import { useCargarSesion, ESPERAS_REINTENTO_MS } from '../session'

const hermano = {
  id: 1,
  email: 'test@test.com',
  role: 'USER',
  perfiles: [{ id: 10, nombre: 'Test', esTitular: true, puesto: null }],
}

describe('useCargarSesion', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'cargando', cms: null, hermano: null })
    localStorage.setItem('desamparados-auth', '{"state":{"token":"viejo"}}')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('deja lista la sesión de hermano cuando /me la devuelve', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ cms: null, hermano }), { status: 200 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(useAuthStore.getState().status).toBe('listo'))
    expect(useAuthStore.getState().hermano).toEqual(hermano)
  })

  it('sin ninguna sesión abierta, /me responde 200 igualmente y queda listo sin nadie', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ cms: null, hermano: null }), { status: 200 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(useAuthStore.getState()).toMatchObject({ status: 'listo', cms: null, hermano: null }))
  })

  it('un 429 pasajero en /me no expulsa: reintenta y deja la sesión lista', async () => {
    // El 11-09-2026 el limitador global devolvió 429 a /me y el arranque lo
    // trataba como «no hay sesión»: el editor acababa en el login con la
    // cookie todavía válida. Se rompe si vuelve a vaciar las sesiones por eso.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const simulado = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Demasiadas peticiones' }), { status: 429 }))
      .mockResolvedValue(new Response(JSON.stringify({ cms: null, hermano }), { status: 200 }))

    renderHook(() => useCargarSesion())
    await vi.advanceTimersByTimeAsync(ESPERAS_REINTENTO_MS[0])

    await waitFor(() => expect(useAuthStore.getState().status).toBe('listo'))
    expect(simulado).toHaveBeenCalledTimes(2)
    expect(useAuthStore.getState().hermano).toEqual(hermano)
    vi.useRealTimers()
  })

  it('si el servidor sigue sin responder tras los reintentos, queda listo y sin sesión', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const simulado = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ message: 'Caído' }), { status: 503 })))

    renderHook(() => useCargarSesion())
    await vi.advanceTimersByTimeAsync(ESPERAS_REINTENTO_MS.reduce((a, b) => a + b, 0))

    await waitFor(() => expect(useAuthStore.getState()).toMatchObject({ status: 'listo', cms: null, hermano: null }))
    expect(simulado).toHaveBeenCalledTimes(ESPERAS_REINTENTO_MS.length + 1)
    vi.useRealTimers()
  })

  // /auth/me ya no manda 401 (siempre 200, con { cms, hermano }), pero si algún
  // día lo hiciera, `esPasajero` no lo trata como pasajero: no debe reintentarlo
  // como si fuera un 429 o un 5xx pasajero.
  it('un 401 no se reintenta: no es de los fallos pasajeros', async () => {
    const simulado = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'NO_TOKEN_PROVIDED' }), { status: 401 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(useAuthStore.getState()).toMatchObject({ status: 'listo', cms: null, hermano: null }))
    expect(simulado).toHaveBeenCalledTimes(1)
  })

  it('borra el token que zustand/persist dejaba en el navegador', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ cms: null, hermano: null }), { status: 200 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(localStorage.getItem('desamparados-auth')).toBeNull())
  })
})
