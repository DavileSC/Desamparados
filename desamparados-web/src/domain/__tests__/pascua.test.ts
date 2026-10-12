import { describe, it, expect } from 'vitest'
import { pascua } from '../pascua'

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
