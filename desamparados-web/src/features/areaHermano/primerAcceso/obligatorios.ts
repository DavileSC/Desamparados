import LISTA from '../../../../../shared/ficha-obligatoria.json'
import type { ApiProfile } from '../../../lib/api/perfil'

/**
 * Lo que una ficha no puede tener vacío para confirmarla en el primer acceso:
 * lo mismo que pide el alta por la web. La lista es la del servidor
 * (`shared/ficha-obligatoria.json`), que rechaza confirmar si falta algo; aquí
 * sirve para pedir justo eso y no dejar pulsar «Sí, es correcto» antes.
 */
export type TipoDeCampo = 'texto' | 'dni' | 'fecha' | 'sexo' | 'estadoCivil' | 'correo' | 'telefono' | 'codigoPostal' | 'parentesco' | 'iban' | 'titularidad'

export interface CampoDeFicha {
  campo: keyof ApiProfile
  etiqueta: string
  tipo: TipoDeCampo
}

const lista = LISTA as unknown as Record<'titular' | 'familiar' | 'domiciliacion' | 'opcionalesDelTitular', CampoDeFicha[]>

/** El IBAN nunca llega: se sabe que está porque llega enmascarado. */
const valorDe = (ficha: ApiProfile, campo: keyof ApiProfile): unknown => {
  if (campo === 'iban' as keyof ApiProfile) return ficha.ibanEnmascarado
  // Las fichas de antes de separar los apellidos solo tienen los dos juntos.
  if (campo === 'primerApellido') return ficha.primerApellido ?? ficha.apellidos
  return ficha[campo]
}

export const estaVacio = (ficha: ApiProfile, campo: keyof ApiProfile) => {
  const valor = valorDe(ficha, campo)
  return valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '')
}

/** Los obligatorios de los datos de quien tiene la cuenta (sin la cuota, que va en su paso). */
export const faltanDeTusDatos = (ficha: ApiProfile) => lista.titular.filter((c) => estaVacio(ficha, c.campo))

/** Los de la cuota: solo si domicilia, que entonces hacen falta la cuenta y de quién es. */
export function faltanDeLaCuota(ficha: ApiProfile): CampoDeFicha[] {
  if (ficha.formaPagoPref !== 'DOMICILIACION') return []
  const faltan = lista.domiciliacion.filter((c) => estaVacio(ficha, c.campo))
  if (ficha.titularidadCuenta && ficha.titularidadCuenta !== 'PROPIA' && estaVacio(ficha, 'titularCuenta')) {
    faltan.push({ campo: 'titularCuenta', etiqueta: 'Titular de la cuenta', tipo: 'texto' })
  }
  return faltan
}

/** Los de quien cuelga de la cuenta, parentesco incluido. */
export const faltanDelFamiliar = (ficha: ApiProfile) => lista.familiar.filter((c) => estaVacio(ficha, c.campo))

/** Lo que puede añadir si quiere y aún no tiene. */
export const opcionalesVacios = (ficha: ApiProfile) => lista.opcionalesDelTitular.filter((c) => estaVacio(ficha, c.campo))

/** «teléfono móvil y estado civil», para decirlo en una frase. «DNI» se queda en mayúsculas. */
export function enUnaFrase(campos: CampoDeFicha[]): string {
  const nombres = campos.map(({ etiqueta }) => (/^[A-ZÁÉÍÓÚ]{2}/.test(etiqueta) ? etiqueta : etiqueta.charAt(0).toLowerCase() + etiqueta.slice(1)))
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres.join('')
}
