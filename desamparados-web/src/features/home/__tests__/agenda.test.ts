import { describe, it, expect } from 'vitest'
import { diasDeLaRejilla } from '../agenda'

describe('diasDeLaRejilla', () => {
  it('pinta siempre seis semanas empezando en lunes, dure el mes cuatro, cinco o seis', () => {
    // Se rompe si la rejilla vuelve a ajustarse a las semanas de cada mes: al pasar de
    // septiembre (cinco semanas) a noviembre (seis), el calendario y la sección cambiarían de altura.
    for (const mes of [new Date(2026, 8, 1), new Date(2026, 10, 1), new Date(2027, 1, 1)]) {
      const dias = diasDeLaRejilla(mes)
      expect(dias).toHaveLength(42)
      expect(dias[0].getDay()).toBe(1)
      expect(dias.some(d => d.getMonth() === mes.getMonth() && d.getDate() === 1)).toBe(true)
    }
  })
})
