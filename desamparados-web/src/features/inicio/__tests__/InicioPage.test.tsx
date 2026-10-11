import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import theme from '../../../theme'
import { renderWithProviders } from '../../../test/test-utils'
import InicioPage from '../InicioPage'
import { sembrarContacto } from '../../../test/queryClient'

afterEach(() => { vi.unstubAllGlobals() })

describe('InicioPage', () => {
  it('ordena los bloques con la agenda antes que la banda del Sábado de Pasión', () => {
    // Lo útil primero: hero, noticias y agenda; después los accesos, la banda
    // emocional y las publicaciones. Sin datos de la API los bloques siguen
    // montando su sección, así que el orden se puede leer igual.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const { container } = renderWithProviders(<HelmetProvider><InicioPage /></HelmetProvider>)

    const secciones = [...container.querySelectorAll('section[aria-labelledby]')].map((s) => s.getAttribute('aria-labelledby'))
    expect(secciones).toEqual([
      'hero-title',
      'actualidad-titulo',
      'agenda-title',
      'quick-access-title',
      'procession-title',
      'publicaciones-titulo',
    ])
  })

  it('con todos los módulos apagados no ofrece noticias, agenda, publicaciones ni «Hazte hermano», y no las pide', async () => {
    const fetchSimulado = vi.fn().mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchSimulado)
    const { container } = renderWithProviders(<HelmetProvider><InicioPage /></HelmetProvider>, { modulos: [] })
    // Lo que se fuera a pedir se pide al montar: un instante basta para verlo.
    await new Promise((r) => setTimeout(r, 50))

    const secciones = [...container.querySelectorAll('section[aria-labelledby]')].map((s) => s.getAttribute('aria-labelledby'))
    expect(secciones).not.toContain('actualidad-titulo')
    expect(secciones).not.toContain('agenda-title')
    expect(secciones).not.toContain('publicaciones-titulo')
    expect(container.querySelector('a[href="/hazte-hermano"]')).toBeNull()
    expect(container.querySelector('a[href="/publicaciones/boletines"]')).toBeNull()
    expect(container.querySelector('a[href="/agenda"]')).toBeNull()
    const pedidas = fetchSimulado.mock.calls.map(([url]) => String(url))
    for (const ruta of ['/news', '/events', '/publications']) {
      expect(pedidas.filter((u) => u.includes(ruta)), ruta).toEqual([])
    }
  })

  it('mientras no se sabe qué módulos hay, las secciones pintan su esqueleto y no piden nada todavía', async () => {
    // Sin sembrar: el QueryClient no tiene la lista de módulos y el fetch de
    // /modulos no resuelve nunca, así que `activos` se queda en `null` todo el
    // tiempo (como el instante real entre montar la portada y que llegue la
    // respuesta). Las secciones no pueden dar un salto de altura en ese hueco.
    const fetchSimulado = vi.fn((url: RequestInfo | URL) => (
      String(url).includes('/modulos')
        ? new Promise<Response>(() => {})
        : Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    ))
    vi.stubGlobal('fetch', fetchSimulado)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // Los datos de contacto sí, como los deja `App.tsx` pedidos al arrancar:
    // esta prueba va de los módulos, y el `[]` del fetch no es una respuesta
    // de /corporacion.
    sembrarContacto(queryClient)

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <HelmetProvider>
              <InicioPage />
            </HelmetProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('status', { name: 'Cargando las noticias' })).toBeInTheDocument()
    expect(await screen.findByRole('status', { name: 'Cargando las publicaciones' })).toBeInTheDocument()
    expect(await screen.findByRole('status', { name: 'Cargando la agenda' })).toBeInTheDocument()

    const pedidas = fetchSimulado.mock.calls.map(([url]) => String(url))
    for (const ruta of ['/news', '/events', '/publications']) {
      expect(pedidas.filter((u) => u.includes(ruta)), ruta).toEqual([])
    }
  })

  it('con todo encendido, la tesela «Hazte hermano» y el enlace a la Agenda siguen', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const { container } = renderWithProviders(<HelmetProvider><InicioPage /></HelmetProvider>)
    expect(container.querySelector('a[href="/hazte-hermano"]')).not.toBeNull()
    expect(container.querySelector('a[href="/publicaciones/boletines"]')).not.toBeNull()
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === '/agenda')).toBe(true)
  })
})
