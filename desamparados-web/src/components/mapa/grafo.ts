import type { Coordenada } from '../../lib/api/contenido'
import { metros } from '../bloques/recorrido'
import type { Barrio } from './barrio'

/**
 * El grafo de calles del barrio, para que el editor del CMS pegue el recorrido
 * a la calzada: se pulsan unas pocas esquinas y la línea va de una a otra por
 * las calles, por el camino más corto.
 *
 * Entran todas las vías del mapa, peatonales incluidas (una procesión pasa por
 * plazas y calles peatonales). Dos vías se unen donde comparten un punto, que
 * es como OpenStreetMap dibuja los cruces.
 */
export interface Grafo {
  nodos: Coordenada[]
  vecinos: { a: number; metros: number }[][]
}

const clave = (c: Coordenada) => `${c[0].toFixed(7)},${c[1].toFixed(7)}`

export function construirGrafo(barrio: Barrio): Grafo {
  const indice = new Map<string, number>()
  const nodos: Coordenada[] = []
  const vecinos: { a: number; metros: number }[][] = []
  const nodo = (c: Coordenada) => {
    const k = clave(c)
    let i = indice.get(k)
    if (i === undefined) {
      i = nodos.length
      indice.set(k, i)
      nodos.push(c)
      vecinos.push([])
    }
    return i
  }
  for (const calle of barrio.calles.features) {
    const puntos = calle.geometry.coordinates as Coordenada[]
    for (let i = 1; i < puntos.length; i++) {
      const a = nodo(puntos[i - 1])
      const b = nodo(puntos[i])
      const d = metros(puntos[i - 1], puntos[i])
      vecinos[a].push({ a: b, metros: d })
      vecinos[b].push({ a, metros: d })
    }
  }
  return { nodos, vecinos }
}

/** El nodo del grafo más cercano a un punto, y a cuántos metros está. */
export function nodoMasCercano(grafo: Grafo, p: Coordenada): { nodo: number; metros: number } {
  let mejor = { nodo: -1, metros: Infinity }
  grafo.nodos.forEach((c, i) => {
    const d = metros(c, p)
    if (d < mejor.metros) mejor = { nodo: i, metros: d }
  })
  return mejor
}

/**
 * El camino más corto por las calles entre dos nodos (Dijkstra con un montículo
 * binario). `null` si no hay camino: dos trozos de calle sueltos en los bordes
 * del mapa, por ejemplo.
 */
export function caminoMasCorto(grafo: Grafo, desde: number, hasta: number): Coordenada[] | null {
  const n = grafo.nodos.length
  const dist = new Float64Array(n).fill(Infinity)
  const previo = new Int32Array(n).fill(-1)
  const monton: [number, number][] = []
  const sube = (e: [number, number]) => {
    monton.push(e)
    let i = monton.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (monton[p][0] <= monton[i][0]) break
      ;[monton[p], monton[i]] = [monton[i], monton[p]]
      i = p
    }
  }
  const saca = (): [number, number] => {
    const cima = monton[0]
    const ultimo = monton.pop()!
    if (monton.length > 0) {
      monton[0] = ultimo
      let i = 0
      for (;;) {
        const l = 2 * i + 1, r = l + 1
        let m = i
        if (l < monton.length && monton[l][0] < monton[m][0]) m = l
        if (r < monton.length && monton[r][0] < monton[m][0]) m = r
        if (m === i) break
        ;[monton[m], monton[i]] = [monton[i], monton[m]]
        i = m
      }
    }
    return cima
  }
  dist[desde] = 0
  sube([0, desde])
  while (monton.length > 0) {
    const [d, k] = saca()
    if (d > dist[k]) continue
    if (k === hasta) break
    for (const { a, metros: w } of grafo.vecinos[k]) {
      if (d + w < dist[a]) {
        dist[a] = d + w
        previo[a] = k
        sube([d + w, a])
      }
    }
  }
  if (dist[hasta] === Infinity) return null
  const camino: Coordenada[] = []
  for (let k = hasta; k !== -1; k = previo[k]) camino.push(grafo.nodos[k])
  return camino.reverse()
}

/** Más lejos que esto de cualquier calle, la esquina no se pega: se une en línea recta. */
const MAXIMO_PARA_PEGAR = 60

/**
 * La línea del recorrido a partir de sus esquinas. Pegada a las calles, cada
 * tramo va de una esquina a la siguiente por el camino más corto; si una
 * esquina cae lejos de toda calle, o no hay camino, ese tramo va recto.
 */
export function lineaDelRecorrido(esquinas: Coordenada[], pegado: boolean, grafo: Grafo | null): Coordenada[] {
  // Con una sola esquina todavía no hay línea (y el servidor no guarda líneas de un punto).
  if (esquinas.length < 2) return []
  if (!pegado || !grafo || grafo.nodos.length === 0) return [...esquinas]
  const cercanos = esquinas.map((e) => nodoMasCercano(grafo, e))
  const linea: Coordenada[] = []
  const anade = (tramo: Coordenada[]) => {
    for (const p of tramo) {
      const ultimo = linea[linea.length - 1]
      if (!ultimo || ultimo[0] !== p[0] || ultimo[1] !== p[1]) linea.push(p)
    }
  }
  for (let i = 1; i < esquinas.length; i++) {
    const a = cercanos[i - 1], b = cercanos[i]
    const camino = a.metros <= MAXIMO_PARA_PEGAR && b.metros <= MAXIMO_PARA_PEGAR ? caminoMasCorto(grafo, a.nodo, b.nodo) : null
    anade(camino ?? [esquinas[i - 1], esquinas[i]])
  }
  // Seis decimales: unos 10 cm, de sobra, y la mitad de texto al guardar.
  return linea.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6])
}
