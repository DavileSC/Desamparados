import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import AgendaYDirecto from '../AgendaYDirecto'
import type { ApiEvent } from '../../../lib/api/agenda'
import { responderPortada, textosDePrueba } from './ayudas'
import { isoEnMadrid } from '../../../lib/horaDeMadrid'

function evento(parcial: Partial<ApiEvent> & Pick<ApiEvent, 'id' | 'title' | 'startDate'>): ApiEvent {
  return { description: null, location: null, endDate: null, type: 'CULTO', ...parcial }
}

// Las horas van a mediodía UTC: así el día no cambia sea cual sea la zona horaria del equipo.
const APERTURA = evento({ id: 1, title: 'Eucaristía de apertura de curso', description: 'Acción de gracias.', startDate: '2026-10-15T12:00:00.000Z' })

const TRIDUO = evento({ id: 2, title: 'Solemne triduo', description: 'Rosario y eucaristía.', startDate: '2026-10-20T12:00:00.000Z', endDate: '2026-10-22T12:00:00.000Z' })

/** La API de actos: con `limit=1` (el BloquePrograma y otros), solo el primero; si no, todos. */
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
})

describe('AgendaYDirecto', () => {
  it('sigue pintando los próximos eventos con la respuesta paginada', async () => {
    // Regresión: al pasar /api/events a {data, meta}, esta sección de la
    // portada se queda en blanco si sigue leyendo la respuesta como un array.
    servirEventos([evento({ id: 1, title: 'Besapiés', location: 'Parroquia', startDate: '2026-10-12T12:00:00.000Z' })])
    renderWithProviders(<AgendaYDirecto />)
    expect(await screen.findByRole('button', { name: /besapiés/i })).toBeInTheDocument()
  })

  it('abre el calendario en el mes del próximo acto y marca todos los días de un acto largo', async () => {
    // Se rompe si el triduo solo marca su primer día, o si un día sin actos se vuelve pulsable.
    servirEventos([APERTURA, TRIDUO])
    renderWithProviders(<AgendaYDirecto />)

    expect(await screen.findByLabelText('Octubre 2026')).toBeInTheDocument()
    // Los días se vuelven pulsables cuando llega la ventana de actos, un momento después del mes.
    await screen.findByRole('button', { name: /20 de octubre, 1 acto/ })
    for (const dia of [20, 21, 22]) {
      expect(screen.getByRole('button', { name: new RegExp(`${dia} de octubre, 1 acto`) })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /19 de octubre/ })).not.toBeInTheDocument()
  })

  it('lo primero que se ve sale de una sola petición de actos, no de dos en cadena', async () => {
    const fetchMock = servirEventos([APERTURA, TRIDUO])
    renderWithProviders(<AgendaYDirecto />)
    await screen.findByRole('button', { name: /20 de octubre, 1 acto/ })
    const deActos = fetchMock.mock.calls.filter(([url]) => String(url).includes('/events'))
    expect(deActos).toHaveLength(1)
    expect(new URL(String(deActos[0][0]), 'http://localhost').searchParams.get('from')).toBe(isoEnMadrid('2026-10-05T00:00'))
  })

  it('despliega el próximo acto y, al pulsar un día, abre el suyo', async () => {
    servirEventos([APERTURA, TRIDUO])
    renderWithProviders(<AgendaYDirecto />)

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
    renderWithProviders(<AgendaYDirecto />)

    await screen.findByLabelText('Octubre 2026')
    expect(screen.getByRole('button', { name: /mes anterior/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /mes siguiente/i }))

    expect(await screen.findByLabelText('Noviembre 2026')).toBeInTheDocument()
    await waitFor(() => {
      const ultima = new URL(String(fetchMock.mock.lastCall?.[0]), 'http://localhost').searchParams
      expect(ultima.get('from')).toBe(isoEnMadrid('2026-11-01T00:00'))
      expect(ultima.get('to')).toBe(isoEnMadrid('2027-01-01T00:00'))
    })
  })

  it('enseña los textos de la agenda que vienen del CMS', async () => {
    const textos = textosDePrueba()
    textos.agenda = {
      ceja: 'Vida litúrgica',
      titulo: 'Próximos cultos',
      parrafo: 'Un párrafo distinto sobre la vida de oración.',
      enlace: 'Ver toda la agenda',
      imagenUrl: '/images/procesion.jpg',
    }
    responderPortada(textos)

    renderWithProviders(<AgendaYDirecto />)

    expect(await screen.findByText('Vida litúrgica')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Próximos cultos' })).toBeInTheDocument()
    expect(screen.getByText('Un párrafo distinto sobre la vida de oración.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver toda la agenda/i })).toBeInTheDocument()
  })

  it('pone de fondo la foto elegida en el CMS, y ninguna si se quita', async () => {
    // Un <img> velado, con sus copias de 640 y 1280 (FR11).
    const fondo = (contenedor: HTMLElement) => contenedor.querySelector<HTMLImageElement>('img[aria-hidden="true"]')?.getAttribute('src') ?? undefined
    const textos = textosDePrueba()
    textos.agenda = { ...textos.agenda, imagenUrl: '/storage/public/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.webp' }
    responderPortada(textos)
    const { container, unmount } = renderWithProviders(<AgendaYDirecto />)
    await waitFor(() => expect(fondo(container)).toBe('/storage/public/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.webp'))
    expect(container.querySelector('img[aria-hidden="true"]')).toHaveAttribute('srcset', expect.stringContaining('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6-640.webp 640w'))
    unmount()

    responderPortada({ ...textos, agenda: { ...textos.agenda, imagenUrl: '' } })
    const otra = renderWithProviders(<AgendaYDirecto />)
    // Mientras llega la portada se ve la foto de partida: hay que esperar a la guardada.
    await waitFor(() => expect(fondo(otra.container)).toBeUndefined())
  })
})

describe('AgendaYDirecto desde otra zona horaria', () => {
  // Desde Canarias, una hora menos que en Madrid: con la zona del equipo de
  // pruebas (Madrid en local, UTC en el CI) no se distinguiría leer en Madrid
  // de leer en local.
  const zonaDeAntes = process.env.TZ
  beforeAll(() => { process.env.TZ = 'Atlantic/Canary' })
  afterAll(() => { process.env.TZ = zonaDeAntes })

  it('el día, la hora y el «desde hoy» son los de Madrid', async () => {
    // A las 00:30 del 15 en Madrid; en Canarias, las 23:30 del 14.
    const vigilia = evento({ id: 3, title: 'Vigilia de la Titular', startDate: isoEnMadrid('2026-10-15T00:30') })
    const fetchMock = servirEventos([vigilia])
    renderWithProviders(<AgendaYDirecto />)

    const fila = await screen.findByRole('button', { name: /vigilia de la titular/i })
    expect(fila).toHaveTextContent('15')
    expect(fila).toHaveTextContent('00:30')
    expect(await screen.findByRole('button', { name: /15 de octubre, 1 acto/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /14 de octubre/ })).not.toBeInTheDocument()
    // Se piden los actos desde la medianoche de Madrid, no desde la de Canarias.
    const deActos = fetchMock.mock.calls.filter(([url]) => String(url).includes('/events'))
    expect(new URL(String(deActos[0][0]), 'http://localhost').searchParams.get('from')).toBe(isoEnMadrid('2026-10-05T00:00'))
  })
})
