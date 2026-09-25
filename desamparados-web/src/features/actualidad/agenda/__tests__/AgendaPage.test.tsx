import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import AgendaPage from '../AgendaPage'
import { stubFetchPublico } from '../../../../test/fetchPublico'

// Horas locales, como las ve quien entra.
const en = (dia: string, hora: string) => new Date(`${dia}T${hora}`).toISOString()
const apertura = {
  id: 1, title: 'Eucaristía de apertura de curso', description: null, location: 'Parroquia de los Padres Pasionistas',
  startDate: en('2026-09-29', '19:00'), endDate: null, type: 'CULTO', cartel: false,
}
const catequesis = {
  id: 2, title: 'Catequesis de adultos', description: null, location: null,
  startDate: en('2026-10-08', '19:00'), endDate: null, type: 'FORMACION', cartel: false,
}
const triduo = {
  id: 3, title: 'Solemne triduo', description: 'Santo rosario, ejercicio del triduo y santa misa.', location: 'Parroquia de los Padres Pasionistas',
  startDate: en('2026-11-03', '19:00'), endDate: en('2026-11-05', '20:00'), type: 'CULTO',
  cartel: true, dedicatoria: 'en honor de Nuestra Señora de los Desamparados', fotoCartel: null,
}
const cabildo = {
  id: 4, title: 'Cabildo de hermanos', description: null, location: 'Salón parroquial',
  startDate: en('2026-11-23', '19:00'), endDate: null, type: 'REUNION', cartel: false,
}

function responder(data: unknown[]) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data, meta: { total: data.length, page: 1, limit: 100, totalPages: 1 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  stubFetchPublico(simulado)
  return simulado
}

afterEach(() => { vi.unstubAllGlobals() })

describe('AgendaPage', () => {
  it('pide todo lo que viene de una vez, sin paginar', async () => {
    const simulado = responder([apertura])
    renderWithProviders(<AgendaPage />)

    expect(await screen.findByText('Eucaristía de apertura de curso')).toBeInTheDocument()
    expect(String(simulado.mock.calls[0]?.[0])).toContain('/events?limit=100')
    expect(screen.queryByRole('button', { name: /ir a la página 2/i })).not.toBeInTheDocument()
  })

  it('los cultos solemnes salen en su cartel, entre la lista de lo demás', async () => {
    responder([apertura, catequesis, triduo, cabildo])
    renderWithProviders(<AgendaPage />)

    const cartel = await screen.findByRole('article', { name: 'Solemne triduo' })
    expect(within(cartel).getByText('Culto solemne')).toBeInTheDocument()
    expect(within(cartel).getByText('en honor de Nuestra Señora de los Desamparados')).toBeInTheDocument()
    expect(within(cartel).getByText('Días 3, 4 y 5 de noviembre')).toBeInTheDocument()
    // Sin foto propia, la de la Titular.
    expect(within(cartel).getByRole('img')).toHaveAttribute('src', '/images/triduo.jpg')

    const antes = screen.getByRole('region', { name: 'Próximamente' })
    expect(within(antes).getByText('Eucaristía de apertura de curso')).toBeInTheDocument()
    expect(within(antes).getByText('29 de septiembre, martes')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Y además' })).getByText('Cabildo de hermanos')).toBeInTheDocument()
  })

  it('cada acto se añade al calendario y, si tiene lugar, lleva al mapa', async () => {
    responder([apertura, catequesis])
    renderWithProviders(<AgendaPage />)

    const calendario = await screen.findByRole('link', { name: 'Añadir a mi calendario: Eucaristía de apertura de curso' })
    expect(calendario).toHaveAttribute('href', '/api/events/1/ics')
    const mapa = screen.getByRole('link', { name: 'Cómo llegar: Parroquia de los Padres Pasionistas' })
    expect(mapa.getAttribute('href')).toContain(encodeURIComponent('Parroquia de los Padres Pasionistas, Málaga'))
    expect(mapa).toHaveAttribute('target', '_blank')
    // La catequesis no tiene lugar: no hay a dónde llegar.
    expect(screen.getAllByRole('link', { name: /^cómo llegar/i })).toHaveLength(1)
  })

  it('los filtros dejan ver solo una parte, y la dirección lo recuerda', async () => {
    responder([apertura, catequesis, triduo, cabildo])
    const usuario = userEvent.setup()
    renderWithProviders(<AgendaPage />, { ruta: '/agenda?ver=formacion' })

    expect(await screen.findByText('Catequesis de adultos')).toBeInTheDocument()
    expect(screen.queryByText('Cabildo de hermanos')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Formación' })).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(screen.getByRole('button', { name: 'Cultos y salidas' }))
    expect(screen.getByRole('article', { name: 'Solemne triduo' })).toBeInTheDocument()
    expect(screen.queryByText('Catequesis de adultos')).not.toBeInTheDocument()
  })

  it('la suscripción ofrece Google, el enlace webcal y copiarlo', async () => {
    responder([apertura])
    const usuario = userEvent.setup()
    renderWithProviders(<AgendaPage />)

    await usuario.click(await screen.findByRole('button', { name: 'Suscribirse a la agenda' }))
    const webcal = screen.getByRole('link', { name: 'iPhone, Mac y Outlook' })
    expect(webcal.getAttribute('href')).toMatch(/^webcal:\/\/.+\/api\/events\/calendario\.ics$/)
    expect(screen.getByRole('link', { name: 'Google Calendar' }).getAttribute('href')).toContain(encodeURIComponent(webcal.getAttribute('href')!))
    expect(screen.getByRole('button', { name: 'Copiar el enlace' })).toBeInTheDocument()
  })

  it('sin actos lo dice, y si la agenda falla también', async () => {
    responder([])
    const { unmount } = renderWithProviders(<AgendaPage />)
    expect(await screen.findByText('No hay actos anunciados por ahora.')).toBeInTheDocument()
    unmount()

    stubFetchPublico(() => Promise.resolve(new Response(JSON.stringify({ message: 'La agenda no responde.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })))
    renderWithProviders(<AgendaPage />)
    expect(await screen.findByText(/la agenda no responde/i)).toBeInTheDocument()
  })
})
