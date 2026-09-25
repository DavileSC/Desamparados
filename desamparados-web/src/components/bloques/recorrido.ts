import type { Coordenada, ParadaRecorrido } from '../../lib/api/contenido'

/**
 * Las cuentas del recorrido sobre el mapa. Las comparten la web, que dibuja la
 * línea según se baja (o al darle al play), y el CMS, que la traza y sitúa las
 * paradas.
 *
 * Las distancias se miden en metros con la aproximación plana (un barrio mide
 * un par de kilómetros: el error de no usar la esfera es de milímetros).
 */

const METROS_POR_GRADO = 111320

/** Metros entre dos puntos. */
export function metros(a: Coordenada, b: Coordenada): number {
  const coseno = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
  return Math.hypot((b[0] - a[0]) * METROS_POR_GRADO * coseno, (b[1] - a[1]) * METROS_POR_GRADO)
}

/** Lo andado hasta cada punto de la línea: el primero 0, el último el largo total. */
export function acumulados(linea: Coordenada[]): number[] {
  const salida = [0]
  for (let i = 1; i < linea.length; i++) salida.push(salida[i - 1] + metros(linea[i - 1], linea[i]))
  return salida
}

/**
 * La línea desde la salida hasta esa fracción del recorrido (0 salida, 1
 * entrada). Su último punto es donde va el trono. Pasar `hechos` (los
 * acumulados de la línea) ahorra recalcularlos en cada fotograma.
 */
export function tramoHasta(linea: Coordenada[], fraccion: number, hechos = acumulados(linea)): Coordenada[] {
  if (linea.length === 0) return []
  const total = hechos[hechos.length - 1]
  const falta = Math.min(1, Math.max(0, fraccion)) * total
  const salida: Coordenada[] = [linea[0]]
  for (let i = 1; i < linea.length; i++) {
    if (hechos[i] <= falta) { salida.push(linea[i]); continue }
    const largo = hechos[i] - hechos[i - 1]
    const t = largo === 0 ? 0 : (falta - hechos[i - 1]) / largo
    salida.push([linea[i - 1][0] + (linea[i][0] - linea[i - 1][0]) * t, linea[i - 1][1] + (linea[i][1] - linea[i - 1][1]) * t])
    break
  }
  return salida
}

/** El punto del recorrido a esa fracción. */
export const puntoEn = (linea: Coordenada[], fraccion: number, hechos?: number[]): Coordenada => {
  const tramo = tramoHasta(linea, fraccion, hechos)
  return tramo[tramo.length - 1] ?? [0, 0]
}

/** La fracción del recorrido del punto de la línea más cercano a `p`. Para situar una parada pulsando en el mapa. */
export function fraccionMasCercana(linea: Coordenada[], p: Coordenada): number {
  if (linea.length < 2) return 0
  const hechos = acumulados(linea)
  const total = hechos[hechos.length - 1]
  if (total === 0) return 0
  const coseno = Math.cos((p[1] * Math.PI) / 180)
  const x = (c: Coordenada) => (c[0] - p[0]) * METROS_POR_GRADO * coseno
  const y = (c: Coordenada) => (c[1] - p[1]) * METROS_POR_GRADO
  let mejor = { distancia: Infinity, recorrido: 0 }
  for (let i = 1; i < linea.length; i++) {
    const ax = x(linea[i - 1]), ay = y(linea[i - 1])
    const dx = x(linea[i]) - ax, dy = y(linea[i]) - ay
    const l2 = dx * dx + dy * dy
    const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / l2))
    const distancia = Math.hypot(ax + dx * t, ay + dy * t)
    if (distancia < mejor.distancia) mejor = { distancia, recorrido: hechos[i - 1] + (hechos[i] - hechos[i - 1]) * t }
  }
  return mejor.recorrido / total
}

/**
 * Dónde cae cada parada en el recorrido. Las situadas en el mapa usan su
 * `enRuta`; las demás se reparten en línea entre sus vecinas situadas (y, si
 * no hay ninguna, a lo largo de todo el recorrido, la primera en la salida y la
 * última en la entrada). Nunca decrece: una parada no puede quedar detrás de
 * la anterior, que el trono no da marcha atrás.
 */
export function posicionesEnRuta(paradas: ParadaRecorrido[]): number[] {
  const n = paradas.length
  if (n === 0) return []
  const fijas = paradas.map((p, i) => (typeof p.enRuta === 'number' ? i : -1)).filter((i) => i !== -1)
  const valor = (i: number): number => {
    const fija = paradas[i].enRuta
    if (typeof fija === 'number') return fija
    const antes = [...fijas].reverse().find((f) => f < i)
    const despues = fijas.find((f) => f > i)
    const va = antes === undefined ? 0 : paradas[antes].enRuta!
    const vd = despues === undefined ? 1 : paradas[despues].enRuta!
    // Sin vecina situada a un lado, el extremo del recorrido hace de vecina: la
    // primera cae en la salida y la última en la entrada.
    const desde = antes ?? 0
    const hasta = despues ?? n - 1
    if (hasta === desde) return va
    return va + ((vd - va) * (i - desde)) / (hasta - desde)
  }
  const salida: number[] = []
  for (let i = 0; i < n; i++) salida.push(Math.max(salida[i - 1] ?? 0, Math.min(1, Math.max(0, valor(i)))))
  return salida
}

/**
 * La última parada alcanzada con el trono en esa fracción del recorrido, o -1
 * si aún no ha salido. Para el play, que no va por el scroll sino por el reloj.
 */
export function paradaAlcanzada(posiciones: number[], fraccion: number): number {
  let ultima = -1
  posiciones.forEach((p, i) => { if (p <= fraccion + 1e-6) ultima = i })
  return ultima
}
