import type { ParadaRecorrido, PuntoDePlano } from '../../lib/api/contenido'

/**
 * Las cuentas del trazado de un recorrido sobre su plano. Las comparten la web,
 * que dibuja la línea según se baja, y el CMS, que la traza y sitúa las paradas.
 *
 * Los puntos se guardan en tanto por ciento del ancho y del alto del plano,
 * pero las distancias se miden con la proporción de la foto (`aspecto` =
 * ancho / alto): si no, en un plano apaisado un tramo horizontal contaría
 * menos que uno vertical igual de largo, y el trono correría en unas calles y
 * se arrastraría en otras.
 */

interface Punto { x: number; y: number }

const aEspacio = (p: PuntoDePlano, aspecto: number): Punto => ({ x: p.x * aspecto, y: p.y })

/** Largo de cada tramo y el total, en las unidades con proporción. */
function tramos(trazado: PuntoDePlano[], aspecto: number): { largos: number[]; total: number } {
  const largos: number[] = []
  for (let i = 1; i < trazado.length; i++) {
    const a = aEspacio(trazado[i - 1], aspecto)
    const b = aEspacio(trazado[i], aspecto)
    largos.push(Math.hypot(b.x - a.x, b.y - a.y))
  }
  return { largos, total: largos.reduce((suma, l) => suma + l, 0) }
}

/** El punto del trazado a esa fracción del recorrido (0 salida, 1 entrada), en tanto por ciento. */
export function puntoEn(trazado: PuntoDePlano[], aspecto: number, fraccion: number): PuntoDePlano {
  if (trazado.length === 0) return { x: 0, y: 0 }
  if (trazado.length === 1) return trazado[0]
  const { largos, total } = tramos(trazado, aspecto)
  if (total === 0) return trazado[0]
  let falta = Math.min(1, Math.max(0, fraccion)) * total
  for (let i = 0; i < largos.length; i++) {
    if (falta <= largos[i] || i === largos.length - 1) {
      const t = largos[i] === 0 ? 0 : Math.min(1, falta / largos[i])
      const a = trazado[i]
      const b = trazado[i + 1]
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    falta -= largos[i]
  }
  return trazado[trazado.length - 1]
}

/** La fracción del recorrido del punto del trazado más cercano a `p`. Para situar una parada pulsando en el plano. */
export function fraccionMasCercana(trazado: PuntoDePlano[], aspecto: number, p: PuntoDePlano): number {
  if (trazado.length < 2) return 0
  const { largos, total } = tramos(trazado, aspecto)
  if (total === 0) return 0
  const q = aEspacio(p, aspecto)
  let mejor = { distancia: Infinity, recorrido: 0 }
  let antes = 0
  for (let i = 0; i < largos.length; i++) {
    const a = aEspacio(trazado[i], aspecto)
    const b = aEspacio(trazado[i + 1], aspecto)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const t = largos[i] === 0 ? 0 : Math.min(1, Math.max(0, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (largos[i] * largos[i])))
    const distancia = Math.hypot(a.x + dx * t - q.x, a.y + dy * t - q.y)
    if (distancia < mejor.distancia) mejor = { distancia, recorrido: antes + largos[i] * t }
    antes += largos[i]
  }
  return mejor.recorrido / total
}

/**
 * Dónde cae cada parada en el recorrido. Las situadas en el plano usan su
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

/** El atributo `points` de la línea en un SVG cuyo `viewBox` es `0 0 (100·aspecto) 100`. */
export const puntosSvg = (trazado: PuntoDePlano[], aspecto: number): string =>
  trazado.map((p) => `${(p.x * aspecto).toFixed(2)},${p.y.toFixed(2)}`).join(' ')
