import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson'
import type { Coordenada } from '../../lib/api/contenido'

/**
 * El mapa del barrio: las calles, los edificios y las zonas verdes de
 * OpenStreetMap alrededor del recorrido, en un solo fichero nuestro
 * (`public/mapas/barrio-desamparados.json`). La web no pide nada a ningún
 * servidor de mapas: ni cookies, ni claves, ni terceros.
 *
 * Se descargó de Overpass el 25-09-2026 con un margen de unos 400 m alrededor
 * del recorrido. Si algún año el recorrido sale de ahí, hay que volver a
 * generarlo (ver `licencia` dentro del fichero para la atribución).
 */
export interface Barrio {
  licencia: string
  /** [oeste, sur, este, norte] */
  caja: [number, number, number, number]
  calles: FeatureCollection<LineString, { clase: 'mayor' | 'menor' | 'peatonal' | 'servicio'; nombre: string }>
  edificios: FeatureCollection<Polygon, { alto: number }>
  verdes: FeatureCollection<Polygon>
}

export const URL_BARRIO = '/mapas/barrio-desamparados.json'

/** El reconocimiento que pide la licencia de OpenStreetMap. Va siempre en el mapa. */
export const ATRIBUCION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a>'

let enCamino: Promise<Barrio> | null = null

/** El barrio, pedido una sola vez aunque lo pidan la web y el editor a la vez. */
export function cargarBarrio(): Promise<Barrio> {
  if (!enCamino) {
    enCamino = fetch(URL_BARRIO)
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo leer el mapa del barrio (${r.status})`)
        return r.json() as Promise<Barrio>
      })
      .catch((error: unknown) => {
        // Que un fallo de red no quede guardado para siempre: se reintenta la próxima vez.
        enCamino = null
        throw error
      })
  }
  return enCamino
}

/**
 * Si el navegador puede pintar el mapa. Sin WebGL, el itinerario se enseña como línea.
 * Desde MapLibre 6 hace falta WebGL2: con solo WebGL1 el mapa ya no arranca.
 */
export function hayWebGL(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    return false
  }
}

/**
 * Si un mapa sigue vivo: uno retirado (`remove()`) se queda sin estilo, y
 * pedirle una capa rompe la página. Pasa, por ejemplo, si el componente se
 * vuelve a montar mientras el anterior aún tenía el mapa.
 */
export const mapaVivo = (m: { style?: unknown } | null | undefined): boolean => Boolean(m?.style)

/** Más lejos que esto de la salida, ningún edificio se toma por el templo. */
const TEMPLO_A_MENOS_DE = 35

const METROS_POR_GRADO = 111320

/** Metros de un punto al segmento a-b (aproximación plana: es un barrio). */
function aSegmento(p: Coordenada, a: Coordenada, b: Coordenada): number {
  const coseno = Math.cos((p[1] * Math.PI) / 180)
  const ax = (a[0] - p[0]) * METROS_POR_GRADO * coseno, ay = (a[1] - p[1]) * METROS_POR_GRADO
  const dx = (b[0] - p[0]) * METROS_POR_GRADO * coseno - ax, dy = (b[1] - p[1]) * METROS_POR_GRADO - ay
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / l2))
  return Math.hypot(ax + dx * t, ay + dy * t)
}

/**
 * El templo: el edificio más cercano a la salida del recorrido, si está a
 * menos de 35 m. El recorrido sale de la iglesia y vuelve a ella, así que el
 * mapa la destaca; no hay que marcarla a mano, y si algún año cambia la
 * salida, cambia con ella. `null` si no hay ninguno tan cerca.
 */
export function edificioDelTemplo(barrio: Barrio, salida: Coordenada): Feature<Polygon, { alto: number }> | null {
  let mejor: { edificio: Feature<Polygon, { alto: number }>; metros: number } | null = null
  for (const edificio of barrio.edificios.features) {
    const anillo = edificio.geometry.coordinates[0] as Coordenada[]
    for (let i = 1; i < anillo.length; i++) {
      const m = aSegmento(salida, anillo[i - 1], anillo[i])
      if (m < (mejor?.metros ?? TEMPLO_A_MENOS_DE)) mejor = { edificio, metros: m }
    }
  }
  return mejor?.edificio ?? null
}

/** Un punto en medio del edificio, para poner encima la cruz de la salida. */
export function centroDe(edificio: Feature<Polygon>): Coordenada {
  const anillo = edificio.geometry.coordinates[0] as Coordenada[]
  const xs = anillo.map((p) => p[0]), ys = anillo.map((p) => p[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}
