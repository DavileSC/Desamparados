import { describe, it, expect } from 'vitest'
import { construirGrafo, lineaDelRecorrido, rectosTrasCambio, simplificar } from '../grafo'
import { centroDe, edificioDelTemplo, type Barrio } from '../barrio'
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

  it('la salida y la entrada a mitad de calle quedan en su sitio, no en la esquina', () => {
    // La puerta del templo, a mitad de la calle A-B y un poco apartada de ella.
    const puerta: Coordenada = [0.0005, 0.00004]
    const linea = lineaDelRecorrido([puerta, C], true, grafo)
    expect(linea[0][0]).toBeCloseTo(0.0005, 6)
    expect(linea[0][1]).toBeCloseTo(0, 6)
    // Hacia C por B, que es lo corto: sin pasar por A.
    expect(linea).toContainEqual(B)
    expect(linea).not.toContainEqual(A)
    expect(linea[linea.length - 1]).toEqual(C)
    // Y de vuelta, acaba en la puerta.
    const vuelta = lineaDelRecorrido([C, puerta], true, grafo)
    expect(vuelta[vuelta.length - 1][0]).toBeCloseTo(0.0005, 6)
  })

  it('salida y entrada en el mismo trozo de calle van de una a otra', () => {
    expect(lineaDelRecorrido([[0.0002, 0], [0.0008, 0]], true, grafo)).toEqual([[0.0002, 0], [0.0008, 0]])
  })

  it('sin pegar, va recto', () => {
    expect(lineaDelRecorrido([A, C], false, grafo)).toEqual([A, C])
  })

  it('una esquina lejos de toda calle se une en recto', () => {
    const lejos: Coordenada = [0.01, 0.01]
    expect(lineaDelRecorrido([A, lejos], true, grafo)).toEqual([A, lejos])
  })

  it('prefiere la calzada a un atajo peatonal un poco más corto', () => {
    // De A a C por la calzada (A-B-C, 200 m) o por un camino peatonal en diagonal (unos 157 m).
    const conAtajo: Barrio = {
      ...BARRIO,
      calles: { ...BARRIO.calles, features: [...BARRIO.calles.features, { ...calle(A, C), properties: { clase: 'peatonal' as const, nombre: '' } }] },
    }
    const linea = lineaDelRecorrido([A, C], true, construirGrafo(conAtajo))
    expect(linea).toHaveLength(3)
  })

  it('un salto corto que por las calles sería un rodeo largo va recto', () => {
    // Dos calles sueltas separadas 10 m, unidas solo dando la vuelta muy lejos.
    const E: Coordenada = [0, 0.0001], F: Coordenada = [0.001, 0.0001]
    const lejos1: Coordenada = [0, 0.005], lejos2: Coordenada = [0.001, 0.005]
    const partido: Barrio = {
      ...BARRIO,
      calles: { ...BARRIO.calles, features: [calle(A, B), calle(E, F), calle(A, lejos1), calle(lejos1, lejos2), calle(lejos2, F)] },
    }
    expect(lineaDelRecorrido([A, E], true, construirGrafo(partido))).toEqual([A, E])
  })
})

describe('el trazo a mano alzada', () => {
  it('se queda con las esquinas y quita el temblor', () => {
    // Un ángulo recto de 100 m por lado con un temblor de un metro.
    const temblor = Array.from({ length: 21 }, (_, i): Coordenada => [i * 0.00005, (i % 2) * 0.00001])
    const subida = Array.from({ length: 20 }, (_, i): Coordenada => [0.001, (i + 1) * 0.00005])
    const limpio = simplificar([...temblor, ...subida], 5)
    expect(limpio).toEqual([[0, 0], [0.001, 0], [0.001, 0.001]])
  })
})

describe('los tramos rectos al retocar', () => {
  const E: Coordenada[] = [[0, 0], [1, 0], [2, 0], [3, 0]]
  it('con una esquina metida, los de detrás se corren', () => {
    expect(rectosTrasCambio(E, [E[0], E[1], [1.5, 0], E[2], E[3]], [0, 2])).toEqual([0, 3])
  })
  it('con una quitada, se pierden los que la tocaban', () => {
    expect(rectosTrasCambio(E, [E[0], E[2], E[3]], [0, 1, 2])).toEqual([1])
  })
  it('moviendo una se quedan, y con otro trazo se pierden', () => {
    expect(rectosTrasCambio(E, [E[0], [1, 1], E[2], E[3]], [1])).toEqual([1])
    expect(rectosTrasCambio(E, [E[0], E[1]], [1])).toEqual([])
  })
})

describe('el templo en el mapa', () => {
  const edificio = (x: number, alto: number) => ({
    type: 'Feature' as const, properties: { alto },
    geometry: { type: 'Polygon' as const, coordinates: [[[x, 0.0002], [x + 0.0002, 0.0002], [x + 0.0002, 0.0004], [x, 0.0004], [x, 0.0002]]] },
  })
  const cerca = edificio(0, 16), lejos = edificio(0.002, 20)
  const conEdificios: Barrio = { ...BARRIO, edificios: { type: 'FeatureCollection', features: [lejos, cerca] } }

  it('es el edificio más cercano a la salida', () => {
    expect(edificioDelTemplo(conEdificios, A)).toBe(cerca)
  })

  it('si no hay ninguno a menos de 35 m de la salida, no se marca ninguno', () => {
    expect(edificioDelTemplo(conEdificios, [0.01, 0.01])).toBeNull()
  })

  it('la cruz va en medio del edificio', () => {
    const [x, y] = centroDe(cerca)
    expect(x).toBeCloseTo(0.0001)
    expect(y).toBeCloseTo(0.0003)
  })
})
