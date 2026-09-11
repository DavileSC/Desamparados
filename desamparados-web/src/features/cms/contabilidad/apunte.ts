import type { ApunteManual, Category, MetodoPago, TipoApunte, Transaction } from '../../../lib/api/accounting'
import { dia } from './filtros'

/**
 * El formulario de un apunte manual, tal como se teclea. Las mismas reglas que
 * el servidor (transaccion.schema.ts): así el error sale en el campo al
 * escribir y no como un «Error de validación» al guardar.
 */
export interface FormApunte {
  tipo: TipoApunte
  categoriaId: string
  concepto: string
  importe: string
  /** `AAAA-MM-DD`. */
  fecha: string
  metodoPago: '' | MetodoPago
}

/** Un apunte nuevo: fechado hoy y sin método elegido (el método se elige siempre a propósito). */
export const apunteNuevo = (hoy = new Date()): FormApunte => ({ tipo: 'INGRESO', categoriaId: '', concepto: '', importe: '', fecha: dia(hoy), metodoPago: '' })

/** El formulario de corregir, relleno con lo que tiene el apunte. */
export function apunteDesde(t: Transaction): FormApunte {
  return {
    tipo: t.tipo,
    categoriaId: t.categoriaId ? String(t.categoriaId) : '',
    concepto: t.concepto,
    importe: String(Number(t.importe)),
    // El día en que se ve en el libro (fechaCorta también lee la hora local).
    fecha: dia(new Date(t.fecha)),
    metodoPago: t.metodoPago ?? '',
  }
}

// Ocho cifras enteras y dos decimales como mucho: el Decimal(10,2) de la base de datos.
const IMPORTE = /^\d{1,8}([.,]\d{1,2})?$/
const FECHA = /^\d{4}-\d{2}-\d{2}$/

export const aNumero = (importe: string) => Number(importe.trim().replace(',', '.'))

export function errorImporte(importe: string): string | null {
  const texto = importe.trim()
  if (!texto) return null // Vacío no es un error que enseñar: el botón ya queda deshabilitado.
  if (texto.startsWith('-')) return 'Tiene que ser mayor que cero.'
  // Con tres decimales, la base de datos redondeaba sin avisar: 12,345 € quedaba en 12,35 €.
  if (/^\d+[.,]\d{3,}$/.test(texto)) return 'Como mucho dos decimales.'
  if (!IMPORTE.test(texto)) return /^\d{9,}/.test(texto) ? 'No puede pasar de 99.999.999,99 €.' : 'Escribe un importe como 12,50.'
  if (aNumero(texto) <= 0) return 'Tiene que ser mayor que cero.'
  return null
}

export function errorFecha(fecha: string, hoy = new Date()): string | null {
  if (!fecha) return 'Elige la fecha.'
  if (!FECHA.test(fecha)) return 'Fecha no válida.'
  const [a, m, d] = fecha.split('-').map(Number)
  const real = new Date(a, m - 1, d)
  if (a < 1900 || real.getFullYear() !== a || real.getMonth() !== m - 1 || real.getDate() !== d) return 'Fecha no válida.'
  if (fecha > dia(hoy)) return 'No puede ser posterior a hoy.'
  return null
}

export const errorConcepto = (concepto: string) =>
  concepto.length > 191 ? 'Como mucho 191 caracteres.' : /[<>]/.test(concepto) ? 'Sin los signos < ni >.' : null

/** ¿Se puede mandar? Todo relleno y sin errores. */
export function apunteCompleto(form: FormApunte, hoy = new Date()): boolean {
  return Boolean(form.categoriaId && form.metodoPago && form.importe.trim())
    && form.concepto.trim().length >= 4
    && !errorConcepto(form.concepto)
    && !errorImporte(form.importe)
    && !errorFecha(form.fecha, hoy)
}

export function aApunteManual(form: FormApunte): ApunteManual {
  return {
    tipo: form.tipo,
    categoriaId: Number(form.categoriaId),
    concepto: form.concepto.trim(),
    importe: aNumero(form.importe),
    fecha: form.fecha,
    metodoPago: form.metodoPago as MetodoPago,
  }
}

/** El nombre de una categoría, con las reglas del servidor: de 3 a 60 caracteres útiles y sin < ni >. */
export function errorNombreCategoria(nombre: string): string | null {
  const limpio = nombre.trim()
  if (limpio.length < 3) return 'Al menos 3 caracteres.'
  if (limpio.length > 60) return 'Como mucho 60 caracteres.'
  if (/[<>]/.test(limpio)) return 'Sin los signos < ni >.'
  return null
}

/**
 * Categorías que se ofrecen para un apunte: las activas de su tipo y, al
 * corregir, también la que ya tenía aunque se haya desactivado después (el
 * servidor la admite: corregir el importe no obliga a recategorizar).
 */
export function categoriasParaApunte(categorias: Category[], tipo: TipoApunte, actualId?: string): Category[] {
  return categorias.filter((c) => c.tipo === tipo && (c.activa !== false || String(c.id) === actualId))
}
