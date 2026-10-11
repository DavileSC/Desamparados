import { numero } from '../contabilidad/formato'

/**
 * Concuerda el número con lo que nombra. El panel enseña cifras que muy a
 * menudo valen uno —un grupo pequeño, un mes flojo— y «1 hermanos activos»
 * canta en cuanto se mira. El número se formatea con `numero` (punto de
 * miles): para las cifras pequeñas que usan la mayoría de sus hermanas no
 * cambia nada, pero para recuentos que pueden crecer —como el histórico de
 * publicaciones— evita un «1284 publicaciones» sin punto.
 */
export function contar(n: number, singular: string, plural: string): string {
  return `${numero(n)} ${n === 1 ? singular : plural}`
}


