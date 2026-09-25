import { describe, it, expect } from 'vitest'
import { fraccionMasCercana, posicionesEnRuta, puntoEn } from '../recorrido'

// Una L: 50 a la derecha y 50 abajo. Con aspecto 1, las dos patas miden igual.
const ELE = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }]

describe('las cuentas del recorrido sobre el plano', () => {
  it('a mitad del recorrido está en la esquina', () => {
    expect(puntoEn(ELE, 1, 0.5)).toEqual({ x: 50, y: 0 })
    expect(puntoEn(ELE, 1, 0.25)).toEqual({ x: 25, y: 0 })
    expect(puntoEn(ELE, 1, 1)).toEqual({ x: 50, y: 50 })
  })

  it('mide con la proporción del plano: en uno apaisado, lo horizontal pesa más', () => {
    // Con el doble de ancho que de alto, la pata horizontal mide el doble que
    // la vertical: a mitad del recorrido aún no se ha llegado a la esquina.
    const mitad = puntoEn(ELE, 2, 0.5)
    expect(mitad.y).toBe(0)
    expect(mitad.x).toBeCloseTo(37.5)
  })

  it('una pulsación junto a la línea se engancha al punto más cercano', () => {
    expect(fraccionMasCercana(ELE, 1, { x: 25, y: 3 })).toBeCloseTo(0.25)
    expect(fraccionMasCercana(ELE, 1, { x: 60, y: 25 })).toBeCloseTo(0.75)
  })

  it('las paradas sin situar se reparten entre la salida, las situadas y la entrada', () => {
    const p = (enRuta?: number) => ({ hora: '17:30', lugar: 'Calle', ...(enRuta === undefined ? {} : { enRuta }) })
    expect(posicionesEnRuta([p(), p(), p()])).toEqual([0, 0.5, 1])
    expect(posicionesEnRuta([p(), p(0.4), p(), p()])).toEqual([0, 0.4, 0.7, 1])
  })

  it('una parada nunca queda detrás de la anterior', () => {
    const p = (enRuta: number) => ({ hora: '17:30', lugar: 'Calle', enRuta })
    expect(posicionesEnRuta([p(0.5), p(0.3), p(0.9)])).toEqual([0.5, 0.5, 0.9])
  })
})
