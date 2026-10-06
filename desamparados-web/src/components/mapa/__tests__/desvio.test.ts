import { describe, expect, it } from 'vitest'
import type { Feature, LineString } from 'geojson'
import type { Barrio } from '../barrio'
import type { Coordenada } from '../../../lib/api/contenido'
import { calleFueraDelRecorrido } from '../desvio'

type Clase = 'mayor' | 'menor' | 'peatonal' | 'servicio'
const calle = (nombre: string, puntos: Coordenada[], clase: Clase = 'menor'): Feature<LineString, { clase: Clase; nombre: string }> =>
  ({ type: 'Feature', properties: { clase, nombre }, geometry: { type: 'LineString', coordinates: puntos } })

const barrio = (calles: ReturnType<typeof calle>[]): Barrio => ({
  licencia: '', caja: [0, 0, 0, 0],
  calles: { type: 'FeatureCollection', features: calles },
  edificios: { type: 'FeatureCollection', features: [] },
  verdes: { type: 'FeatureCollection', features: [] },
})

// Un recorrido recto de unos 440 m por el ecuador: 0,001° son unos 111 m.
const RECORRIDO: Coordenada[] = [[0, 0], [0.004, 0]]

describe('la calle de la página 404', () => {
  it('elige una que sale del recorrido y se aleja, y la da desde el recorrido hacia fuera', () => {
    // Escrita al revés, desde su final: tiene que salir dada la vuelta.
    const buena = calle('Calle Cisne', [[0.0021, 0.0015], [0.0021, 0.0007], [0.0021, 0]])
    const r = calleFueraDelRecorrido(barrio([calle('Calle del Recorrido', RECORRIDO, 'mayor'), buena]), RECORRIDO)
    expect(r?.calle).toBe('Calle Cisne')
    expect(r?.linea[0]).toEqual([0.0021, 0])
  })

  it('descarta la que vuelve al recorrido, la muy corta, la peatonal, la sin nombre y la que anda el cortejo', () => {
    const r = calleFueraDelRecorrido(barrio([
      calle('Calle del Recorrido', RECORRIDO, 'mayor'),
      calle('Calle que Vuelve', [[0.001, 0], [0.001, 0.0012], [0.0018, 0.0012], [0.0018, 0]]),
      calle('Calle Corta', [[0.002, 0], [0.002, 0.0005]]),
      calle('Paseo Peatonal', [[0.0022, 0], [0.0022, 0.0015]], 'peatonal'),
      calle('', [[0.0024, 0], [0.0024, 0.0015]]),
      // Un trozo de la calle del recorrido que sigue más allá: tacharla mentiría.
      calle('Calle del Recorrido', [[0.0026, 0], [0.0026, 0.0015]]),
    ]), RECORRIDO)
    expect(r).toBeNull()
  })

  it('de las que sirven, prefiere la que sale hacia la mitad del itinerario', () => {
    const r = calleFueraDelRecorrido(barrio([
      calle('Calle de la Salida', [[0.0004, 0], [0.0004, -0.0015]]),
      calle('Calle del Medio', [[0.0019, 0], [0.0019, 0.0016]]),
      calle('Calle del Final', [[0.0036, 0], [0.0036, 0.0015]]),
    ]), RECORRIDO)
    expect(r?.calle).toBe('Calle del Medio')
  })

  it('sin recorrido no hay calle', () => {
    expect(calleFueraDelRecorrido(barrio([calle('Calle Cisne', [[0, 0], [0, 0.0015]])]), [])).toBeNull()
  })
})
