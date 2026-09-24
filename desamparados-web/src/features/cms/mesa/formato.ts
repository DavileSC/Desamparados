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

/** Los de cada salida: el Rosario tiene sus propias insignias y su trono, y se va de traje. */
export const PUESTOS_POR_SALIDA: Record<'PASION' | 'ROSARIO', PuestoDelCatalogo[]> = {
  PASION: PUESTOS,
  ROSARIO: catalogo.rosario as PuestoDelCatalogo[],
}

export const NOMBRE_SALIDA = { PASION: 'Sábado de Pasión', ROSARIO: 'Rosario vespertino' } as const

export const puestoDelCatalogo = (nombre: string, salida: 'PASION' | 'ROSARIO' = 'PASION') =>
  PUESTOS_POR_SALIDA[salida].find((p) => p.nombre.localeCompare(nombre.trim(), 'es', { sensitivity: 'base' }) === 0) ?? null

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

const NOMBRE_PRENDA: Record<string, string> = { TUNICA: 'túnica', CAPIROTE: 'capirote', FARAONA: 'faraona', CAPA: 'capa', OTRO: 'prenda' }

/** Una prenda del ropero por su nombre: «túnica 145-31». */
export const nombrePrenda = (p: { tipo: string; numero: string }) => `${NOMBRE_PRENDA[p.tipo] ?? 'prenda'} ${p.numero}`

/** «túnica 145-31, capirote 150 y cíngulo»: lo que alguien tiene sin devolver. */
export function ropaSinDevolver(prendas: { tipo: string; numero: string }[], cingulos: number) {
  const partes = [...prendas.map(nombrePrenda), ...(cingulos > 0 ? [cingulos === 1 ? 'cíngulo' : `${cingulos} cíngulos`] : [])]
  return partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}
