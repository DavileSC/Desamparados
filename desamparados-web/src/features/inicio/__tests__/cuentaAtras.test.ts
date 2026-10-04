import { describe, it, expect } from 'vitest'
import { cuentaDeLaPortada, partesQueFaltan } from '../cuentaAtras'

// 5 de octubre de 2026, a mediodía en Madrid (UTC+2).
const AHORA = Date.parse('2026-10-05T10:00:00Z')
const PASION = { nombre: 'Sábado de Pasión', articulo: 'el' as const, dia: '2027-03-20', hora: '18:00' }

describe('la cuenta atrás de la portada', () => {
  it('a su hora de Madrid: el Sábado de Pasión a las 18:00 son las 17:00 UTC en invierno', () => {
    expect(cuentaDeLaPortada(PASION, AHORA)?.instante).toBe(Date.parse('2027-03-20T17:00:00Z'))
  })

  it('días, horas, minutos y segundos con hora', () => {
    const rosario = cuentaDeLaPortada({ ...PASION, nombre: 'Rosario vespertino', dia: '2026-10-11', hora: '20:00' }, AHORA)!
    expect(partesQueFaltan(rosario, AHORA)).toEqual({ dias: 6, horas: 8, minutos: 0, segundos: 0 })
  })

  it('sin hora de salida, solo los días, contados de calendario', () => {
    const p = cuentaDeLaPortada({ ...PASION, dia: '2026-10-08', hora: null }, AHORA)!
    expect(p.conHora).toBe(false)
    expect(partesQueFaltan(p, AHORA)).toEqual({ dias: 3, horas: 0, minutos: 0, segundos: 0 })
  })

  it('el día de la salida es «hoy» aunque ya haya salido, y una ya pasada no se cuenta', () => {
    const deHoy = { ...PASION, dia: '2026-10-05', hora: '09:00' }
    expect(cuentaDeLaPortada(deHoy, AHORA)?.hoy).toBe(true)
    expect(cuentaDeLaPortada({ ...PASION, dia: '2026-10-04' }, AHORA)).toBeNull()
    expect(cuentaDeLaPortada(null, AHORA)).toBeNull()
  })
})
