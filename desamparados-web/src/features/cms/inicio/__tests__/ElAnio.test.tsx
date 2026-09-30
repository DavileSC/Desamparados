import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import ElAnio from '../ElAnio'
import { actosDelAnio, calmaCorta, cuandoFalta, momentoDelAnio, parteDelAnio, tandaInicial, tandasDelAnio } from '../tandas'
import type { PanelResponse } from '../../../../lib/api/panel'

type Eventos = PanelResponse['anio']['eventos']

let id = 0
const acto = (fecha: string, title: string, type: Eventos[number]['type'] = 'CULTO'): Eventos[number] =>
  ({ id: ++id, title, startDate: `${fecha}T17:00:00.000Z`, type })

// Un año del Grupo: la Cuaresma (con la Ceniza del 18 de febrero, que se añade
// sola), una misa en abril, la vuelta en septiembre, el Triduo de octubre y la
// cena de Navidad.
const ANIO: Eventos = [
  acto('2026-03-10', 'Reparto de papeletas', 'REUNION'),
  acto('2026-03-12', 'Ensayo de hombres de trono', 'ENSAYO'),
  acto('2026-03-13', 'Vía Crucis'),
  acto('2026-04-19', 'Misa de acción de gracias'),
  acto('2026-09-15', 'Eucaristía de apertura'),
  acto('2026-09-19', 'Reunión de la junta', 'REUNION'),
  acto('2026-10-16', 'Triduo · día 1'),
  acto('2026-10-17', 'Triduo · día 2'),
  acto('2026-10-18', 'Función principal'),
  acto('2026-10-18', 'Besamanos'),
  acto('2026-12-19', 'Cena de Navidad', 'SOCIAL'),
]

const montar = (hoy: Date, eventos: Eventos = []) =>
  renderWithProviders(<TemaCmsProvider><ElAnio hoy={hoy} actos={actosDelAnio(hoy, eventos)} /></TemaCmsProvider>)

describe('ElAnio', () => {
  it('enseña qué parte del año ha pasado y cuántos actos quedan', () => {
    montar(new Date(2026, 8, 23), ANIO)
    expect(screen.getByRole('heading', { name: 'El año 2026' })).toBeInTheDocument()
    // Del 1 de enero al 23 de septiembre van 265 de 365 días; quedan el Triduo, la Función, el Besamanos y la cena.
    expect(screen.getByText('73 % recorrido · 5 actos por delante')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Año recorrido' })).toHaveAttribute('aria-valuenow', '73')
  })

  it('después del próximo acto (que va aparte, en grande), lista lo que viene, con su hora', () => {
    montar(new Date(2026, 8, 23), ANIO)
    const lista = screen.getByRole('list')
    expect(within(lista).queryByText('Triduo · día 1')).not.toBeInTheDocument()
    expect(within(lista).getByText('Triduo · día 2')).toBeInTheDocument()
    expect(within(lista).getByText('Cena de Navidad')).toBeInTheDocument()
    expect(within(lista).queryByText('Reunión de la junta')).not.toBeInTheDocument() // ya pasó
    expect(within(lista).getAllByText('19:00').length).toBeGreaterThan(0)
  })

  it('sin nada más por delante, lo dice', () => {
    montar(new Date(2026, 11, 20), ANIO)
    expect(screen.getByText('Nada más este año.')).toBeInTheDocument()
  })
})

describe('las tandas del año', () => {
  const hoy = new Date(2026, 8, 23)
  const actos = actosDelAnio(hoy, ANIO)
  const tandas = tandasDelAnio(actos, hoy)

  it('el año va del 1 de enero al 31 de diciembre', () => {
    expect(parteDelAnio(new Date(2026, 0, 1))).toBe(0)
    expect(parteDelAnio(new Date(2026, 6, 2))).toBe(50)
    expect(parteDelAnio(new Date(2026, 11, 31))).toBe(100)
    // Un acto del año que viene no entra.
    expect(actosDelAnio(hoy, [acto('2027-01-06', 'Reyes')]).some((a) => a.titulo === 'Reyes')).toBe(false)
  })

  it('cada acto va en su sitio del año, en orden, y sabe si ya pasó', () => {
    expect(actos.map((a) => a.p)).toEqual([...actos.map((a) => a.p)].sort((a, b) => a - b))
    expect(actos.every((a) => a.p >= 0 && a.p < 1)).toBe(true)
    expect(actos.find((a) => a.titulo === 'Reunión de la junta')?.pasado).toBe(true)
    expect(actos.find((a) => a.titulo === 'Besamanos')?.pasado).toBe(false)
  })

  it('cada acto lleva su hora en España y su lugar; a medianoche no hay hora', () => {
    const [tarde, todoElDia] = actosDelAnio(hoy, [
      { id: 97, title: 'Triduo', startDate: '2026-10-16T17:00:00.000Z', type: 'CULTO', location: 'Parroquia' },
      { id: 98, title: 'Jornada de puertas abiertas', startDate: '2026-10-17T22:00:00.000Z', type: 'SOCIAL' },
    ]).filter((a) => !/ceniza/i.test(a.titulo))
    expect([tarde.hora, tarde.lugar]).toEqual(['19:00', 'Parroquia'])
    expect([todoElDia.hora, todoElDia.lugar]).toEqual([null, null])
  })

  it('no duplica la Ceniza si ya está en la Agenda', () => {
    const conCeniza = actosDelAnio(hoy, [acto('2026-02-18', 'Miércoles de Ceniza')])
    expect(conCeniza.filter((a) => /ceniza/i.test(a.titulo))).toHaveLength(1)
  })

  it('el día es el de España: un acto a las 23:30 de Madrid no se va al día siguiente', () => {
    const noche = actosDelAnio(hoy, [{ id: 99, title: 'Vigilia', startDate: '2026-10-16T21:30:00.000Z', type: 'CULTO' }]).find((a) => a.titulo === 'Vigilia')!
    expect(noche.fecha.getDate()).toBe(16)
  })

  it('dos semanas sin actos abren otra tanda; desde la Ceniza, todo es Cuaresma', () => {
    expect(tandas.map((t) => [t.nombre, t.actos.length])).toEqual([
      ['Cuaresma', 4], ['Abril', 1], ['Septiembre', 2], ['Octubre', 4], ['Diciembre', 1],
    ])
    expect(tandas.reduce((n, t) => n + t.actos.length, 0)).toBe(actos.length)
  })

  it('una tanda que cruza de mes se llama por los dos', () => {
    const cruzada = tandasDelAnio(actosDelAnio(hoy, [acto('2026-09-28', 'Uno'), acto('2026-10-04', 'Dos')]), hoy)
    expect(cruzada.at(-1)?.nombre).toBe('Sep – oct')
  })

  it('dos tandas del mismo mes no se llaman igual: van por sus días', () => {
    const dobles = tandasDelAnio(actosDelAnio(hoy, [acto('2026-11-01', 'Uno'), acto('2026-11-02', 'Dos'), acto('2026-11-28', 'Tres')]), hoy)
    expect(dobles.slice(-2).map((t) => t.nombre)).toEqual(['1–2 nov', '28 nov'])
  })

  it('sabe si estamos en plena tanda, en calma o sin nada por delante', () => {
    expect(momentoDelAnio(tandas)).toMatchObject({ tipo: 'calma', tanda: { nombre: 'Octubre' } })
    const enOctubre = new Date(2026, 9, 17)
    expect(momentoDelAnio(tandasDelAnio(actosDelAnio(enOctubre, ANIO), enOctubre))).toMatchObject({ tipo: 'plena', quedan: 3 })
    const alFinal = new Date(2026, 11, 31)
    const ultimas = tandasDelAnio(actosDelAnio(alFinal, ANIO), alFinal)
    expect(momentoDelAnio(ultimas)).toEqual({ tipo: 'fin' })
    expect(tandaInicial(ultimas)).toBe(ultimas.length - 1)
  })

  it('se abre la tanda de ahora o la próxima', () => {
    expect(tandas[tandaInicial(tandas)].nombre).toBe('Octubre')
  })

  it('dice cuánto falta y cuánto dura la calma en palabras', () => {
    expect(cuandoFalta(hoy, new Date(2026, 8, 24))).toBe('mañana')
    expect(cuandoFalta(hoy, new Date(2026, 8, 30))).toBe('en 7 días')
    expect(cuandoFalta(hoy, new Date(2026, 10, 1))).toBe('en 6 semanas')
    expect(cuandoFalta(hoy, new Date(2027, 1, 10))).toBe('en 5 meses')
    expect(calmaCorta(27)).toBe('4 sem.')
    expect(calmaCorta(147)).toBe('5 meses')
  })
})
