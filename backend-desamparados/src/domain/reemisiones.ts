/**
 * Un recibo devuelto se vuelve a cobrar emitiendo otro (DEVUELTO es final): la
 * reemisión, al mismo hermano, del mismo año y del mismo tipo. El devuelto se
 * queda como estaba para que la contabilidad conserve el rastro.
 *
 * Por eso un devuelto solo es dinero pendiente mientras no tenga reemisión:
 * contarlo después contaba la misma deuda dos veces (el devuelto y su recibo
 * nuevo), en lo por cobrar del Inicio, en sus tareas y en la lista de impagos.
 *
 * Cualquier recibo posterior con la misma clave cuenta como reemisión, también
 * uno anulado: anular la reemisión es decidir no cobrarlo, y tampoco se debe ya.
 */

export interface ClaveRecibo {
  id: number;
  hermanoId: number;
  year: number;
  tipo: string;
}

const clave = (r: ClaveRecibo) => `${r.hermanoId}|${r.year}|${r.tipo}`;

/** Los ids de los `devueltos` que ya tienen reemisión entre `recibos` (ids posteriores con la misma clave). */
export function idsReemitidos(devueltos: ClaveRecibo[], recibos: ClaveRecibo[]): Set<number> {
  const ultimoPorClave = new Map<string, number>();
  for (const r of recibos) {
    const k = clave(r);
    ultimoPorClave.set(k, Math.max(ultimoPorClave.get(k) ?? 0, r.id));
  }
  return new Set(devueltos.filter((d) => (ultimoPorClave.get(clave(d)) ?? 0) > d.id).map((d) => d.id));
}
