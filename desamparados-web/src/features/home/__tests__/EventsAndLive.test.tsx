import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import EventsAndLive from '../EventsAndLive'
import { site } from '../../../config/site'
import type { ApiEvent } from '../../../lib/api/events'

function evento(parcial: Partial<ApiEvent> & Pick<ApiEvent, 'id' | 'title' | 'startDate'>): ApiEvent {
  return { description: null, location: null, endDate: null, visibility: 'public', type: 'CULTO', ...parcial }
}

// Las horas van a mediodía UTC: así el día no cambia sea cual sea la zona horaria del equipo.
const APERTURA = evento({ id: 1, title: 'Eucaristía de apertura de curso', description: 'Acción de gracias.', startDate: '2026-10-15T12:00:00.000Z' })
// `site` es de solo lectura para el tipo, no en ejecución: los tests lo cambian para simular un directo publicado.
const directo = site.directo as { urlAlternativa: string | null }

const TRIDUO = evento({ id: 2, title: 'Solemne triduo', description: 'Rosario y eucaristía.', startDate: '2026-10-20T12:00:00.000Z', endDate: '2026-10-22T12:00:00.000Z' })

/** La API responde igual a las dos peticiones de la sección: el próximo acto (`limit=1`) y la ventana de dos meses. */
function servirEventos(eventos: ApiEvent[]) {
  const fetchMock = vi.fn(async (url: string) => {
    const lista = new URL(url, 'http://localhost').searchParams.get('limit') === '1' ? eventos.slice(0, 1) : eventos
    return new Response(
      JSON.stringify({ data: lista, meta: { total: lista.length, page: 1, limit: 100, totalPages: 1 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 5, 12))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  directo.urlAlternativa = null
})

describe('EventsAndLive', () => {
  it('sigue pintando los próximos eventos con la respuesta paginada', async () => {
    // Regresión: al pasar /api/events a {data, meta}, esta sección de la
    // portada se queda en blanco si sigue leyendo la respuesta como un array.
    servirEventos([evento({ id: 1, title: 'Besapiés', location: 'Parroquia', startDate: '2026-10-12T12:00:00.000Z' })])
    renderWithProviders(<EventsAndLive />)
    expect(await screen.findByRole('button', { name: /besapiés/i })).toBeInTheDocument()
  })

  it('abre el calendario en el mes del próximo acto y marca todos los días de un acto largo', async () => {
    // Se rompe si el triduo solo marca su primer día, o si un día sin actos se vuelve pulsable.
    servirEventos([APERTURA, TRIDUO])
    renderWithProviders(<EventsAndLive />)

    expect(await screen.findByText('Octubre 2026')).toBeInTheDocument()
    // Los días se vuelven pulsables cuando llega la ventana de actos, un momento después del mes.
    await screen.findByRole('button', { name: /20 de octubre, 1 acto/ })
    for (const dia of [20, 21, 22]) {
      expect(screen.getByRole('button', { name: new RegExp(`${dia} de octubre, 1 acto`) })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /19 de octubre/ })).not.toBeInTheDocument()
  })

  it('despliega el próximo acto y, al pulsar un día, abre el suyo', async () => {
    servirEventos([APERTURA, TRIDUO])
    renderWithProviders(<EventsAndLive />)

    const apertura = await screen.findByRole('button', { name: /eucaristía de apertura/i })
    const triduo = screen.getByRole('button', { name: /solemne triduo/i })
    expect(apertura).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Acción de gracias.')).toBeInTheDocument()
    expect(triduo).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Rosario y eucaristía.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /21 de octubre/ }))

    expect(triduo).toHaveAttribute('aria-expanded', 'true')
    expect(apertura).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Rosario y eucaristía.')).toBeInTheDocument()
    expect(screen.queryByText('Acción de gracias.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /21 de octubre/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('al cambiar de mes pide a la API la ventana de ese mes y el siguiente', async () => {
    // Se rompe si la navegación solo mueve la rejilla sin traer los actos del mes nuevo,
    // o si deja volver a meses ya pasados.
    const fetchMock = servirEventos([APERTURA, TRIDUO])
    renderWithProviders(<EventsAndLive />)

    await screen.findByText('Octubre 2026')
    expect(screen.getByRole('button', { name: /mes anterior/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /mes siguiente/i }))

    expect(await screen.findByText('Noviembre 2026')).toBeInTheDocument()
    await waitFor(() => {
      const ultima = new URL(String(fetchMock.mock.lastCall?.[0]), 'http://localhost').searchParams
      expect(ultima.get('from')).toBe(new Date(2026, 10, 1).toISOString())
      expect(ultima.get('to')).toBe(new Date(2027, 0, 1).toISOString())
    })
  })

  it('solo enseña el aviso de directo cuando hay retransmisión configurada', async () => {
    servirEventos([APERTURA])
    const { unmount } = renderWithProviders(<EventsAndLive />)
    await screen.findByRole('button', { name: /eucaristía de apertura/i })
    expect(screen.queryByRole('link', { name: /ver en directo/i })).not.toBeInTheDocument()
    unmount()

    directo.urlAlternativa = 'https://www.youtube.com/live/ejemplo'
    renderWithProviders(<EventsAndLive />)
    expect(await screen.findByRole('link', { name: /ver en directo/i })).toHaveAttribute('href', 'https://www.youtube.com/live/ejemplo')
  })
})
