import type { Coordenada } from '../../lib/api/contenido'
import { metros } from '../bloques/recorrido'
import type { Barrio } from './barrio'

/**
 * El grafo de calles del barrio, para que el editor del CMS pegue el recorrido
 * a la calzada: se pulsan unas pocas esquinas y la línea va de una a otra por
 * las calles, por el camino más corto.
 *
 * Entran todas las vías del mapa, peatonales incluidas (una procesión pasa por
 * plazas y calles peatonales), pero las peatonales y las de servicio cuentan
 * más largas de lo que son: sin eso, el camino más corto ataja por aceras,
 * caminos de parque y aparcamientos, y la línea se mete entre los edificios.
 * Dos vías se unen donde comparten un punto, que es como OpenStreetMap dibuja
 * los cruces.
 */
export interface Grafo {
  nodos: Coordenada[]
  vecinos: { a: number; metros: number }[][]
  /** Cada trozo de calle, por sus dos nodos: para llevar la salida y la entrada a su punto exacto de la calle. */
  aristas: [number, number][]
}

/** Cuánto «pesa» cada metro según la clase de vía. */
const RECARGO: Record<string, number> = { mayor: 1, menor: 1, servicio: 1.5, peatonal: 2.5 }

const clave = (c: Coordenada) => `${c[0].toFixed(7)},${c[1].toFixed(7)}`

export function construirGrafo(barrio: Barrio): Grafo {
  const indice = new Map<string, number>()
  const nodos: Coordenada[] = []
  const vecinos: { a: number; metros: number }[][] = []
  const aristas: [number, number][] = []
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
    const recargo = RECARGO[calle.properties.clase] ?? 1
    for (let i = 1; i < puntos.length; i++) {
      const a = nodo(puntos[i - 1])
      const b = nodo(puntos[i])
      const d = metros(puntos[i - 1], puntos[i]) * recargo
      vecinos[a].push({ a: b, metros: d })
      vecinos[b].push({ a, metros: d })
      aristas.push([a, b])
    }
  }
  return { nodos, vecinos, aristas }
}

const METROS_POR_GRADO = 111320

/**
 * El punto de calle más cercano a otro, sobre el trozo de calle y no en uno de
 * sus nodos, con los dos nodos de ese trozo. La salida y la entrada suelen
 * caer a mitad de manzana (la puerta del templo): llevadas al nodo más
 * cercano, el recorrido empezaba o acababa en la esquina (18-10-2026).
 */
function sobreLaCalle(grafo: Grafo, p: Coordenada): { punto: Coordenada; metros: number; nodos: [number, number] } | null {
  const coseno = Math.cos((p[1] * Math.PI) / 180)
  let mejor: { metros: number; t: number; arista: [number, number] } | null = null
  for (const arista of grafo.aristas) {
    const a = grafo.nodos[arista[0]], b = grafo.nodos[arista[1]]
    const ax = (a[0] - p[0]) * METROS_POR_GRADO * coseno, ay = (a[1] - p[1]) * METROS_POR_GRADO
    const dx = (b[0] - a[0]) * METROS_POR_GRADO * coseno, dy = (b[1] - a[1]) * METROS_POR_GRADO
    const l2 = dx * dx + dy * dy
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2))
    const d = Math.hypot(ax + dx * t, ay + dy * t)
    if (!mejor || d < mejor.metros) mejor = { metros: d, t, arista }
  }
  if (!mejor) return null
  const a = grafo.nodos[mejor.arista[0]], b = grafo.nodos[mejor.arista[1]]
  return { punto: [a[0] + (b[0] - a[0]) * mejor.t, a[1] + (b[1] - a[1]) * mejor.t], metros: mejor.metros, nodos: mejor.arista }
}

/** El nodo del grafo más cercano a un punto, y a cuántos metros está. */
function nodoMasCercano(grafo: Grafo, p: Coordenada): { nodo: number; metros: number } {
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
function caminoMasCorto(grafo: Grafo, desde: number, hasta: number): Coordenada[] | null {
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
 * Un salto corto que por las calles obliga a un rodeo largo se hace en recto:
 * cruzar una plaza, o la mediana de una avenida de doble calzada, que en
 * OpenStreetMap son dos vías sin un punto en común.
 */
const SALTO_CORTO = 60
const RODEO = 3

const largo = (camino: Coordenada[]) => camino.reduce((s, p, i) => (i === 0 ? 0 : s + metros(camino[i - 1], p)), 0)

/**
 * La línea del recorrido a partir de sus esquinas. Pegada a las calles, cada
 * tramo va de una esquina a la siguiente por el camino más corto; si una
 * esquina cae lejos de toda calle, o no hay camino, ese tramo va recto.
 *
 * `rectos`: los tramos que se piden rectos (por la esquina de la que salen),
 * como un cruce que por el mapa haría un zigzag por los pasos de peatones.
 * Van de calle a calle, entre los mismos puntos en que se engancharían sus
 * vecinos, para que la línea no se corte.
 */
export function lineaDelRecorrido(esquinas: Coordenada[], pegado: boolean, grafo: Grafo | null, rectos: readonly number[] = []): Coordenada[] {
  // Con una sola esquina todavía no hay línea (y el servidor no guarda líneas de un punto).
  if (esquinas.length < 2) return []
  if (!pegado || !grafo || grafo.nodos.length === 0) return [...esquinas]
  const n = esquinas.length
  const cercanos = esquinas.map((e) => nodoMasCercano(grafo, e))
  const linea: Coordenada[] = []
  const anade = (tramo: Coordenada[]) => {
    for (const p of tramo) {
      const ultimo = linea[linea.length - 1]
      if (!ultimo || ultimo[0] !== p[0] || ultimo[1] !== p[1]) linea.push(p)
    }
  }

  // La salida y la entrada van a su punto exacto de la calle, y desde ahí se
  // entra en el grafo por el nodo de su trozo que deja el camino más corto.
  const extremo = (e: Coordenada) => {
    const s = sobreLaCalle(grafo, e)
    return s && s.metros <= MAXIMO_PARA_PEGAR ? s : null
  }
  const salida = extremo(esquinas[0])
  const entrada = extremo(esquinas[n - 1])
  // Por dónde puede entrar en el grafo cada esquina, lo que anda hasta ese
  // nodo y el punto donde de verdad empieza o acaba el tramo.
  const entradas = (i: number): { nodo: number; extra: number; punto: Coordenada }[] => {
    const s = i === 0 ? salida : i === n - 1 ? entrada : null
    if (s) return s.nodos.map((k) => ({ nodo: k, extra: metros(s.punto, grafo.nodos[k]), punto: s.punto }))
    const c = cercanos[i]
    return c.metros <= MAXIMO_PARA_PEGAR ? [{ nodo: c.nodo, extra: 0, punto: grafo.nodos[c.nodo] }] : []
  }

  if (salida) anade([salida.punto])
  for (let i = 1; i < n; i++) {
    const desde = entradas(i - 1), hasta = entradas(i)
    if (desde.length === 0 || hasta.length === 0) {
      anade([desde[0]?.punto ?? esquinas[i - 1], hasta[0]?.punto ?? esquinas[i]])
      continue
    }
    if (rectos.includes(i - 1)) {
      anade([desde[0].punto, hasta[0].punto])
      continue
    }
    // La salida y la entrada en el mismo trozo de calle: de una a otra, sin ir a sus nodos.
    if (desde[0].punto !== grafo.nodos[desde[0].nodo] && hasta[0].punto !== grafo.nodos[hasta[0].nodo]
      && desde.every((d) => hasta.some((h) => h.nodo === d.nodo))) {
      anade([desde[0].punto, hasta[0].punto])
      continue
    }
    let mejor: { camino: Coordenada[]; total: number; a: Coordenada; b: Coordenada } | null = null
    for (const a of desde) {
      for (const b of hasta) {
        const camino = a.nodo === b.nodo ? [grafo.nodos[a.nodo]] : caminoMasCorto(grafo, a.nodo, b.nodo)
        if (!camino) continue
        const total = a.extra + largo(camino) + b.extra
        if (!mejor || total < mejor.total) mejor = { camino, total, a: a.punto, b: b.punto }
      }
    }
    if (!mejor) { anade([desde[0].punto, hasta[0].punto]); continue }
    const recto = metros(mejor.a, mejor.b)
    anade(recto <= SALTO_CORTO && mejor.total > recto * RODEO ? [mejor.a, mejor.b] : [mejor.a, ...mejor.camino, mejor.b])
  }
  if (entrada) anade([entrada.punto])
  // Seis decimales: unos 10 cm, de sobra, y la mitad de texto al guardar.
  return linea.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6])
}

/**
 * El trazo a mano alzada, limpio (Douglas-Peucker en metros): trae cientos de
 * puntos y el temblor del dedo; quedan solo las esquinas que se apartan más de
 * `tolerancia` metros de la línea, y esas se pueden retocar una a una.
 */
export function simplificar(linea: Coordenada[], tolerancia: number): Coordenada[] {
  if (linea.length < 3) return linea
  const coseno = Math.cos((linea[0][1] * Math.PI) / 180)
  const xy = linea.map(([x, y]) => [x * METROS_POR_GRADO * coseno, y * METROS_POR_GRADO])
  const guarda = new Uint8Array(linea.length)
  guarda[0] = guarda[linea.length - 1] = 1
  const pendientes: [number, number][] = [[0, linea.length - 1]]
  while (pendientes.length > 0) {
    const [a, b] = pendientes.pop()!
    const [ax, ay] = xy[a], [bx, by] = xy[b]
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
    let peor = -1, maxima = 0
    for (let i = a + 1; i < b; i++) {
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((xy[i][0] - ax) * dx + (xy[i][1] - ay) * dy) / l2))
      const d = Math.hypot(xy[i][0] - (ax + dx * t), xy[i][1] - (ay + dy * t))
      if (d > maxima) { maxima = d; peor = i }
    }
    if (maxima > tolerancia) { guarda[peor] = 1; pendientes.push([a, peor], [peor, b]) }
  }
  return linea.filter((_, i) => guarda[i] === 1)
}

/**
 * Los tramos rectos después de retocar las esquinas: con una esquina metida
 * en medio, los de detrás se corren uno; con una quitada, se pierden los dos
 * tramos que la tocaban y los de detrás se corren hacia atrás. Con otro
 * trazo entero (dibujado de nuevo), ninguno: ya no son los mismos tramos.
 */
export function rectosTrasCambio(antes: Coordenada[], despues: Coordenada[], rectos: readonly number[]): number[] {
  const igual = (a: Coordenada, b: Coordenada) => a[0] === b[0] && a[1] === b[1]
  const primeraDistinta = () => {
    let k = 0
    while (k < antes.length && k < despues.length && igual(antes[k], despues[k])) k++
    return k
  }
  if (despues.length === antes.length) return rectos.filter((i) => i < despues.length - 1)
  if (despues.length === antes.length + 1) {
    const k = primeraDistinta()
    return rectos.map((i) => (i >= k ? i + 1 : i))
  }
  if (despues.length === antes.length - 1) {
    const k = primeraDistinta()
    return rectos.filter((i) => i !== k && i !== k - 1).map((i) => (i > k ? i - 1 : i))
  }
  return []
}
