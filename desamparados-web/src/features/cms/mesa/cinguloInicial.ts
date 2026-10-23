import type { CinguloEnMesa } from '../../../lib/api/mesa'

/**
 * El cíngulo que se propone al dar la ropa: el que va con la túnica y, si toca
 * prestarlo y no queda ninguno, «se le debe».
 */
export function cinguloInicial(propuesto: CinguloEnMesa, quedan: number, sinGastar: boolean): CinguloEnMesa {
  return propuesto === 'PRESTADO' && quedan <= 0 && !sinGastar ? 'DEBIDO' : propuesto
}
