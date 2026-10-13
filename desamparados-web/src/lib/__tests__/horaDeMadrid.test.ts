import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { aCampoFechaMadrid, comienzoEnMadrid, diaDelCalendario, diaEnMadrid, fechaEnMadrid, horaEnMadrid, hoyDelCalendario, instanteEnMadrid, isoEnMadrid } from '../horaDeMadrid'

// Desde Canarias, una hora menos que en Madrid todo el año: el caso que se
// escapaba. Con la zona del equipo de pruebas (Madrid en local, UTC en el CI)
// estas pruebas no distinguirían entre leer en Madrid y leer en local.
const zonaDeAntes = process.env.TZ
beforeAll(() => { process.env.TZ = 'Atlantic/Canary' })
afterAll(() => { process.env.TZ = zonaDeAntes })

describe('horaDeMadrid', () => {
  it('la hora escrita es la de Madrid, con su horario de invierno y de verano', () => {
    expect(instanteEnMadrid('2027-03-20T18:00')).toBe(Date.UTC(2027, 2, 20, 17, 0))
    expect(instanteEnMadrid('2026-07-01T18:00')).toBe(Date.UTC(2026, 6, 1, 16, 0))
    expect(instanteEnMadrid('mañana')).toBeNull()
    expect(isoEnMadrid('2027-03-08T18:00')).toBe('2027-03-08T17:00:00.000Z')
    expect(() => isoEnMadrid('')).toThrow('El día y la hora no son válidos.')
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
