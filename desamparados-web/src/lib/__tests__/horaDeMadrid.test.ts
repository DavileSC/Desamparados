import { describe, it, expect } from 'vitest'
import { aCampoFechaMadrid, comienzoEnMadrid, diaDelCalendario, diaEnMadrid, fechaEnMadrid, horaEnMadrid, hoyDelCalendario, instanteEnMadrid, isoEnMadrid } from '../horaDeMadrid'
import { enZonaHoraria } from '../../test/zonaHoraria'

// Desde Canarias, una hora menos que en Madrid todo el año: el caso que se
// escapaba. Con la zona del equipo de pruebas (Madrid en local, UTC en el CI)
// estas pruebas no distinguirían entre leer en Madrid y leer en local.
enZonaHoraria('Atlantic/Canary')

describe('horaDeMadrid', () => {
  it('la hora escrita es la de Madrid, con su horario de invierno y de verano', () => {
    expect(instanteEnMadrid('2027-03-20T18:00')).toBe(Date.UTC(2027, 2, 20, 17, 0))
    expect(instanteEnMadrid('2026-07-01T18:00')).toBe(Date.UTC(2026, 6, 1, 16, 0))
    expect(instanteEnMadrid('mañana')).toBeNull()
    expect(isoEnMadrid('2027-03-08T18:00')).toBe('2027-03-08T17:00:00.000Z')
    expect(() => isoEnMadrid('')).toThrow('El día y la hora no son válidos.')
  })

  it('la madrugada de los dos domingos del cambio de hora se guarda y se lee con la hora escrita', () => {
    // 28-03-2027 (Domingo de Resurrección): a las 02:00 de Madrid pasan a ser
    // las 03:00, así que la 01:30 es aún de invierno (UTC+1).
    expect(isoEnMadrid('2027-03-28T01:30')).toBe('2027-03-28T00:30:00.000Z')
    // 31-10-2027: a las 03:00 vuelven a ser las 02:00, así que la 01:30 es aún
    // de verano (UTC+2) y cae el sábado 30 en UTC.
    expect(isoEnMadrid('2027-10-31T01:30')).toBe('2027-10-30T23:30:00.000Z')
    // Al reabrir la ficha sale lo mismo que se escribió, también a cada lado
    // del cambio.
    for (const escrita of ['2027-03-28T00:30', '2027-03-28T01:30', '2027-03-28T03:30', '2027-10-31T00:30', '2027-10-31T01:30', '2027-10-31T03:30']) {
      expect(aCampoFechaMadrid(isoEnMadrid(escrita))).toBe(escrita)
    }
  })

  it('al volver al formulario sale la misma hora que se escribió, no la de este equipo', () => {
    expect(new Date('2027-03-08T17:00:00.000Z').getHours()).toBe(17)
    expect(diaEnMadrid('2027-03-08T17:00:00.000Z')).toBe('2027-03-08')
    expect(horaEnMadrid('2027-03-08T17:00:00.000Z')).toBe('18:00')
    expect(aCampoFechaMadrid(isoEnMadrid('2026-10-31T23:30'))).toBe('2026-10-31T23:30')
  })

  it('los calendarios ponen cada acto, y el hoy, en su día de Madrid', () => {
    // Las 23:30 del 2 en Canarias son las 00:30 del 3 en Madrid.
    const instante = isoEnMadrid('2026-10-03T00:30')
    expect(diaDelCalendario(instante)).toEqual(new Date(2026, 9, 3))
    expect(hoyDelCalendario(new Date(instante))).toEqual(new Date(2026, 9, 3))
    expect(fechaEnMadrid(instante, { weekday: 'long', day: 'numeric', month: 'long' })).toBe('sábado, 3 de octubre')
    // Y lo que se pide a la API, desde la medianoche de Madrid.
    expect(comienzoEnMadrid(new Date(2026, 9, 3)).toISOString()).toBe('2026-10-02T22:00:00.000Z')
  })
})
