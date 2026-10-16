import { describe, it, expect } from 'vitest'
import { callesDeLaLinea, nombreCorto } from '../callesDeLaLinea'
import type { Barrio } from '../barrio'
import type { Coordenada } from '../../../lib/api/contenido'

// Una L en Málaga: 100 m hacia el este por la calle Mayor y otros 100 hacia el
// norte por la calle Real. La calle Atravesada cruza la Mayor de norte a sur a
// mitad de camino: está a 0 m de la línea, pero de través.
const ESTE = 100 / (111320 * Math.cos((36.71 * Math.PI) / 180))
const NORTE = 100 / 111320
const A: Coordenada = [-4.45, 36.71]
const B: Coordenada = [-4.45 + ESTE, 36.71]
const C: Coordenada = [-4.45 + ESTE, 36.71 + NORTE]
const LINEA: Coordenada[] = [A, [-4.45 + ESTE / 2, 36.71], B, [-4.45 + ESTE, 36.71 + NORTE / 2], C]

const calle = (nombre: string, puntos: Coordenada[]) => ({
  type: 'Feature' as const, properties: { clase: 'menor' as const, nombre }, geometry: { type: 'LineString' as const, coordinates: puntos },
})
const BARRIO: Pick<Barrio, 'calles'> = {
  calles: {
    type: 'FeatureCollection',
    features: [
      calle('Calle Mayor', [[A[0] - 0.0003, A[1]], [B[0] + 0.0003, B[1]]]),
      calle('Calle Real', [[B[0], B[1] - 0.0003], [C[0], C[1] + 0.0003]]),
      calle('Calle Atravesada', [[-4.45 + ESTE / 2, 36.71 - 0.0004], [-4.45 + ESTE / 2, 36.71 + 0.0004]]),
    ],
  },
}

describe('las calles que salen de la línea', () => {
  it('corta en las esquinas y nombra cada tramo con la calle que lleva su dirección, no con la que se cruza', () => {
    const calles = callesDeLaLinea(LINEA, [A, B, C], BARRIO)
    expect(calles.map((c) => c.nombre)).toEqual(['C. Mayor', 'C. Real'])
    expect(calles[0].desde).toBe(0)
    expect(calles[1].desde).toBeCloseTo(0.5, 2)
    expect(calles[0].metros).toBeGreaterThan(95)
  })

  it('da igual que las esquinas estén guardadas al revés que la línea', () => {
    expect(callesDeLaLinea(LINEA, [C, B, A], BARRIO).map((c) => c.nombre)).toEqual(['C. Mayor', 'C. Real'])
  })

  it('tramos seguidos de la misma calle van juntos, y sin calle cerca se dice', () => {
    const conEsquinaDeMas = callesDeLaLinea(LINEA, [A, LINEA[1], B, C], BARRIO)
    expect(conEsquinaDeMas.map((c) => c.nombre)).toEqual(['C. Mayor', 'C. Real'])
    expect(callesDeLaLinea(LINEA, [A, B, C], { calles: { type: 'FeatureCollection', features: [] } }).map((c) => c.nombre)).toEqual(['Sin nombre'])
  })

  it('acorta los nombres como en la web', () => {
    expect(nombreCorto('Calle Río Duratón')).toBe('C. Río Duratón')
    expect(nombreCorto('Avenida José Ortega y Gasset')).toBe('Av. José Ortega y Gasset')
    expect(nombreCorto('Plaza Río Trabanco')).toBe('Plaza Río Trabanco')
  })
})
