import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import ElCurso from '../ElCurso'
import { actosDelCurso, calmaCorta, cuandoFalta, momentoDelCurso, tandaInicial, tandasDelCurso } from '../tandas'
import type { PanelResponse } from '../../../../lib/api/panel'

type Eventos = PanelResponse['curso']['eventos']

let id = 0
const acto = (fecha: string, title: string, type: Eventos[number]['type'] = 'CULTO'): Eventos[number] =>
  ({ id: ++id, title, startDate: `${fecha}T17:00:00.000Z`, type })

// Tandas y calma: la vuelta en septiembre, el Triduo de octubre y una Cuaresma
// con la Ceniza suelta, a casi tres semanas del resto.
const CURSO: Eventos = [
  acto('2026-04-19', 'Misa de acción de gracias'),
  acto('2026-09-15', 'Eucaristía de hermandad'),
  acto('2026-09-19', 'Reunión de la junta', 'REUNION'),
  acto('2026-10-16', 'Triduo · día 1'),
  acto('2026-10-17', 'Triduo · día 2'),
  acto('2026-10-18', 'Función principal'),
  acto('2026-10-18', 'Besamanos'),
  acto('2026-12-19', 'Cena de Navidad', 'SOCIAL'),
  acto('2027-03-01', 'Reparto de papeletas', 'REUNION'),
  acto('2027-03-03', 'Ensayo de hombres de trono', 'ENSAYO'),
  acto('2027-03-05', 'Vía Crucis'),
]

const montar = (hoy: Date, eventos: Eventos = []) =>
  renderWithProviders(<TemaCmsProvider><ElCurso hoy={hoy} actos={actosDelCurso(hoy, eventos)} /></TemaCmsProvider>)

describe('ElCurso', () => {
  it('enseña qué parte del curso ha pasado y cuántos actos quedan', () => {
    montar(new Date(2026, 8, 23), CURSO)
    // Quedan 8 de la Agenda y el Miércoles de Ceniza.
    expect(screen.getByText('50 % recorrido · 9 actos por delante')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Curso recorrido' })).toHaveAttribute('aria-valuenow', '50')
  })

  it('después del próximo acto (que va aparte, en grande), lista lo que viene, con su hora', () => {
    montar(new Date(2026, 8, 23), CURSO)
    const lista = screen.getByRole('list')
    expect(within(lista).queryByText('Triduo · día 1')).not.toBeInTheDocument()
    expect(within(lista).getByText('Triduo · día 2')).toBeInTheDocument()
    expect(within(lista).getByText('Vía Crucis')).toBeInTheDocument()
    expect(within(lista).queryByText('Reunión de la junta')).not.toBeInTheDocument() // ya pasó
    expect(within(lista).getAllByText('19:00').length).toBeGreaterThan(0)
  })

  it('sin nada más por delante, lo dice', () => {
    montar(new Date(2027, 2, 4), CURSO)
    expect(screen.getByText('Nada más hasta la estación de penitencia.')).toBeInTheDocument()
  })
})

describe('las tandas del curso', () => {
  const hoy = new Date(2026, 8, 23)
  const actos = actosDelCurso(hoy, CURSO)
  const tandas = tandasDelCurso(actos, hoy)

  it('cada acto va en su sitio del curso, en orden, y sabe si ya pasó', () => {
    expect(actos.map((a) => a.p)).toEqual([...actos.map((a) => a.p)].sort((a, b) => a - b))
    expect(actos.every((a) => a.p >= 0 && a.p <= 1)).toBe(true)
    expect(actos.find((a) => a.titulo === 'Reunión de la junta')?.pasado).toBe(true)
    expect(actos.find((a) => a.titulo === 'Besamanos')?.pasado).toBe(false)
  })

  it('cada acto lleva su hora en España y su lugar; a medianoche no hay hora', () => {
    const [tarde, todoElDia] = actosDelCurso(hoy, [
      { id: 97, title: 'Triduo', startDate: '2026-10-16T17:00:00.000Z', type: 'CULTO', location: 'Parroquia' },
      { id: 98, title: 'Jornada de puertas abiertas', startDate: '2026-10-17T22:00:00.000Z', type: 'SOCIAL' },
    ])
    expect([tarde.hora, tarde.lugar]).toEqual(['19:00', 'Parroquia'])
    expect([todoElDia.hora, todoElDia.lugar]).toEqual([null, null])
  })

  it('no duplica la Ceniza si ya está en la Agenda', () => {
    const conCeniza = actosDelCurso(hoy, [acto('2027-02-10', 'Miércoles de Ceniza')])
    expect(conCeniza.filter((a) => /ceniza/i.test(a.titulo))).toHaveLength(1)
  })

  it('el día es el de España: un acto a las 23:30 de Madrid no se va al día siguiente', () => {
    const [noche] = actosDelCurso(hoy, [{ id: 99, title: 'Vigilia', startDate: '2026-10-16T21:30:00.000Z', type: 'CULTO' }])
    expect(noche.fecha.getDate()).toBe(16)
  })

  it('dos semanas sin actos abren otra tanda; desde la Ceniza, todo es Cuaresma', () => {
    expect(tandas.map((t) => [t.nombre, t.actos.length])).toEqual([
      ['Abril', 1], ['Septiembre', 2], ['Octubre', 4], ['Diciembre', 1], ['Cuaresma', 4],
    ])
    expect(tandas.reduce((n, t) => n + t.actos.length, 0)).toBe(actos.length)
  })

  it('una tanda que cruza de mes se llama por los dos', () => {
    const cruzada = tandasDelCurso(actosDelCurso(hoy, [acto('2026-09-28', 'Uno'), acto('2026-10-04', 'Dos')]), hoy)
    expect(cruzada[0].nombre).toBe('Sep – oct')
  })

  it('dos tandas del mismo mes no se llaman igual: van por sus días', () => {
    const dobles = tandasDelCurso(actosDelCurso(hoy, [acto('2026-11-01', 'Uno'), acto('2026-11-02', 'Dos'), acto('2026-11-28', 'Tres')]), hoy)
    expect(dobles.slice(0, 2).map((t) => t.nombre)).toEqual(['1–2 nov', '28 nov'])
  })

  it('sabe si estamos en plena tanda, en calma o sin nada por delante', () => {
    expect(momentoDelCurso(tandas)).toMatchObject({ tipo: 'calma', tanda: { nombre: 'Octubre' } })
    const enOctubre = new Date(2026, 9, 17)
    expect(momentoDelCurso(tandasDelCurso(actosDelCurso(enOctubre, CURSO), enOctubre))).toMatchObject({ tipo: 'plena', quedan: 3 })
    const alFinal = new Date(2027, 2, 19)
    const ultimas = tandasDelCurso(actosDelCurso(alFinal, CURSO), alFinal)
    expect(momentoDelCurso(ultimas)).toEqual({ tipo: 'fin' })
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
