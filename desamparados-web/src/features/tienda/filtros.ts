/**
 * Los filtros y el orden de la tienda, sin pantalla. Todo se calcula en el
 * navegador con el catálogo que ya ha llegado: son pocos productos y así
 * cambiar un filtro es al momento, sin ir al servidor.
 */
import type { Producto } from '../../lib/api/tienda'
import { agotado } from './cesta'

export type Orden = 'destacados' | 'recientes' | 'caro' | 'barato'

export const ORDENES: { id: Orden; nombre: string }[] = [
  { id: 'destacados', nombre: 'Destacados' },
  { id: 'recientes', nombre: 'Lo más reciente' },
  { id: 'caro', nombre: 'Precio: de mayor a menor' },
  { id: 'barato', nombre: 'Precio: de menor a mayor' },
]

/** Los tramos de precio. Cada uno incluye su tope: 5,00 € está en «Hasta 5 €». */
export const TRAMOS = [
  { id: 'hasta5', nombre: 'Hasta 5 €', desde: -Infinity, hasta: 5 },
  { id: '5a15', nombre: 'De 5 a 15 €', desde: 5, hasta: 15 },
  { id: '15a30', nombre: 'De 15 a 30 €', desde: 15, hasta: 30 },
  { id: 'mas30', nombre: 'Más de 30 €', desde: 30, hasta: Infinity },
] as const

export type IdTramo = (typeof TRAMOS)[number]['id']

export interface Filtros {
  /** Null: todas. */
  categoria: number | null
  tramos: IdTramo[]
  tallas: string[]
  sinAgotados: boolean
}

export const SIN_FILTROS: Filtros = { categoria: null, tramos: [], tallas: [], sinAgotados: false }

export const enTramo = (precio: number, id: IdTramo) => {
  const t = TRAMOS.find((x) => x.id === id)!
  return precio > t.desde && precio <= t.hasta
}

/** Cuántos filtros hay puestos, sin contar la categoría (que se ve en el título). */
export const cuantosFiltros = (f: Filtros) => f.tramos.length + f.tallas.length + (f.sinAgotados ? 1 : 0)

export const hayFiltros = (f: Filtros) => f.categoria !== null || cuantosFiltros(f) > 0

/** El tramo y la talla aceptan cualquiera de los marcados; los filtros entre sí, todos a la vez. */
export function filtrar(productos: Producto[], f: Filtros): Producto[] {
  return productos.filter((p) => (f.categoria === null || p.categoriaId === f.categoria)
    && (f.tramos.length === 0 || f.tramos.some((t) => enTramo(p.precio, t)))
    // Con una talla marcada, solo lo que la tiene y no está agotada en ella:
    // enseñar una camiseta cuya M no queda, a quien busca la M, no le sirve.
    && (f.tallas.length === 0 || p.tallas.some((t) => f.tallas.includes(t.nombre) && t.existencias !== 0))
    && (!f.sinAgotados || !agotado(p)))
}

/** «Destacados» es el orden del CMS, tal como llega; el resto, sobre una copia. */
export function ordenar(productos: Producto[], orden: Orden): Producto[] {
  const copia = [...productos]
  if (orden === 'recientes') return copia.sort((a, b) => b.creadoEl.localeCompare(a.creadoEl) || b.id - a.id)
  if (orden === 'caro') return copia.sort((a, b) => b.precio - a.precio)
  if (orden === 'barato') return copia.sort((a, b) => a.precio - b.precio)
  return copia
}

/** Las tallas que hay en la tienda, en el orden en que aparecen: si ninguno tiene, no hay filtro de talla. */
export function tallasDeLaTienda(productos: Producto[]): string[] {
  return [...new Set(productos.flatMap((p) => p.tallas.map((t) => t.nombre)))]
}
