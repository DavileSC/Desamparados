/**
 * El formulario de un producto en el CMS, sin pantalla: de producto a
 * formulario y vuelta, y qué falta para poder guardarlo.
 */
import type { DatosProducto, FotoDeProducto, Producto } from '../../../lib/api/tienda'

export const PRECIO = /^\d{1,5}(?:[.,]\d{1,2})?$/
export const ENTERO = /^\d{1,6}$/
/** Las de siempre, para no escribirlas una a una. */
export const TALLAS_HABITUALES = ['S', 'M', 'L', 'XL', 'XXL']

export interface TallaEnFormulario {
  id?: number; nombre: string; existencias: string
  /** Lo que tenía al abrir la ficha (no se ve): con él, guardar no pisa lo vendido entretanto. */
  leidas?: number | null
}
export interface Formulario {
  nombre: string; descripcion: string; precio: string; foto: string; fotos: FotoDeProducto[]
  existencias: string; activo: boolean; orden: string
  conTallas: boolean; tallas: TallaEnFormulario[]
  /** El id de su categoría, o '' sin categoría (como lo da el desplegable). */
  categoriaId: string; destacado: boolean
  /** Lo que quedaba al abrir la ficha; no en uno nuevo. */
  leidas?: number | null
}

export const VACIO: Formulario = { nombre: '', descripcion: '', precio: '', foto: '', fotos: [], existencias: '', activo: true, orden: '0', conTallas: false, tallas: [], categoriaId: '', destacado: false }

export const aFormulario = (p: Producto): Formulario => ({
  nombre: p.nombre, descripcion: p.descripcion, precio: p.precio.toFixed(2).replace('.', ','), foto: p.foto ?? '', fotos: p.fotos,
  existencias: p.existencias === null ? '' : String(p.existencias), leidas: p.existencias, activo: p.activo, orden: String(p.orden),
  conTallas: p.tallas.length > 0,
  tallas: p.tallas.map((t) => ({ id: t.id, nombre: t.nombre, existencias: t.existencias === null ? '' : String(t.existencias), leidas: t.existencias })),
  categoriaId: p.categoriaId === null ? '' : String(p.categoriaId), destacado: p.destacado,
})

const tallasValidas = (f: Formulario) => f.tallas.filter((t) => t.nombre.trim())

export const aDatos = (f: Formulario): DatosProducto => {
  // «Tiene tallas» sin ninguna escrita es como no tenerlas.
  const tallas = f.conTallas ? tallasValidas(f) : []
  return {
    nombre: f.nombre.trim(), descripcion: f.descripcion.trim(), precio: Number(f.precio.replace(',', '.')), foto: f.foto || null,
    // Un hueco que se añadió y no se llegó a subir no se guarda.
    fotos: f.fotos.filter((x) => x.url).map((x) => ({ url: x.url, pie: x.pie.trim() })),
    existencias: tallas.length > 0 || f.existencias.trim() === '' ? null : Number(f.existencias),
    ...(f.leidas !== undefined ? { existenciasLeidas: f.leidas } : {}),
    activo: f.activo, orden: Number(f.orden) || 0,
    tallas: tallas.map((t) => ({
      ...(t.id ? { id: t.id } : {}), nombre: t.nombre.trim(), existencias: t.existencias.trim() === '' ? null : Number(t.existencias),
      ...(t.id && t.leidas !== undefined ? { existenciasLeidas: t.leidas } : {}),
    })),
    categoriaId: f.categoriaId ? Number(f.categoriaId) : null, destacado: f.destacado,
  }
}

/** Qué falta para poder guardar, o null si está bien. Se enseña junto al botón. */
export function problemaDe(f: Formulario): string | null {
  if (!f.nombre.trim()) return 'Falta el nombre.'
  if (!PRECIO.test(f.precio.trim()) || Number(f.precio.replace(',', '.')) <= 0) return 'El precio tiene que ser un importe, con dos decimales como mucho.'
  if (!f.conTallas && f.existencias.trim() !== '' && !ENTERO.test(f.existencias.trim())) return '«Quedan» tiene que ser un número entero, o vacío.'
  if (f.conTallas) {
    const nombres = tallasValidas(f).map((t) => t.nombre.trim().toLowerCase())
    if (new Set(nombres).size !== nombres.length) return 'Hay dos tallas con el mismo nombre.'
    if (f.tallas.some((t) => t.existencias.trim() !== '' && !ENTERO.test(t.existencias.trim()))) return 'Lo que queda de cada talla tiene que ser un número entero, o vacío.'
  }
  return null
}

/** Lo que queda en total de un producto, como se dice en la lista. */
export function existenciasEnTexto(p: Producto) {
  if (p.tallas.length > 0) {
    if (p.tallas.some((t) => t.existencias === null)) return 'sin límite'
    const n = p.tallas.reduce((s, t) => s + (t.existencias ?? 0), 0)
    return n === 0 ? 'agotado' : `quedan ${n}`
  }
  return p.existencias === null ? 'sin límite' : p.existencias === 0 ? 'agotado' : `quedan ${p.existencias}`
}
