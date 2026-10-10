import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMenuPublico } from '../useMenuPublico'

afterEach(() => { vi.unstubAllGlobals() })

describe('useMenuPublico', () => {
  it('si la lista de módulos no llega, deja lo del núcleo en vez de quedarse sin menú', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useMenuPublico(), { wrapper: envoltorio })
    expect(result.current).toEqual([])
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0))
    expect(result.current.every((e) => e.modulo === 'nucleo')).toBe(true)
    expect(result.current.map((e) => e.label)).toContain('Inicio')
  })
})
