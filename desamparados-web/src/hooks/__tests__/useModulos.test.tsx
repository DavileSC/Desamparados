import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useModulos } from '../useModulos'

afterEach(() => { vi.unstubAllGlobals() })

describe('useModulos', () => {
  it('sin la lista todavía, lo que también vale con el núcleo está activo, como en `cumple` y `ExigeModulo`', () => {
    // La lista no llega nunca: así se ve el instante en que aún no se sabe.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useModulos(), { wrapper: envoltorio })

    expect(result.current.activos).toBeNull()
    expect(result.current.activo('nucleo')).toBe(true)
    expect(result.current.activo(['nucleo', 'tienda'])).toBe(true)
    expect(result.current.activo('tienda')).toBe(false)
  })
})
