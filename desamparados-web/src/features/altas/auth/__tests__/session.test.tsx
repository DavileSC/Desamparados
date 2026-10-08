import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuthStore } from '../store'
import { QueryClient } from '@tanstack/react-query'
import { useCargarSesion, ESPERAS_REINTENTO_MS, vaciarCacheAlCambiarDeUsuario } from '../session'

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

// FR7 de la auditoría del 07-10-2026: con el almacenamiento bloqueado,
// tocar localStorage lanza y la limpieza del arranque tumbaba la web entera.
describe('useCargarSesion con el almacenamiento bloqueado', () => {
  beforeEach(() => { useAuthStore.setState({ status: 'cargando', cms: null, hermano: null }) })
  afterEach(() => { vi.restoreAllMocks() })

  it('arranca igual y deja la sesión lista', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Bloqueado', 'SecurityError') })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ cms: null, hermano }), { status: 200 }))

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(useAuthStore.getState().hermano).toEqual(hermano))
  })
})

// FR2 de la auditoría del 07-10-2026: las claves de React Query no llevan el
// usuario, así que en la misma pestaña el siguiente hermano veía al momento
// los certificados del anterior (['mis-certificados'] seguía fresca).
describe('vaciarCacheAlCambiarDeUsuario', () => {
  const otro = { ...hermano, id: 2, email: 'otro@test.com' }
  let queryClient: QueryClient
  let dejar: () => void

  beforeEach(() => {
    useAuthStore.setState({ status: 'listo', cms: null, hermano, cmsCaducada: false })
    queryClient = new QueryClient()
    queryClient.setQueryData(['mis-certificados'], ['del primero'])
    dejar = vaciarCacheAlCambiarDeUsuario(queryClient)
  })
  afterEach(() => { dejar() })

  it('cerrar sesión vacía la caché', () => {
    useAuthStore.getState().salirSesion('hermanos')
    expect(queryClient.getQueryData(['mis-certificados'])).toBeUndefined()
  })

  it('entrar con otro usuario la vacía', () => {
    useAuthStore.getState().entrarSesion('hermanos', otro)
    expect(queryClient.getQueryData(['mis-certificados'])).toBeUndefined()
  })

  it('volver a confirmar la misma sesión (el /me tras un 401) no la toca', () => {
    useAuthStore.getState().ponerSesiones({ cms: null, hermano })
    expect(queryClient.getQueryData(['mis-certificados'])).toEqual(['del primero'])
  })

  it('entrar desde invitado no la toca: no había datos de nadie', () => {
    useAuthStore.setState({ hermano: null })
    queryClient.setQueryData(['mis-certificados'], ['publico'])
    useAuthStore.getState().entrarSesion('hermanos', hermano)
    expect(queryClient.getQueryData(['mis-certificados'])).toEqual(['publico'])
  })
})
