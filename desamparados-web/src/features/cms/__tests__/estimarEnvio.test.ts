import { describe, it, expect } from 'vitest'
import { estimarEnvio } from '../estimarEnvio'

const ritmo = { porHora: 150, porDia: 1000 }
const SEIS = Date.UTC(2026, 11, 24, 5, 0)
const minutos = (n: number) => n * 60_000

describe('estimarEnvio', () => {
  it('hasta una tanda sale en unos minutos', () => {
    expect(estimarEnvio(SEIS, 150, ritmo)).toEqual({ tandas: 1, fin: SEIS + minutos(5), pasaDelDia: false })
  })

  it('612 direcciones son cinco tandas: algo más de cuatro horas', () => {
    expect(estimarEnvio(SEIS, 612, ritmo)).toEqual({ tandas: 5, fin: SEIS + minutos(4 * 65 + 5), pasaDelDia: false })
  })

  it('más que el tope del día: no se promete una hora', () => {
    expect(estimarEnvio(SEIS, 1200, ritmo)).toMatchObject({ fin: null, pasaDelDia: true })
  })
})
