import { describe, it, expect, vi, afterEach } from 'vitest'
import { HelmetProvider } from 'react-helmet-async'
import { renderWithProviders } from '../../../test/test-utils'
import InicioPage from '../InicioPage'

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
})
