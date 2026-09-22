import type { EstadoCivil, FormaDePago, Sexo } from '../../../lib/api/perfil'
import { PARENTESCOS } from '../../../lib/api/auth'
import { METODO_PAGO } from '../recibos/etiquetas'

/** Cómo se leen los valores de la ficha, que en la base de datos van en mayúsculas. */
export const SEXO: Record<Sexo, string> = { HOMBRE: 'Hombre', MUJER: 'Mujer' }

export const ESTADO_CIVIL: Record<EstadoCivil, string> = {
  SOLTERO: 'Soltero o soltera',
  CASADO: 'Casado o casada',
  PAREJA_DE_HECHO: 'Pareja de hecho',
  SEPARADO: 'Separado o separada',
  DIVORCIADO: 'Divorciado o divorciada',
  VIUDO: 'Viudo o viuda',
}

/** Las que tienen sentido para los recibos de un hermano: la tarjeta es de ventanilla. */
export const FORMAS_DE_PAGO: FormaDePago[] = ['DOMICILIACION', 'TRANSFERENCIA', 'BIZUM', 'EFECTIVO']
export const FORMA_DE_PAGO: Record<FormaDePago, string> = METODO_PAGO

export const PARENTESCO: Record<string, string> = Object.fromEntries(PARENTESCOS.map((p) => [p.value, p.label]))

/**
 * El día de Madrid (AAAA-MM-DD) de lo que guarda el servidor. Las fechas de la
 * ficha son de día: el alta, el bautismo y la jura se guardan al empezar el día
 * en Madrid y el nacimiento a medianoche UTC, y las dos caen en el mismo día
 * leídas en Madrid. 'en-CA' formatea justo como AAAA-MM-DD.
 */
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
export const aDia = (iso: string | null) => (iso ? formatoDia.format(new Date(iso)) : '')

/** AAAA-MM-DD → dd/mm/aaaa. */
export const diaLegible = (iso: string | null) => (iso ? aDia(iso).split('-').reverse().join('/') : '')
