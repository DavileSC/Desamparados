import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import CaminoEstacion from '../CaminoEstacion'
import { actosDelCurso, racimoInicial, racimosDelCurso } from '../racimos'
import type { PanelResponse } from '../../../../lib/api/panel'

type Eventos = PanelResponse['curso']['eventos']
const montar = (hoy: Date, eventos: Eventos = []) =>
  renderWithProviders(<TemaCmsProvider><CaminoEstacion hoy={hoy} eventos={eventos} /></TemaCmsProvider>)

let id = 0
const acto = (fecha: string, title: string, type: Eventos[number]['type'] = 'CULTO'): Eventos[number] =>
  ({ id: ++id, title, startDate: `${fecha}T17:00:00.000Z`, type })

// Octubre amontonado y una Cuaresma casi a diario, como en la maqueta.
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

describe('CaminoEstacion', () => {
  it('dice cuántos días faltan y para qué fecha', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByText('190')).toBeInTheDocument()
    expect(screen.getByText(/Sábado de Pasión · 20 mar 2027/)).toBeInTheDocument()
  })

  it('enseña qué parte del curso ha pasado y cuántos actos quedan', () => {
    montar(new Date(2026, 8, 23), CURSO)
    // Quedan 8 de la Agenda y el Miércoles de Ceniza.
    expect(screen.getByText('50 % del curso · 9 actos por delante')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('el mismo día de la estación no cuenta días de más', () => {
    montar(new Date(2026, 2, 28))
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('lleva la imagen de Nuestra Señora de los Desamparados', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByRole('img', { name: 'Nuestra Señora de los Desamparados' })).toBeInTheDocument()
  })

  it('abre solo el próximo racimo, con todos sus actos', () => {
    montar(new Date(2026, 9, 1), CURSO)
    expect(screen.getByRole('heading', { name: '4 actos · 16 oct – 18 oct' })).toBeInTheDocument()
    const lista = screen.getByRole('list')
    for (const t of ['Triduo · día 1', 'Triduo · día 2', 'Función principal', 'Besamanos']) {
      expect(within(lista).getByText(t)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: '4 actos, 16 oct – 18 oct' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('al pulsar otro racimo, lista los suyos', async () => {
    const usuario = userEvent.setup()
    montar(new Date(2026, 9, 1), CURSO)
    // A 560 px (el ancho de los tests) la Ceniza queda tan cerca que va en el mismo racimo.
    await usuario.click(screen.getByRole('button', { name: '4 actos, 10 feb – 5 mar' }))
    expect(screen.getByRole('heading', { name: '4 actos · 10 feb – 5 mar' })).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getByText('Vía Crucis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4 actos, 16 oct – 18 oct' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('pone la Ceniza aunque no esté en la Agenda, y solo los tipos que hay en la leyenda', () => {
    montar(new Date(2026, 8, 23))
    expect(screen.getByRole('button', { name: '1 acto, 10 feb' })).toBeInTheDocument()
    expect(screen.getByText('Culto')).toBeInTheDocument()
    expect(screen.queryByText('Convivencia')).not.toBeInTheDocument()
  })
})

describe('los racimos del curso', () => {
  const hoy = new Date(2026, 8, 23)
  const actos = actosDelCurso(hoy, CURSO)

  it('cada acto va en su sitio del curso, en orden, y sabe si ya pasó', () => {
    expect(actos.map((a) => a.p)).toEqual([...actos.map((a) => a.p)].sort((a, b) => a - b))
    expect(actos.every((a) => a.p >= 0 && a.p <= 1)).toBe(true)
    expect(actos.find((a) => a.titulo === 'Reunión de la junta')?.pasado).toBe(true)
    expect(actos.find((a) => a.titulo === 'Besamanos')?.pasado).toBe(false)
  })

  it('no duplica la Ceniza si ya está en la Agenda', () => {
    const conCeniza = actosDelCurso(hoy, [acto('2027-02-10', 'Miércoles de Ceniza')])
    expect(conCeniza.filter((a) => /ceniza/i.test(a.titulo))).toHaveLength(1)
  })

  it('el día es el de España: un acto a las 23:30 de Madrid no se va al día siguiente', () => {
    const [noche] = actosDelCurso(hoy, [{ id: 99, title: 'Vigilia', startDate: '2026-10-16T21:30:00.000Z', type: 'CULTO' }])
    expect(noche.fecha.getDate()).toBe(16)
  })

  it('junta los actos a diez días o menos, y ninguno más', () => {
    const racimos = racimosDelCurso(actos, hoy, 2000)
    const tamanos = racimos.map((r) => r.actos.map((a) => a.titulo))
    expect(tamanos).toContainEqual(['Eucaristía de hermandad', 'Reunión de la junta'])
    expect(tamanos).toContainEqual(['Triduo · día 1', 'Triduo · día 2', 'Función principal', 'Besamanos'])
    expect(tamanos).toContainEqual(['Cena de Navidad'])
    expect(racimos.reduce((n, r) => n + r.actos.length, 0)).toBe(actos.length)
  })

  it('en un camino estrecho junta más, para que los números no se pisen', () => {
    const anchos = [1200, 600, 320]
    for (const ancho of anchos) {
      const racimos = racimosDelCurso(actos, hoy, ancho)
      for (let i = 1; i < racimos.length; i++) {
        expect((racimos[i].p - racimos[i - 1].p) * ancho).toBeGreaterThanOrEqual(36)
      }
    }
    expect(racimosDelCurso(actos, hoy, 320).length).toBeLessThan(racimosDelCurso(actos, hoy, 1200).length)
  })

  it('se abre el próximo racimo; si ya no queda ninguno, el último', () => {
    const racimos = racimosDelCurso(actos, hoy, 1200)
    expect(racimos[racimoInicial(racimos)].actos[0].titulo).toBe('Triduo · día 1')
    const alFinal = actosDelCurso(new Date(2027, 2, 19), CURSO)
    const ultimos = racimosDelCurso(alFinal, new Date(2027, 2, 19), 1200)
    expect(racimoInicial(ultimos)).toBe(ultimos.length - 1)
  })
})
