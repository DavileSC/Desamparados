import { describe, it, expect } from 'vitest'
import { construirGrafo, lineaDelRecorrido } from '../grafo'
import type { Barrio } from '../barrio'
import type { Coordenada } from '../../../lib/api/contenido'

// Un cuadrado de cuatro calles de 0,001° de lado (unos 100 m).
const A: Coordenada = [0, 0], B: Coordenada = [0.001, 0], C: Coordenada = [0.001, 0.001], D: Coordenada = [0, 0.001]
const calle = (a: Coordenada, b: Coordenada) => ({ type: 'Feature' as const, properties: { clase: 'menor' as const, nombre: '' }, geometry: { type: 'LineString' as const, coordinates: [a, b] } })
const BARRIO: Barrio = {
  licencia: '', caja: [0, 0, 0.001, 0.001],
  calles: { type: 'FeatureCollection', features: [calle(A, B), calle(B, C), calle(C, D), calle(D, A)] },
  edificios: { type: 'FeatureCollection', features: [] },
  verdes: { type: 'FeatureCollection', features: [] },
}

describe('el recorrido pegado a las calles', () => {
  const grafo = construirGrafo(BARRIO)

  it('de una esquina a la opuesta va por las calles, doblando en una esquina', () => {
    const linea = lineaDelRecorrido([A, C], true, grafo)
    expect(linea).toHaveLength(3)
    expect(linea[0]).toEqual(A)
    expect(linea[2]).toEqual(C)
    expect([B, D]).toContainEqual(linea[1])
  })

  it('sin pegar, va recto', () => {
    expect(lineaDelRecorrido([A, C], false, grafo)).toEqual([A, C])
  })

  it('una esquina lejos de toda calle se une en recto', () => {
    const lejos: Coordenada = [0.01, 0.01]
    expect(lineaDelRecorrido([A, lejos], true, grafo)).toEqual([A, lejos])
  })
})
