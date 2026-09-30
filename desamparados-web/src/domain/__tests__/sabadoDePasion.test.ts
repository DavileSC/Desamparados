import { describe, it, expect } from 'vitest'
import { pascua, sabadoDePasion, cuentaAtrasEstacion } from '../sabadoDePasion'

const comoTexto = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`

describe('Pascua', () => {
  it('cae donde dice el calendario', () => {
    // Domingos de Resurrección comprobables en cualquier calendario litúrgico.
    expect(comoTexto(pascua(2024))).toBe('2024-03-31')
    expect(comoTexto(pascua(2025))).toBe('2025-04-20')
    expect(comoTexto(pascua(2026))).toBe('2026-04-05')
    expect(comoTexto(pascua(2027))).toBe('2027-03-28')
    expect(comoTexto(pascua(2038))).toBe('2038-04-25') // el más tardío posible
  })
})

describe('Sábado de Pasión', () => {
  it('es ocho días antes de Pascua, y siempre sábado', () => {
    expect(comoTexto(sabadoDePasion(2026))).toBe('2026-03-28')
    expect(comoTexto(sabadoDePasion(2027))).toBe('2027-03-20')
    for (const anio of [2024, 2025, 2026, 2027, 2028, 2030]) {
      expect(sabadoDePasion(anio).getDay(), `${anio} no cae en sábado`).toBe(6)
    }
  })

  it('salta de mes hacia atrás sin descuadrarse', () => {
    // Pascua del 5 de abril menos ocho días cruza a marzo.
    expect(comoTexto(sabadoDePasion(2026))).toBe('2026-03-28')
  })
})

describe('cuenta atrás de la estación', () => {
  it('antes de la estación, apunta a la de este año', () => {
    const { fecha, dias } = cuentaAtrasEstacion(new Date(2026, 0, 15))
    expect(comoTexto(fecha)).toBe('2026-03-28')
    expect(dias).toBe(72)
  })

  it('pasada la estación, apunta a la del año que viene', () => {
    const { fecha, dias } = cuentaAtrasEstacion(new Date(2026, 8, 11))
    expect(comoTexto(fecha)).toBe('2027-03-20')
    expect(dias).toBe(190)
  })

  it('el mismo día de la estación no la da por pasada', () => {
    expect(cuentaAtrasEstacion(new Date(2026, 2, 28)).dias).toBe(0)
  })
})
