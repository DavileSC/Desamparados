import type { CampoInforme } from '../../../lib/api/datos'

/**
 * El año que se abre sin elegir: de enero a marzo, el anterior (es cuando se
 * termina de escribir y se presenta al cabildo); desde abril, el de ahora, que
 * se va preparando mientras transcurre.
 */
export function anioPorDefecto(hoy = new Date()): number {
  return hoy.getMonth() < 3 ? hoy.getFullYear() - 1 : hoy.getFullYear()
}

/** Lo que escribe cada cargo: igual que `puedeEscribir` del backend. */
export function puedeEscribir(role: string | undefined, campo: CampoInforme): boolean {
  if (role === 'ADMIN' || role === 'HERMANO_MAYOR') return true
  return role === 'SECRETARIA' && (campo === 'epilogo' || campo === 'firmaEpilogo')
}
