import type { MetodoPago, ReceiptStatus, TipoRecibo } from '../../../lib/api/receipts'

/**
 * Cómo se nombran ante el hermano el estado, el tipo y la forma de pago de un
 * recibo. Los tres son enums de la base de datos y ninguno se enseña tal cual:
 * «PAPELETA_SITIO» no es castellano.
 *
 * Están aquí, y no dentro de una pantalla, porque los usan las dos: el listado
 * enseña el estado en cada fila y el detalle los tres.
 */
export const ESTADO_RECIBO: Record<ReceiptStatus, { texto: string; color: string }> = {
  PAGADO: { texto: 'Pagado', color: 'success.main' },
  PENDIENTE: { texto: 'Pendiente', color: 'warning.main' },
  REMESADO: { texto: 'Remesado', color: 'info.main' },
  DEVUELTO: { texto: 'Devuelto', color: 'error.main' },
  ANULADO: { texto: 'Anulado', color: 'error.main' },
  EXENTO: { texto: 'Exento', color: 'text.secondary' },
}

export const TIPO_RECIBO: Record<TipoRecibo, string> = {
  PAPELETA_SITIO: 'Papeleta de sitio',
  CUOTA_HERMANO: 'Cuota de hermano',
  DONATIVO: 'Donativo',
  OTRO: 'Otro',
}

export const METODO_PAGO: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  BIZUM: 'Bizum',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  DOMICILIACION: 'Domiciliación',
}

/** El importe como se escribe en España: coma decimal y el símbolo al final. */
export const formatearImporte = (importe: number | string): string =>
  `${Number(importe).toFixed(2).replace('.', ',')} €`

export const formatearFecha = (fecha: string): string =>
  new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
