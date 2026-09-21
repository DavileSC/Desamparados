import type { ReceiptStatus } from '../../../lib/api/procesion'

/**
 * Cómo se enseña una papeleta según el estado de su recibo.
 *
 * EXENTO es una papeleta válida: sale gratis porque la Junta ha puesto el
 * precio a 0 € (o eximió al hermano), y el sitio en la procesión es suyo igual
 * que si la hubiera pagado. Antes caía en «No disponible». Un recibo devuelto
 * o anulado ya no respalda ningún sitio: esas papeletas se anulan en el
 * servidor, pero si alguna llegara aquí, no se da por buena.
 */
export function estadoPapeleta(estado: ReceiptStatus): { texto: string; color: string } {
  switch (estado) {
    case 'PAGADO':
    case 'EXENTO':
      return { texto: 'Asignada', color: 'success.main' }
    case 'PENDIENTE':
    case 'REMESADO':
      return { texto: 'Pendiente', color: 'warning.main' }
    default:
      return { texto: 'No disponible', color: 'error.main' }
  }
}
