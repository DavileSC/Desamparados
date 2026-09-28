import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
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

const mes = (nombre: string) => screen.findByRole('heading', { name: nombre })
const dia = (nombre: RegExp) => screen.findByRole('button', { name: nombre })

// El calendario abre en el mes de hoy como mínimo: hoy es el 26 de septiembre de 2026.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 26, 12))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('AgendaPage', () => {
  it('pide todo lo que viene de una vez y lo enseña en el mes del próximo acto, sin filtros', async () => {
    const simulado = responder([apertura, catequesis])
    renderWithProviders(<AgendaPage />)

    expect(await mes('Septiembre 2026')).toBeInTheDocument()
    expect(await dia(/^29 de septiembre: Eucaristía de apertura de curso/)).toBeInTheDocument()
    expect(String(simulado.mock.calls[0]?.[0])).toContain('/events?limit=100')
    expect(screen.queryByRole('group', { name: 'Qué ver' })).not.toBeInTheDocument()
    // Sin la cabecera grande: el título de la página queda para buscadores y lectores.
    expect(screen.getByRole('heading', { level: 1, name: 'Agenda' })).toBeInTheDocument()
  })

  it('al pulsar un día, el acto sale en una ventana con su calendario', async () => {
    responder([apertura, catequesis])
    const usuario = userEvent.setup()
    renderWithProviders(<AgendaPage />)

    await usuario.click(await dia(/^29 de septiembre/))
    const ventana = screen.getByRole('dialog', { name: 'Eucaristía de apertura de curso' })
    expect(within(ventana).getByText('Culto')).toBeInTheDocument()
    expect(within(ventana).getByText('Martes 29 de septiembre, a las 19:00')).toBeInTheDocument()
    expect(within(ventana).getByRole('link', { name: 'Añadir a mi calendario: Eucaristía de apertura de curso' })).toHaveAttribute('href', '/api/events/1/ics')
    expect(within(ventana).getByText('Parroquia de los Padres Pasionistas.')).toBeInTheDocument()
    // Ni «Cómo llegar» ni pasar de acto: solo el acto y su calendario.
    expect(within(ventana).queryByRole('link', { name: /^cómo llegar/i })).not.toBeInTheDocument()
    expect(within(ventana).queryByRole('button', { name: /siguiente|anterior/i })).not.toBeInTheDocument()

    await usuario.click(within(ventana).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await usuario.click(await dia(/^29 de septiembre/))
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('el próximo acto va marcado, y la leyenda lo dice y lo abre', async () => {
    responder([apertura, catequesis])
    const usuario = userEvent.setup()
    renderWithProviders(<AgendaPage />)

    expect(await dia(/^29 de septiembre: .*\. Próximo acto$/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: /^Próximo acto: Eucaristía de apertura de curso, martes 29 de septiembre$/ }))
    expect(screen.getByRole('dialog', { name: 'Eucaristía de apertura de curso' })).toBeInTheDocument()
  })

  it('se pasa de mes con las flechas, y los solemnes enseñan su foto', async () => {
    responder([apertura, catequesis, triduo, cabildo])
    const usuario = userEvent.setup()
    renderWithProviders(<AgendaPage />)

    await mes('Septiembre 2026')
    // Cada botón dice a qué mes lleva.
    expect(screen.getByRole('button', { name: 'Mes siguiente: Octubre' })).toHaveTextContent('Octubre')
    expect(screen.getByRole('button', { name: /^Mes anterior/ })).toBeDisabled()
    await usuario.click(screen.getByRole('button', { name: /^Mes siguiente/ }))
    expect(await mes('Octubre 2026')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: /^Mes siguiente/ }))
    expect(await mes('Noviembre 2026')).toBeInTheDocument()
    // El cabildo es lo último: no hay más meses.
    expect(screen.getByRole('button', { name: /^Mes siguiente/ })).toBeDisabled()

    // El triduo es una sola tarjeta de sus tres días.
    expect(screen.queryByRole('button', { name: /^4 de noviembre/ })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: /^3 al 5 de noviembre: Solemne triduo$/ }))
    const ventana = screen.getByRole('dialog', { name: 'Solemne triduo' })
    expect(within(ventana).getByText('Culto solemne')).toBeInTheDocument()
    expect(within(ventana).getByText('en honor de Nuestra Señora de los Desamparados')).toBeInTheDocument()
    expect(within(ventana).getByText('Días 3, 4 y 5 de noviembre, a las 19:00')).toBeInTheDocument()
    // Sin foto propia, la de la Titular.
    expect(within(ventana).getByRole('img')).toHaveAttribute('src', '/images/triduo.jpg')
  })

  it('si dos actos coinciden, cada día lleva una línea por acto', async () => {
    const otroTriduo = { ...triduo, id: 5, title: 'Triduo a la Virgen', cartel: false, startDate: en('2026-11-05', '19:00'), endDate: en('2026-11-06', '20:00') }
    responder([triduo, otroTriduo, cabildo])
    const usuario = userEvent.setup()
    renderWithProviders(<AgendaPage />)

    await mes('Noviembre 2026')
    // Ya no son tarjetas de varios días: el 5 tiene los dos.
    expect(screen.queryByRole('button', { name: /^3 al 5 de noviembre/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5 de noviembre: Solemne triduo' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: '5 de noviembre: Triduo a la Virgen' }))
    expect(screen.getByRole('dialog', { name: 'Triduo a la Virgen' })).toBeInTheDocument()
    // El cabildo va solo: sigue siendo su tarjeta.
    expect(screen.getByRole('button', { name: '23 de noviembre: Cabildo de hermanos' })).toBeInTheDocument()
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
    expect(await screen.findByText(/No se ha podido cargar la agenda/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /volver a intentar/i })).toBeInTheDocument()
  })
})
