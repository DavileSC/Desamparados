import type { BloqueItinerario, Coordenada, ParadaRecorrido } from '../../lib/api/contenido'

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
  return sobreElRecorrido(linea, p).fraccion
}

/**
 * Más lejos que esto de la línea, la posición no se pinta: el GPS de un móvil
 * entre fachadas se desvía unas decenas de metros, pero a cien y pico ya no
 * dice por qué calle va, y el trono saltaría a una que no es.
 */
export const DISTANCIA_MAXIMA_M = 150

/**
 * El punto del recorrido más cercano a otro, en fracción, y a cuántos metros
 * queda: la posición del cortejo en directo llega del GPS de un móvil y hay
 * que llevarla a la calle (y saber si está tan lejos que no es de fiar).
 */
export function sobreElRecorrido(linea: Coordenada[], p: Coordenada): { fraccion: number; distancia: number } {
  if (linea.length === 0) return { fraccion: 0, distancia: Infinity }
  if (linea.length < 2) return { fraccion: 0, distancia: metros(linea[0], p) }
  const hechos = acumulados(linea)
  const total = hechos[hechos.length - 1]
  if (total === 0) return { fraccion: 0, distancia: metros(linea[0], p) }
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
  return { fraccion: mejor.recorrido / total, distancia: mejor.distancia }
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

/** 'HH:mm' → minutos desde medianoche; `null` si está vacía o no lo parece. */
export function aMinutos(hora: string | undefined): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Minutos desde medianoche → 'HH:mm', redondeado a 5 minutos (las horas son aproximadas) y pasada la medianoche, del día siguiente. */
export function aHora(minutos: number): string {
  const t = ((Math.round(minutos / 5) * 5) % 1440 + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Una fila de la lista de al lado del mapa: una calle (o un cruce) o, sin calles, una parada. */
export interface FilaDelRecorrido { hora: string; lugar: string; cruce: boolean }

/** Un sitio de interés: una parada, cuando el recorrido va por calles. */
export interface SitioDelRecorrido { lugar: string; nota: string; hora: string; posicion: number }

export interface LecturaDelRecorrido {
  /** Lo que lleva la lista: las calles si las hay; si no, las paradas, como siempre. */
  filas: FilaDelRecorrido[]
  /** Dónde empieza cada fila en la línea, de 0 a 1 y sin decrecer. */
  posiciones: number[]
  /** Con calles, las paradas pasan aquí, numeradas en el mapa; sin calles, vacía. */
  sitios: SitioDelRecorrido[]
  porCalles: boolean
}

/**
 * Cómo se lee un itinerario con mapa (16-10-2026). Con calles, la lista son las
 * calles y la calle cambia cuando el trono entra en otra; las paradas quedan
 * como sitios de interés. Las horas que no se escribieron a mano se reparten
 * entre la salida y la entrada a ritmo constante, descontando los minutos que
 * el trono se para en cada sitio (las saetas de una peña), y se redondean a 5
 * minutos. Sin salida o sin entrada, solo las escritas a mano.
 */
export function lecturaDelRecorrido(bloque: Pick<BloqueItinerario, 'paradas' | 'recorrido'>): LecturaDelRecorrido {
  const { paradas, recorrido } = bloque
  const calles = recorrido?.calles ?? []
  if (calles.length === 0) {
    return {
      filas: paradas.map((p) => ({ hora: p.hora, lugar: p.lugar, cruce: false })),
      posiciones: posicionesEnRuta(paradas),
      sitios: [],
      porCalles: false,
    }
  }

  const enRuta = posicionesEnRuta(paradas)
  const salida = aMinutos(recorrido?.salida)
  const entrada = aMinutos(recorrido?.entrada)
  // La entrada puede ser pasada la medianoche: de 18:00 a 00:00 son seis horas.
  const total = salida === null || entrada === null ? null : ((entrada - salida + 1440) % 1440) || 1440
  const parado = paradas.reduce((suma, p) => suma + (p.minutos ?? 0), 0)
  const andando = total === null ? 0 : Math.max(0, total - parado)
  /** La hora al llegar a esa fracción: lo andado más las paradas que quedan detrás. */
  const calculada = (f: number) => {
    if (salida === null || total === null) return ''
    const detras = paradas.reduce((suma, p, i) => suma + (enRuta[i] < f - 1e-9 ? (p.minutos ?? 0) : 0), 0)
    return aHora(salida + f * andando + detras)
  }

  const posiciones: number[] = []
  calles.forEach((c, i) => posiciones.push(Math.max(posiciones[i - 1] ?? 0, Math.min(1, Math.max(0, c.desde)))))
  return {
    filas: calles.map((c, i) => ({ hora: c.hora || calculada(posiciones[i]), lugar: c.nombre, cruce: c.cruce === true })),
    posiciones,
    sitios: paradas.map((p, i) => ({ lugar: p.lugar, nota: p.nota ?? '', hora: p.hora || calculada(enRuta[i]), posicion: enRuta[i] })),
    porCalles: true,
  }
}
