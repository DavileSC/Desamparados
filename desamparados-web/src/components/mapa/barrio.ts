import type { FeatureCollection, LineString, Polygon } from 'geojson'

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

/** Si el navegador puede pintar el mapa. Sin WebGL, el itinerario se enseña como línea. */
export function hayWebGL(): boolean {
  try {
    const lienzo = document.createElement('canvas')
    return Boolean(lienzo.getContext('webgl2') ?? lienzo.getContext('webgl'))
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
