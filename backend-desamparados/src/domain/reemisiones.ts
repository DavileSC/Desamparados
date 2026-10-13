/**
 * Un recibo devuelto se vuelve a cobrar emitiendo otro (DEVUELTO es final): la
 * reemisión, que apunta a él con `reemisionDeId`. El devuelto se queda como
 * estaba para que la contabilidad conserve el rastro.
 *
 * Por eso un devuelto solo es dinero pendiente mientras no tenga reemisión:
 * contarlo después contaba la misma deuda dos veces (el devuelto y su recibo
 * nuevo), en lo por cobrar del Inicio, en sus tareas y en la lista de impagos.
 *
 * El enlace es explícito. Antes valía cualquier recibo posterior del mismo
 * hermano, año y tipo, y la papeleta de otra salida del mismo año (o un
 * donativo de Tesorería) tapaba al devuelto: 25 € que se debían y nadie veía.
 * Cuenta también una reemisión anulada: anularla es decidir no cobrarlo, y
 * tampoco se debe ya.
 */

/** Los ids de los devueltos que ya tienen reemisión entre `recibos`: los que alguno de ellos reemite. */
export function idsReemitidos(recibos: { reemisionDeId: number | null }[]): Set<number> {
  return new Set(recibos.flatMap((r) => (r.reemisionDeId === null ? [] : [r.reemisionDeId])));
}
