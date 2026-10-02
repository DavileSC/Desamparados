import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useModulos } from '../useModulos'
import { llamarApi } from '../../lib/api/cliente'
import { crearQueryClientDePruebas } from '../../test/queryClient'

const json = (cuerpo: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }))

const envoltorioCon = (cliente: QueryClient) => ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>

afterEach(() => { vi.unstubAllGlobals() })

describe('useModulos', () => {
  it('sin la lista todavía, lo que también vale con el núcleo está activo, como en `cumple` y `ExigeModulo`', () => {
    // La lista no llega nunca: así se ve el instante en que aún no se sabe.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useModulos(), { wrapper: envoltorioCon(cliente) })

    expect(result.current.activos).toBeNull()
    expect(result.current.activo('nucleo')).toBe(true)
    expect(result.current.activo(['nucleo', 'tienda'])).toBe(true)
    expect(result.current.activo('tienda')).toBe(false)
  })

  it('un 404 de módulo apagado hace que vuelva a pedir la lista: lo que Administración apagó desde otra sesión deja de verse', async () => {
    // El servidor ya tiene la Tienda apagada; esta sesión aún la tiene en su lista.
    vi.stubGlobal('fetch', vi.fn((url: string) => (String(url).endsWith('/modulos')
      ? json({ activos: ['noticias'] })
      : json({ status: 'error', error: 'MODULO_NO_ACTIVADO', modulo: 'tienda', message: 'El módulo «Tienda» no está activado en esta instalación.' }, 404))))
    const cliente = crearQueryClientDePruebas(['noticias', 'tienda'])
    const { result } = renderHook(() => useModulos(), { wrapper: envoltorioCon(cliente) })
    expect(result.current.activo('tienda')).toBe(true)

    await expect(llamarApi('/tienda/productos', { auth: false })).rejects.toThrow(/no está activado/)

    await waitFor(() => expect(result.current.activo('tienda')).toBe(false))
    expect(result.current.activo('noticias')).toBe(true)
  })
})
