import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import { diaEnMadrid, isoEnMadrid } from '../../../../lib/horaDeMadrid'
import AgendaAdminPage from '../../AgendaAdminPage'
import { actosPorDia, leerMes, rejillaDelMes } from '../calendario'
import { agruparPorMes, cuandoEs, diaDelMes, diaSemana, finEnOtroDia, hora } from '../fechas'
import { enZonaHoraria } from '../../../../test/zonaHoraria'

// Desde Canarias, una hora menos que en Madrid: la vigilia de las 00:30 del 3
// de octubre en Madrid es, allí, las 23:30 del 2. Quien edita la Agenda desde
// allí (o con el portátil en otra zona) la veía en la casilla del 2 y a las
// 23:30, aunque la web pública ya la pinta el 3 a las 00:30.
enZonaHoraria('Atlantic/Canary')
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

const vigilia = {
  id: 1, title: 'Vigilia de la Titular', description: 'Ante la Virgen.', location: 'Parroquia',
  startDate: isoEnMadrid('2026-10-03T00:30'), endDate: null, type: 'CULTO' as const,
}

describe('la Agenda del CMS se lee en hora de Madrid', () => {
  it('el día, la hora y el día de la semana de un acto son los de Madrid', () => {
    const inicio = new Date(vigilia.startDate)
    expect(inicio.getDate()).toBe(2)
    expect(hora(inicio)).toBe('00:30')
    expect(diaDelMes(inicio)).toBe(3)
    expect(diaSemana(inicio)).toBe('sáb')
  })

  it('un acto que acaba pasada la medianoche de Madrid acaba otro día; uno que acaba antes, no', () => {
    const vispera = { startDate: isoEnMadrid('2026-10-02T21:00'), endDate: isoEnMadrid('2026-10-02T23:30') }
    // En Canarias, 20:00 y 22:30 del 2: el mismo día también allí, así que lo que cuenta es el de Madrid.
    expect(finEnOtroDia(vispera)).toBeNull()
    const hastaLaMadrugada = { startDate: isoEnMadrid('2026-10-02T22:00'), endDate: isoEnMadrid('2026-10-03T00:30') }
    expect(finEnOtroDia(hastaLaMadrugada)).not.toBeNull()
  })

  it('la rejilla pide desde la medianoche de Madrid y cada acto cae en su casilla de Madrid', () => {
    const { dias, desde, hasta } = rejillaDelMes(new Date(2026, 9, 1))
    expect(desde.toISOString()).toBe(isoEnMadrid('2026-09-28T00:00'))
    expect(hasta.toISOString()).toBe(isoEnMadrid('2026-11-02T00:00'))
    const porDia = actosPorDia([vigilia], dias)
    expect(porDia.get('2026-10-03')).toHaveLength(1)
    expect(porDia.get('2026-10-02')).toHaveLength(0)
  })

  it('el mes, «hoy» y lo agrupado por meses van por el calendario de Madrid', () => {
    // Las 23:30 del 31 de octubre en Canarias son ya el 1 de noviembre en Madrid.
    const ahora = new Date(isoEnMadrid('2026-11-01T00:30'))
    expect(diaEnMadrid(leerMes('', ahora))).toBe('2026-11-01')
    const deNoviembre = { startDate: isoEnMadrid('2026-11-01T00:15') }
    expect(agruparPorMes([deNoviembre], ahora).map((g) => g.titulo)).toEqual(['Noviembre'])
    expect(cuandoEs(deNoviembre.startDate, ahora)).toBe('hoy')
    expect(cuandoEs(isoEnMadrid('2026-11-02T00:15'), ahora)).toBe('mañana')
    expect(cuandoEs(isoEnMadrid('2026-11-04T00:15'), ahora)).toBe('el miércoles')
    expect(cuandoEs(isoEnMadrid('2026-11-20T00:15'), ahora)).toBe('el 20 de noviembre')
  })

  it('en el mes, el acto sale en su casilla y en el panel con su hora de Madrid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ data: [{ ...vigilia, reparto: false }], resumen: { siguiente: null, portada: { limite: 5, ids: [] } } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))))
    const usuario = userEvent.setup()
    renderWithProviders(<TemaCmsProvider><AgendaAdminPage /></TemaCmsProvider>, { ruta: '/cms/agenda?mes=2026-10' })

    await usuario.click(await screen.findByRole('button', { name: /^sábado, 3 de octubre, 1 acto/i }))
    const panel = screen.getByRole('region', { name: 'Actos del 3 de octubre' })
    expect(within(panel).getByRole('heading', { name: 'Vigilia de la Titular' })).toBeInTheDocument()
    expect(within(panel).getByText('00:30 · Parroquia')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^viernes, 2 de octubre, sin actos/i })).toBeInTheDocument()
  })
})
