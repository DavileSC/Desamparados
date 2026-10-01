import { esDniValido, normalizarDni } from './validacion/identidad'

/** Lo que pide Hacienda para que el donativo desgrave (ver `datosFiscales` en el servidor). */
export interface DatosFiscales { nif: string; nombre: string; apellidos: string; codigoPostal: string }

export interface CertificadoPedido extends DatosFiscales { quiere: boolean }

export const SIN_CERTIFICADO: CertificadoPedido = { quiere: false, nif: '', nombre: '', apellidos: '', codigoPostal: '' }

/**
 * Un DNI o NIE con su letra, o la forma de un CIF (la cifra de control del
 * CIF la comprueba el servidor: aquí basta con no dejar pasar lo que no se
 * parece a un NIF).
 */
export const nifPareceBueno = (v: string) => esDniValido(v) || /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(normalizarDni(v))

/** Español: de él sale la provincia que se declara. */
export const codigoPostalBueno = (v: string) => /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/.test(v.trim())

/** Lo que se manda: null si no lo quiere; si lo quiere, ya limpio. */
export function datosFiscalesDe(c: CertificadoPedido): DatosFiscales | null {
  if (!c.quiere) return null
  return { nif: normalizarDni(c.nif), nombre: c.nombre.trim(), apellidos: c.apellidos.trim(), codigoPostal: c.codigoPostal.trim() }
}

/** Si no lo quiere, vale; si lo quiere, cuando están los cuatro datos y parecen buenos. */
export const certificadoCompleto = (c: CertificadoPedido) =>
  !c.quiere || (nifPareceBueno(c.nif) && c.nombre.trim() !== '' && c.apellidos.trim() !== '' && codigoPostalBueno(c.codigoPostal))
