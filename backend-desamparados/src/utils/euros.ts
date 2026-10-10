/**
 * Los importes que la API escribe (correos, PDF, avisos), en un solo sitio:
 * había uno por servicio y no coincidían («1234,00 €» en unos, «1.234,00 €» en
 * otros). La unidad va en el nombre: unos servicios cuentan en céntimos y
 * otros en euros, y confundirlos multiplica por cien.
 *
 * `useGrouping: 'always'`: el es-ES de Intl no pone el punto de miles hasta los
 * cinco dígitos. El espacio antes de «€» es duro (no se separa en dos líneas);
 * las fuentes de los PDF lo tienen.
 */
const formato = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, useGrouping: 'always' as never });

/** Un importe en euros: 1234.5 → «1.234,50 €». */
export const euros = (valor: number) => formato.format(valor);

/** Un importe en céntimos: 123450 → «1.234,50 €». */
export const eurosDeCentimos = (centimos: number) => euros(centimos / 100);
