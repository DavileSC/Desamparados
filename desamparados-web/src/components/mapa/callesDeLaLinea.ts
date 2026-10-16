import type { Barrio } from './barrio'
import type { CalleDelRecorrido, Coordenada } from '../../lib/api/contenido'
import { acumulados, puntoEn } from '../bloques/recorrido'

const METROS_POR_GRADO = 111320
/** Una calle más lejos que esto de la línea no es por la que se va. */
const LEJOS_M = 30
/** Cada cuánto se mira, dentro de un tramo, por qué calle va. */
const PASO_M = 8
/** Una esquina más lejos que esto de la línea no se marcó para ella. */
const ESQUINA_LEJOS_M = 40

/** Lo que propone el CMS para cada tramo: la calle y, si dudó, la otra que casi gana. */
export interface CalleSugerida extends CalleDelRecorrido {
  /** Los metros del tramo, para ver de un vistazo las muy cortas (esquinas, cruces). */
  metros: number
  /** La otra calle que también encajaba, si la ganadora no lo tenía claro (menos del 70 % de las miradas). */
  dudaCon?: string
}

/** «Calle Mayor» → «C. Mayor»; «Avenida X» → «Av. X». Lo demás, tal cual. */
export function nombreCorto(nombre: string): string {
  if (nombre.startsWith('Calle ')) return `C. ${nombre.slice(6)}`
  if (nombre.startsWith('Avenida ')) return `Av. ${nombre.slice(8)}`
  return nombre
}

/** El punto de la línea más cercano a `p` a partir de `desde` metros: así una esquina no cae en la otra pasada por la misma calle. */
function proyectarDesde(linea: Coordenada[], hechos: number[], p: Coordenada, desde: number): { m: number; distancia: number } {
  let mejor = { m: desde, distancia: Infinity }
  const coseno = Math.cos((p[1] * Math.PI) / 180)
  for (let i = 1; i < linea.length; i++) {
    if (hechos[i] < desde) continue
    const a = linea[i - 1], b = linea[i]
    const ax = (a[0] - p[0]) * METROS_POR_GRADO * coseno, ay = (a[1] - p[1]) * METROS_POR_GRADO
    const dx = (b[0] - a[0]) * METROS_POR_GRADO * coseno, dy = (b[1] - a[1]) * METROS_POR_GRADO
    const l2 = dx * dx + dy * dy
    let t = l2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / l2))
    // No antes de donde se va: en el tramo que contiene `desde`, desde ahí.
    const tMin = hechos[i] - hechos[i - 1] > 0 ? Math.max(0, (desde - hechos[i - 1]) / (hechos[i] - hechos[i - 1])) : 0
    t = Math.max(t, tMin)
    const distancia = Math.hypot(ax + dx * t, ay + dy * t)
    if (distancia < mejor.distancia) mejor = { m: hechos[i - 1] + (hechos[i] - hechos[i - 1]) * t, distancia }
  }
  return mejor
}

/**
 * Dónde se corta la línea: en las esquinas que se pulsaron al trazarla, en el
 * orden del camino. Las esquinas pueden estar guardadas al revés que la línea
 * (pasó con el recorrido del Sábado de Pasión): se prueba en los dos sentidos y
 * se queda el que cae más cerca. Sin esquinas, cada 60 m.
 */
function cortes(linea: Coordenada[], hechos: number[], esquinas: Coordenada[]): number[] {
  const total = hechos[hechos.length - 1]
  if (esquinas.length < 2) {
    const salida = [0]
    for (let m = 60; m < total - 10; m += 60) salida.push(m)
    return salida
  }
  const proyectar = (lista: Coordenada[]) => {
    let desde = 0, error = 0
    const marcas: number[] = []
    for (const p of lista) {
      const { m, distancia } = proyectarDesde(linea, hechos, p, desde)
      if (distancia > ESQUINA_LEJOS_M) continue
      error += distancia
      desde = m
      marcas.push(m)
    }
    return { marcas, error: error / Math.max(1, marcas.length) - marcas.length }
  }
  const derecho = proyectar(esquinas), alReves = proyectar([...esquinas].reverse())
  const marcas = (alReves.error < derecho.error ? alReves : derecho).marcas
  // Sin repetidas ni pegadas: dos esquinas a menos de 3 m son la misma.
  const salida = [0]
  for (const m of marcas) if (m - salida[salida.length - 1] > 3 && total - m > 3) salida.push(m)
  return salida
}

/**
 * Las calles por las que va la línea, en orden (16-10-2026): cada tramo entre
 * dos esquinas va por una sola calle, y su nombre es el de la calle de
 * OpenStreetMap que lleva su misma dirección (la que se cruza de través queda
 * a 0 m en la esquina, pero no cuenta). Tramos seguidos de la misma calle se
 * juntan. Es una propuesta: la Junta la repasa en el CMS, porque el mapa puede
 * confundir calles paralelas (Obsidiana y Juan Gris) o una esquina con una
 * calle, y los cruces se marcan a mano.
 */
export function callesDeLaLinea(linea: Coordenada[], esquinas: Coordenada[], barrio: Pick<Barrio, 'calles'>): CalleSugerida[] {
  if (linea.length < 2) return []
  const hechos = acumulados(linea)
  const total = hechos[hechos.length - 1]
  if (total === 0) return []

  // Solo los trozos de calle con nombre cerca del recorrido: el barrio entero son miles.
  const lons = linea.map((p) => p[0]), lats = linea.map((p) => p[1])
  const margen = 0.001
  const [oeste, este, sur, norte] = [Math.min(...lons) - margen, Math.max(...lons) + margen, Math.min(...lats) - margen, Math.max(...lats) + margen]
  const trozos: { nombre: string; a: Coordenada; b: Coordenada }[] = []
  for (const calle of barrio.calles.features) {
    const nombre = calle.properties?.nombre
    if (!nombre) continue
    const puntos = calle.geometry.coordinates as Coordenada[]
    for (let i = 1; i < puntos.length; i++) {
      const a = puntos[i - 1], b = puntos[i]
      if (Math.max(a[0], b[0]) < oeste || Math.min(a[0], b[0]) > este || Math.max(a[1], b[1]) < sur || Math.min(a[1], b[1]) > norte) continue
      trozos.push({ nombre, a, b })
    }
  }

  /** La calle por la que se va en `p` llevando el rumbo `angulo`: cerca y en la misma dirección. */
  const calleEn = (p: Coordenada, angulo: number): string | null => {
    const coseno = Math.cos((p[1] * Math.PI) / 180)
    let mejor: string | null = null, nota = Infinity
    for (const { nombre, a, b } of trozos) {
      const ax = (a[0] - p[0]) * METROS_POR_GRADO * coseno, ay = (a[1] - p[1]) * METROS_POR_GRADO
      const dx = (b[0] - a[0]) * METROS_POR_GRADO * coseno, dy = (b[1] - a[1]) * METROS_POR_GRADO
      const l2 = dx * dx + dy * dy
      const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / l2))
      const distancia = Math.hypot(ax + dx * t, ay + dy * t)
      if (distancia > LEJOS_M) continue
      const deTraves = Math.abs(Math.sin(Math.atan2(dy, dx) - angulo))
      const n = distancia + deTraves * 25
      if (n < nota) { nota = n; mejor = nombre }
    }
    return mejor
  }

  const marcas = cortes(linea, hechos, esquinas)
  const tramos: CalleSugerida[] = []
  marcas.forEach((desde, i) => {
    const hasta = marcas[i + 1] ?? total
    const largo = hasta - desde
    const votos = new Map<string, number>()
    const n = Math.max(2, Math.round(largo / PASO_M))
    for (let k = 1; k < n; k++) {
      const m = desde + (largo * k) / n
      const p = puntoEn(linea, m / total, hechos)
      const antes = puntoEn(linea, Math.max(0, m - 4) / total, hechos), despues = puntoEn(linea, Math.min(total, m + 4) / total, hechos)
      const coseno = Math.cos((p[1] * Math.PI) / 180)
      const angulo = Math.atan2(despues[1] - antes[1], (despues[0] - antes[0]) * coseno)
      const calle = calleEn(p, angulo)
      if (calle) votos.set(calle, (votos.get(calle) ?? 0) + 1)
    }
    const orden = [...votos].sort((x, y) => y[1] - x[1])
    const miradas = orden.reduce((suma, [, v]) => suma + v, 0)
    const ganadora = orden[0]?.[0] ?? 'Sin nombre'
    const duda = orden[1] && orden[0][1] / miradas < 0.7 ? nombreCorto(orden[1][0]) : undefined
    tramos.push({ nombre: nombreCorto(ganadora), desde: desde / total, metros: largo, ...(duda && { dudaCon: duda }) })
  })

  // Tramos seguidos de la misma calle, uno solo.
  const juntas: CalleSugerida[] = []
  for (const t of tramos) {
    const ultima = juntas[juntas.length - 1]
    if (ultima && ultima.nombre === t.nombre) {
      ultima.metros += t.metros
      if (t.dudaCon && !ultima.dudaCon) ultima.dudaCon = t.dudaCon
    } else juntas.push({ ...t })
  }
  return juntas.map((c) => ({ ...c, desde: Math.round(c.desde * 10000) / 10000, metros: Math.round(c.metros) }))
}

/** Los metros de un trozo de la línea entre dos fracciones, para enseñarlos en el CMS. */
export const metrosEntre = (linea: Coordenada[], desde: number, hasta: number): number => {
  const hechos = acumulados(linea)
  return Math.round((hasta - desde) * hechos[hechos.length - 1])
}
