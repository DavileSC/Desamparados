import type { MetodoPago } from '../../../lib/api/contabilidad'
import { METODOS } from './filtros'

/** Colores con significado: el azul es siempre ingreso y el granate, gasto. Validados para daltonismo. */
export const COLOR_INGRESO = '#2a78d6'
export const COLOR_GASTO = '#b0414a'

// `useGrouping: 'always'`: el es-ES de Intl no pone el punto de miles hasta los
// cinco dígitos, y «6998 €» junto a «12.874 €» parece un error.
const formatoNumero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })

/** Importe de un apunte: siempre con céntimos, alineable en columna. Cifra de resumen: sin céntimos si son redondos. */
export { euros, eurosRedondos as eurosResumen } from '../../../lib/euros'

/** Número suelto (ejes de la gráfica, recuentos), con punto de miles. */
export const numero = (valor: number) => formatoNumero.format(valor)

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «11 sep 2026». Tres letras siempre: la abreviatura de cada navegador varía («sept.»). */
export function fechaCorta(iso: string) {
  const fecha = new Date(iso)
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`
}

/** «2026-03» → «mar»; «2026» → «2026». */
export const etiquetaPunto = (clave: string) => (clave.length === 4 ? clave : MESES[Number(clave.slice(5, 7)) - 1])

/** «2026-03» → «marzo de 2026»; «2026» → «2026». Para el detalle al pasar el ratón. */
export function etiquetaPuntoLarga(clave: string) {
  if (clave.length === 4) return clave
  const nombre = new Date(Number(clave.slice(0, 4)), Number(clave.slice(5, 7)) - 1, 1).toLocaleDateString('es-ES', { month: 'long' })
  return `${nombre} de ${clave.slice(0, 4)}`
}

/** «2025-01-01»…«2025-09-11» → «1 ene – 11 sep 2025». */
export function tramo(desde: string, hasta: string) {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  return a1 === a2
    ? `${d1} ${MESES[m1 - 1]} – ${d2} ${MESES[m2 - 1]} ${a2}`
    : `${d1} ${MESES[m1 - 1]} ${a1} – ${d2} ${MESES[m2 - 1]} ${a2}`
}

export const etiquetaMetodo = (metodo?: MetodoPago | null) => METODOS.find((m) => m.valor === metodo)?.etiqueta ?? '—'
