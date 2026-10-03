import type { Producto, TallaDeProducto } from '../../lib/api/tienda'

/**
 * La cesta de la tienda: cuántas de cada cosa, por clave. Un producto sin
 * tallas va por su id («12»); uno con tallas, por producto y talla («12:40»),
 * porque una M y una L son dos líneas del pedido.
 */
export type Cesta = Record<string, number>

/** Lo más que se pide de una línea: el tope del servidor. */
export const MAX_POR_LINEA = 20
/** Desde cuántas se avisa de que quedan pocas. */
export const POCAS = 5

const CLAVE_CESTA = 'tienda-cesta'

export const claveDe = (productoId: number, tallaId?: number | null) => (tallaId ? `${productoId}:${tallaId}` : String(productoId))

/** La cesta vive en el navegador: si se recarga la página o se vuelve del banco, sigue ahí. */
export function leerCesta(): Cesta {
  try {
    const leida: unknown = JSON.parse(window.localStorage.getItem(CLAVE_CESTA) ?? '{}')
    if (!leida || typeof leida !== 'object' || Array.isArray(leida)) return {}
    return Object.fromEntries(Object.entries(leida).filter(([, n]) => Number.isInteger(n) && (n as number) > 0)) as Cesta
  } catch { return {} }
}

export function guardarCesta(cesta: Cesta) {
  try { window.localStorage.setItem(CLAVE_CESTA, JSON.stringify(cesta)) } catch { /* sin almacenamiento, la cesta dura lo que la página */ }
}

export const conTallas = (p: Producto) => p.tallas.length > 0

/** Cuántas quedan de un producto, o de una de sus tallas. Null: sin límite. */
export function quedanDe(p: Producto, talla?: TallaDeProducto | null): number | null {
  if (!conTallas(p)) return p.existencias
  return talla ? talla.existencias : null
}

/**
 * Cuántas quedan en total, para el sello de la tarjeta. Con tallas, la suma
 * de todas; si alguna es sin límite, sin límite.
 */
export function quedanEnTotal(p: Producto): number | null {
  if (!conTallas(p)) return p.existencias
  if (p.tallas.some((t) => t.existencias === null)) return null
  return p.tallas.reduce((s, t) => s + (t.existencias ?? 0), 0)
}

export const agotado = (p: Producto) => quedanEnTotal(p) === 0

/** La primera talla que queda: la que se ofrece de entrada. */
export const primeraConExistencias = (p: Producto) => p.tallas.find((t) => t.existencias !== 0) ?? null

/** Lo que se puede añadir de una línea: el tope del servidor, o lo que queda si es menos. */
export const topeDe = (quedan: number | null) => Math.min(MAX_POR_LINEA, quedan ?? MAX_POR_LINEA)

export const nombreConTalla = (nombre: string, talla: string | null | undefined) => (talla ? `${nombre} (talla ${talla})` : nombre)

export interface LineaDeLaCesta {
  clave: string
  producto: Producto
  talla: TallaDeProducto | null
  cantidad: number
}

/**
 * Las líneas de la cesta que siguen siendo válidas con el catálogo de hoy. Lo
 * que ya no está (un producto retirado, una talla quitada, un producto que
 * ahora tiene tallas) se cae sin más: la cesta es de este navegador y no
 * merece un aviso. La cantidad se ajusta a lo que queda.
 */
export function lineasDeLaCesta(cesta: Cesta, productos: Producto[]): LineaDeLaCesta[] {
  const porId = new Map(productos.map((p) => [p.id, p]))
  return Object.entries(cesta).flatMap(([clave, cantidad]) => {
    const [idProducto, idTalla] = clave.split(':').map(Number)
    const producto = porId.get(idProducto)
    if (!producto) return []
    const talla = idTalla ? producto.tallas.find((t) => t.id === idTalla) ?? null : null
    if (conTallas(producto) !== Boolean(talla)) return []
    const tope = topeDe(quedanDe(producto, talla))
    if (tope <= 0) return []
    return [{ clave, producto, talla, cantidad: Math.min(cantidad, tope) }]
  })
}

/** «12,00 €». */
export const euros = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
export const enlaceDeFicha = (p: Producto) => `/tienda/producto/${p.id}`

/** Lo que se dice debajo de las tallas: si quedan pocas de la elegida y cuáles están agotadas. */
export function avisoDeTallas(producto: Producto, elegida: TallaDeProducto | null) {
  const agotadas = producto.tallas.filter((t) => t.existencias === 0).map((t) => t.nombre)
  const partes: string[] = []
  if (elegida && elegida.existencias !== null && elegida.existencias <= POCAS) {
    partes.push(`Quedan ${elegida.existencias} en la ${elegida.nombre}.`)
  }
  if (agotadas.length === 1) partes.push(`La ${agotadas[0]}, agotada.`)
  else if (agotadas.length > 1) partes.push(`Agotadas: ${agotadas.join(', ')}.`)
  return partes.join(' ')
}
