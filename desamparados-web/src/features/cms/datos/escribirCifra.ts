import type { CifraDato } from '../../../lib/api/datos'
import { eurosResumen, numero } from '../contabilidad/formato'

const decimal = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** La cifra escrita igual que en el PDF: con signo las diferencias, con coma la edad. */
export function escribirCifra(c: Pick<CifraDato, 'valor' | 'formato'>): string {
  const signo = c.valor > 0 ? '+' : c.valor < 0 ? '−' : ''
  switch (c.formato) {
    case 'euros': return eurosResumen(Math.round(c.valor))
    case 'decimal': return decimal.format(c.valor)
    case 'diferencia': return `${signo}${numero(Math.abs(c.valor))}`
    case 'diferencia-euros': return `${signo}${eurosResumen(Math.round(Math.abs(c.valor)))}`
    default: return numero(c.valor)
  }
}
