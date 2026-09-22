import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import ActualidadPage from '../ActualidadPage'
import { stubFetchPublico } from '../../../test/fetchPublico'

const evento = {
  id: 1, title: 'Besapiés', description: null, location: 'Parroquia',
  startDate: '2026-09-12T18:00:00.000Z', endDate: null, visibility: 'public', type: 'CULTO',
}
const noticia = {
  id: 7, slug: 'triduo-de-septiembre', titulo: 'Triduo de septiembre', extracto: 'Tres jornadas.',
  contenido: 'Cuerpo de la noticia.', imagenUrl: null, fecha: '2026-09-01T00:00:00.000Z', visible: true,
}

/**
 * La pantalla pide dos extremos distintos, así que las respuestas se enrutan
 * por la URL (nunca por la posición en mock.calls) y cada llamada recibe su
 * propia instancia de Response: `llamarApi` consume el cuerpo con `res.text()`.
 */
function responder() {
  const simulado = vi.fn().mockImplementation((url: RequestInfo | URL) => {
    const cuerpo = String(url).includes('/events')
      ? { data: [evento], meta: { total: 1, page: 1, limit: 4, totalPages: 1 } }
      : [noticia]
    return Promise.resolve(new Response(
      JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
  })
  stubFetchPublico(simulado)
  return simulado
}

afterEach(() => { vi.unstubAllGlobals() })

describe('ActualidadPage', () => {
  it('sigue pintando los próximos eventos con la respuesta paginada', async () => {
    // Regresión: al pasar /api/events a {data, meta}, esta sección de
    // actualidad se queda en blanco si sigue leyendo la respuesta como un
    // array. Es el consumidor que nadie mira.
    const simulado = responder()
    renderWithProviders(<ActualidadPage />)

    expect(await screen.findByText(/besapiés/i)).toBeInTheDocument()
    expect(screen.getByText(/triduo de septiembre/i)).toBeInTheDocument()
    // El recorte lo hace el servidor: actualidad no pagina, solo pide los que caben.
    const urls = simulado.mock.calls.map((llamada) => String(llamada[0]))
    expect(urls.some((url) => url.includes('/events?limit=4'))).toBe(true)
  })
})
