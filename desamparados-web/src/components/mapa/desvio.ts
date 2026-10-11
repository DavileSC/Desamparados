import type { Coordenada } from '../../lib/api/contenido'
import { acumulados, sobreElRecorrido } from '../bloques/recorrido'
import type { Barrio } from './barrio'

/** Una calle que sale del recorrido y no vuelve a él: la de la placa «404». */
interface Desvio {
  calle: string
  /** Desde el recorrido hacia fuera. */
  linea: Coordenada[]
}

/** A menos de esto de la línea, un punto está en el recorrido. */
const EN_RUTA_M = 10
/** Y el final de la calle tiene que quedar al menos así de lejos: que se vea que se va. */
const FUERA_M = 90
/** Ni un callejón que no se ve ni una avenida que cruza medio mapa. */
const LARGO_MINIMO_M = 80
const LARGO_MAXIMO_M = 320

/**
 * La calle de la página 404: una con nombre que arranca en el recorrido y se
 * aleja de él sin volver. Se busca sola, para que no haya que elegirla cada
 * año: si el recorrido cambia, la placa cambia con él.
 *
 * Se descartan las que el cortejo anda en algún tramo (tacharla diría que
 * no está en el recorrido, y sí está) y, de las que quedan, se prefiere la que
 * sale más hacia la mitad del itinerario, lejos de la salida, donde se ve bien.
 * `null` si no hay ninguna que sirva: la página se queda con el recorrido solo.
 */
export function calleFueraDelRecorrido(barrio: Barrio, linea: Coordenada[]): Desvio | null {
  if (linea.length < 2) return null
  const calles = barrio.calles.features.filter((f) => f.properties.clase !== 'peatonal' && f.properties.nombre.trim() !== '')

  // Las que anda el cortejo: con dos puntos o más sobre la línea.
  const andadas = new Set<string>()
  for (const f of calles) {
    const sobre = (f.geometry.coordinates as Coordenada[]).filter((p) => sobreElRecorrido(linea, p).distancia <= EN_RUTA_M)
    if (sobre.length >= 2) andadas.add(f.properties.nombre)
  }

  let mejor: { desvio: Desvio; nota: number } | null = null
  for (const f of calles) {
    if (andadas.has(f.properties.nombre)) continue
    const puntos = f.geometry.coordinates as Coordenada[]
    for (const sentido of [puntos, [...puntos].reverse()]) {
      const salida = sobreElRecorrido(linea, sentido[0])
      if (salida.distancia > EN_RUTA_M) continue
      // Ningún otro punto vuelve al recorrido, y el último queda lejos.
      if (sentido.slice(1).some((p) => sobreElRecorrido(linea, p).distancia <= EN_RUTA_M)) continue
      if (sobreElRecorrido(linea, sentido[sentido.length - 1]).distancia < FUERA_M) continue
      const hechos = acumulados(sentido)
      const largo = hechos[hechos.length - 1]
      if (largo < LARGO_MINIMO_M || largo > LARGO_MAXIMO_M) continue
      const nota = Math.abs(salida.fraccion - 0.5)
      if (!mejor || nota < mejor.nota) mejor = { desvio: { calle: f.properties.nombre, linea: sentido }, nota }
    }
  }
  return mejor?.desvio ?? null
}
