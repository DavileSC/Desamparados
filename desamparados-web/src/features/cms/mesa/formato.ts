import catalogo from '../../../../../shared/puestos-procesion.json'
import type { MetodoPago } from '../../../lib/api/contabilidad'

/** Un puesto del catálogo y la ropa que suele llevar (shared/puestos-procesion.json). */
export interface PuestoDelCatalogo {
  nombre: string
  tunica: boolean
  tocado: 'CAPIROTE' | 'FARAONA' | null
  alturaHombro: boolean
}

export const PUESTOS = catalogo.puestos as PuestoDelCatalogo[]

export const puestoDelCatalogo = (nombre: string) =>
  PUESTOS.find((p) => p.nombre.localeCompare(nombre.trim(), 'es', { sensitivity: 'base' }) === 0) ?? null

/** «06/05/2009», como en la hoja: la fecha de nacimiento es lo que distingue a dos Alejandro García. */
export function fechaCorta(iso: string) {
  const [anio, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}

/** El día AAAA-MM-DD de una fecha del censo, para un campo de fecha. */
export const diaDe = (iso: string) => iso.slice(0, 10)

export const euros = (valor: number) => `${valor.toFixed(2).replace('.', ',')} €`

/** 145 → «1,45»: la altura de hombro como la dicta quien talla. */
export const alturaEnMetros = (cm: number | null) => (cm === null ? '' : (cm / 100).toFixed(2).replace('.', ','))

export const METODOS: { valor: Exclude<MetodoPago, 'DOMICILIACION'>; etiqueta: string }[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
  { valor: 'BIZUM', etiqueta: 'Bizum' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
]

export const NOMBRE_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', BIZUM: 'Bizum', TRANSFERENCIA: 'Transferencia', DOMICILIACION: 'Domiciliación',
}

export const mensajeDe = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto)
