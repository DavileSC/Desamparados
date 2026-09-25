import { describe, it, expect } from 'vitest'
import { fraccionMasCercana, metros, paradaAlcanzada, posicionesEnRuta, puntoEn, tramoHasta } from '../recorrido'
import type { Coordenada } from '../../../lib/api/contenido'

// Una L en Málaga: unos 100 m hacia el este y otros 100 hacia el norte.
const ESTE = 100 / (111320 * Math.cos((36.71 * Math.PI) / 180))
const NORTE = 100 / 111320
const ELE: Coordenada[] = [[-4.45, 36.71], [-4.45 + ESTE, 36.71], [-4.45 + ESTE, 36.71 + NORTE]]

describe('las cuentas del recorrido sobre el mapa', () => {
  it('mide en metros', () => {
    expect(metros(ELE[0], ELE[1])).toBeCloseTo(100, 0)
    expect(metros(ELE[1], ELE[2])).toBeCloseTo(100, 0)
  })

  it('a mitad del recorrido está en la esquina, y el tramo llega hasta ahí', () => {
    const [x, y] = puntoEn(ELE, 0.5)
    expect(x).toBeCloseTo(ELE[1][0], 6)
    expect(y).toBeCloseTo(ELE[1][1], 6)
    expect(tramoHasta(ELE, 0.25)).toHaveLength(2)
    expect(tramoHasta(ELE, 1)).toHaveLength(3)
  })

  it('una pulsación junto a la línea se engancha al punto más cercano', () => {
    expect(fraccionMasCercana(ELE, [-4.45 + ESTE / 2, 36.71 + NORTE / 20])).toBeCloseTo(0.25, 2)
    expect(fraccionMasCercana(ELE, [-4.45 + ESTE * 1.1, 36.71 + NORTE / 2])).toBeCloseTo(0.75, 2)
  })

  it('las paradas sin situar se reparten entre la salida, las situadas y la entrada', () => {
    const p = (enRuta?: number) => ({ hora: '', lugar: 'Calle', ...(enRuta === undefined ? {} : { enRuta }) })
    expect(posicionesEnRuta([p(), p(), p()])).toEqual([0, 0.5, 1])
    expect(posicionesEnRuta([p(), p(0.4), p(), p()])).toEqual([0, 0.4, 0.7, 1])
  })

  it('una parada nunca queda detrás de la anterior', () => {
    const p = (enRuta: number) => ({ hora: '17:30', lugar: 'Calle', enRuta })
    expect(posicionesEnRuta([p(0.5), p(0.3), p(0.9)])).toEqual([0.5, 0.5, 0.9])
  })

  it('la parada alcanzada es la última que el trono ha pasado', () => {
    expect(paradaAlcanzada([0, 0.5, 1], 0)).toBe(0)
    expect(paradaAlcanzada([0, 0.5, 1], 0.49)).toBe(0)
    expect(paradaAlcanzada([0, 0.5, 1], 0.5)).toBe(1)
    expect(paradaAlcanzada([0.1, 0.5, 1], 0)).toBe(-1)
  })
})
