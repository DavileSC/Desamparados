import { describe, it, expect } from 'vitest'
import {
  cuantoFalta, cuando, diaDelAnio, diasEnPalabras, esVerano, estadoDelDespacho, momentoEnMadrid, proximaMisa,
} from '../horario'
import type { BloqueHorario } from '../../../lib/api/contenido'

const HORARIO: BloqueHorario = {
  tipo: 'horario', titulo: '',
  misas: [
    { etiqueta: 'Lunes a sábado', dias: [1, 2, 3, 4, 5, 6], horas: ['09:30', '19:00'], horasVerano: ['09:30', '20:00'] },
    { etiqueta: 'Domingos y festivos', dias: [0], horas: ['10:00', '12:00'], horasVerano: [] },
  ],
  despacho: [{ dias: [2, 5], desde: '18:00', hasta: '20:00' }],
  verano: { desde: '07-01', hasta: '08-31' },
  lineas: [],
}

/** Un instante dado en hora de Madrid (en otoño e invierno, UTC+1; en verano, UTC+2). */
const madrid = (iso: string, desfase = '+02:00') => new Date(`${iso}${desfase}`)

describe('el reloj de Málaga', () => {
  it('da el día y la hora de Madrid, se mire desde donde se mire', () => {
    // Sábado 26-09-2026 a las 17:00 de Madrid son las 15:00 UTC.
    expect(momentoEnMadrid(new Date('2026-09-26T15:00:00Z'))).toEqual({ dia: 6, minutos: 17 * 60, mesDia: '09-26' })
  })

  it('el verano va de principio a fin y puede cruzar el año', () => {
    expect(esVerano(HORARIO.verano, '07-01')).toBe(true)
    expect(esVerano(HORARIO.verano, '08-31')).toBe(true)
    expect(esVerano(HORARIO.verano, '09-01')).toBe(false)
    expect(esVerano({ desde: '12-15', hasta: '01-10' }, '01-05')).toBe(true)
    expect(esVerano({ desde: '', hasta: '' }, '08-01')).toBe(false)
  })
})

describe('la próxima misa', () => {
  it('la de hoy por la tarde, con lo que falta', () => {
    const misa = proximaMisa(HORARIO, madrid('2026-09-26T16:50:00'))
    expect(misa).toMatchObject({ enDias: 0, minutos: 19 * 60, faltan: 130, enCurso: false })
  })

  it('mientras se celebra, es la de ahora', () => {
    expect(proximaMisa(HORARIO, madrid('2026-09-26T19:20:00'))).toMatchObject({ minutos: 19 * 60, enCurso: true })
  })

  it('pasada la última, la de mañana, que es domingo', () => {
    expect(proximaMisa(HORARIO, madrid('2026-09-26T21:00:00'))).toMatchObject({ enDias: 1, dia: 0, minutos: 10 * 60 })
  })

  it('en verano, la de la tarde es a las 20:00', () => {
    expect(proximaMisa(HORARIO, madrid('2026-07-15T18:00:00'))).toMatchObject({ enDias: 0, minutos: 20 * 60 })
  })

  it('la víspera del verano, la de mañana ya va con el horario de verano', () => {
    // Martes 30-06-2026 a las 21:00: la siguiente es el miércoles 1 de julio a las 9:30, y tras ella la de las 20:00.
    expect(proximaMisa(HORARIO, madrid('2026-06-30T21:00:00'))).toMatchObject({ enDias: 1, minutos: 9 * 60 + 30 })
  })

  it('el día que se cambia la hora no se salta ningún día', () => {
    // Sábado 28-03-2026 a las 23:30 (UTC+1); esa noche se adelanta el reloj. La siguiente es el domingo a las 10:00.
    expect(proximaMisa(HORARIO, madrid('2026-03-28T23:30:00', '+01:00'))).toMatchObject({ enDias: 1, dia: 0, minutos: 10 * 60 })
  })
})

describe('el despacho', () => {
  it('abierto ahora, hasta su hora', () => {
    // Martes 29-09-2026 a las 18:30.
    expect(estadoDelDespacho(HORARIO.despacho, madrid('2026-09-29T18:30:00'))).toEqual({ abierto: true, hasta: 20 * 60 })
  })

  it('cerrado, con el día y la hora en que abre', () => {
    expect(estadoDelDespacho(HORARIO.despacho, madrid('2026-09-26T12:00:00'))).toEqual({ abierto: false, enDias: 3, dia: 2, desde: 18 * 60 })
    expect(estadoDelDespacho(HORARIO.despacho, madrid('2026-09-29T20:00:00'))).toMatchObject({ abierto: false, dia: 5 })
  })

  it('sin turnos no dice nada', () => {
    expect(estadoDelDespacho([], new Date())).toBeNull()
  })
})

describe('en palabras', () => {
  it('los días como en un tablón', () => {
    expect(diasEnPalabras([1, 2, 3, 4, 5, 6])).toBe('lunes a sábado')
    expect(diasEnPalabras([2, 5])).toBe('martes y viernes')
    expect(diasEnPalabras([0])).toBe('domingos')
    expect(diasEnPalabras([6])).toBe('sábados')
    expect(diasEnPalabras([0, 1, 2, 3, 4, 5, 6])).toBe('todos los días')
    expect(diasEnPalabras([6, 0])).toBe('sábado y domingo')
  })

  it('cuándo y cuánto falta', () => {
    expect(cuando(0, 6)).toBe('hoy')
    expect(cuando(1, 0)).toBe('mañana')
    expect(cuando(3, 2)).toBe('el martes')
    expect(cuantoFalta(25)).toBe('dentro de 25 min')
    expect(cuantoFalta(130)).toBe('dentro de 2 h 10 min')
    expect(cuantoFalta(120)).toBe('dentro de 2 h')
    expect(cuantoFalta(2000)).toBe('')
    expect(diaDelAnio('07-01')).toBe('1 de julio')
  })
})
