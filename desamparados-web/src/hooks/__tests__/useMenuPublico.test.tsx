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

  it('pone los nombres del CMS cuando llegan; si /menu falla, se queda con los de siempre', async () => {
    const responder = (menu: 'bien' | 'mal') => vi.fn(async (url: string) => {
      if (url.endsWith('/modulos')) return new Response(JSON.stringify({ activos: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (menu === 'mal') throw new TypeError('Failed to fetch')
      return new Response(JSON.stringify({ nombres: { '/': 'Portada' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    const pintar = () => {
      const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
      return renderHook(() => useMenuPublico(), { wrapper: envoltorio })
    }

    vi.stubGlobal('fetch', responder('bien'))
    const bien = pintar()
    await waitFor(() => expect(bien.result.current[0]?.label).toBe('Portada'))

    vi.stubGlobal('fetch', responder('mal'))
    const mal = pintar()
    await waitFor(() => expect(mal.result.current[0]?.label).toBe('Inicio'))
  })
})
