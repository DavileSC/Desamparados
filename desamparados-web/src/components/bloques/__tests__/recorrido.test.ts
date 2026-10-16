import { describe, it, expect } from 'vitest'
import { aHora, aMinutos, fraccionMasCercana, lecturaDelRecorrido, metros, paradaAlcanzada, posicionesEnRuta, puntoEn, sobreElRecorrido, tramoHasta } from '../recorrido'
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

  it('la posición del GPS se lleva a la calle y dice a cuántos metros queda', () => {
    const cerca = sobreElRecorrido(ELE, [-4.45 + ESTE, 36.71 + NORTE / 2])
    expect(cerca.fraccion).toBeCloseTo(0.75, 2)
    expect(cerca.distancia).toBeLessThan(1)
    const lejos = sobreElRecorrido(ELE, [-4.45 + ESTE / 2, 36.71 - 3 * NORTE])
    expect(lejos.fraccion).toBeCloseTo(0.25, 2)
    expect(lejos.distancia).toBeCloseTo(300, -1)
    expect(sobreElRecorrido([], ELE[0]).distancia).toBe(Infinity)
  })
})

describe('el recorrido por calles: filas, sitios y horas', () => {
  const recorrido = { esquinas: [], linea: ELE, pegado: true }

  it('sin calles, la lista son las paradas, como siempre, y no hay sitios', () => {
    const lectura = lecturaDelRecorrido({ paradas: [{ hora: '18:00', lugar: 'Templo' }, { hora: '', lugar: 'C. Mayor' }], recorrido })
    expect(lectura.porCalles).toBe(false)
    expect(lectura.filas.map((f) => f.lugar)).toEqual(['Templo', 'C. Mayor'])
    expect(lectura.sitios).toEqual([])
  })

  it('reparte las horas entre la salida y la entrada, pasada la medianoche, y descuenta lo que se para el trono', () => {
    const lectura = lecturaDelRecorrido({
      paradas: [{ hora: '', lugar: 'Peña', enRuta: 0.5, nota: 'Saetas', minutos: 60 }],
      recorrido: {
        ...recorrido, salida: '18:00', entrada: '00:00',
        calles: [{ nombre: 'C. Mayor', desde: 0 }, { nombre: 'Cruce de la avenida', desde: 0.25, cruce: true }, { nombre: 'C. Real', desde: 0.75 }],
      },
    })
    // Seis horas, una parados: cinco andando. A la cuarta parte, 1 h 15 min; pasada la peña, una hora más.
    expect(lectura.filas).toEqual([
      { hora: '18:00', lugar: 'C. Mayor', cruce: false },
      { hora: '19:15', lugar: 'Cruce de la avenida', cruce: true },
      { hora: '22:45', lugar: 'C. Real', cruce: false },
    ])
    expect(lectura.posiciones).toEqual([0, 0.25, 0.75])
    expect(lectura.sitios).toEqual([{ lugar: 'Peña', nota: 'Saetas', hora: '20:30', posicion: 0.5 }])
  })

  it('una hora escrita a mano manda; sin salida o sin entrada, no se inventa ninguna', () => {
    const calles = [{ nombre: 'C. Mayor', desde: 0 }, { nombre: 'C. Real', desde: 0.5, hora: '21:10' }]
    const sinEntrada = lecturaDelRecorrido({ paradas: [{ hora: '', lugar: 'Peña', enRuta: 0.2 }], recorrido: { ...recorrido, salida: '18:00', calles } })
    expect(sinEntrada.filas.map((f) => f.hora)).toEqual(['', '21:10'])
    expect(sinEntrada.sitios[0].hora).toBe('')
  })

  it('las horas, en formato de 24 h y redondeadas a 5 minutos', () => {
    expect(aMinutos('18:30')).toBe(1110)
    expect(aMinutos('')).toBeNull()
    expect(aMinutos('25:00')).toBeNull()
    expect(aHora(1110 + 2)).toBe('18:30')
    expect(aHora(1440 + 3)).toBe('00:05')
  })
})
