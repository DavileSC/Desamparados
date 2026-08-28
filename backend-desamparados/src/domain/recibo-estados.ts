import { EstadoPago } from '@prisma/client';

/**
 * Máquina de estados de un recibo, sin base de datos de por medio.
 *
 * Vivía dentro de `ReciboService.adminUpdateDetalles`, donde solo podía
 * probarse levantando MariaDB. Aquí es una función pura: las reglas que deciden
 * si un cobro puede anularse o devolverse —lo que cuesta dinero cuando se
 * equivoca— quedan cubiertas por pruebas que corren en cualquier máquina.
 *
 * El grafo es deliberadamente estrecho:
 *
 *   PENDIENTE ─┬─> REMESADO ─┬─> DEVUELTO   (impagado por el banco)
 *              │             └─> ANULADO
 *              ├─> ANULADO                  (se retira antes de cobrar)
 *              └─> EXENTO                   (el hermano no paga esta vez)
 *   PAGADO ────────────────────> DEVUELTO   (se retrocede un cobro hecho)
 *
 * DEVUELTO, ANULADO y EXENTO son finales: para volver a cobrar se emite un
 * recibo nuevo, de modo que la contabilidad conserva el rastro completo.
 *
 * PENDIENTE -> PAGADO no está aquí a propósito: cobrar no es una edición de
 * estado, tiene su propia operación (`marcarComoPagado`) porque además genera
 * el asiento de ingreso.
 */
const TRANSICIONES: Record<EstadoPago, readonly EstadoPago[]> = {
  [EstadoPago.PENDIENTE]: [EstadoPago.REMESADO, EstadoPago.ANULADO, EstadoPago.EXENTO],
  [EstadoPago.REMESADO]: [EstadoPago.DEVUELTO, EstadoPago.ANULADO],
  [EstadoPago.PAGADO]: [EstadoPago.DEVUELTO],
  [EstadoPago.DEVUELTO]: [],
  [EstadoPago.ANULADO]: [],
  [EstadoPago.EXENTO]: [],
};

/** Estados desde los que ya no se puede mover un recibo. */
export const ESTADOS_FINALES: readonly EstadoPago[] = [
  EstadoPago.DEVUELTO,
  EstadoPago.ANULADO,
  EstadoPago.EXENTO,
];

/** Estados a los que se puede pasar desde `origen`. Vacío si es final. */
export function transicionesDesde(origen: EstadoPago): readonly EstadoPago[] {
  return TRANSICIONES[origen] ?? [];
}

/** `true` si el cambio de estado está permitido. */
export function puedeTransicionar(origen: EstadoPago, destino: EstadoPago): boolean {
  return transicionesDesde(origen).includes(destino);
}

/**
 * `true` si el cambio exige registrar un asiento de reverso en contabilidad:
 * solo cuando se retrocede un cobro que ya había generado un ingreso.
 * Un REMESADO devuelto nunca llegó a ingresar nada, así que no lleva reverso.
 */
export function requiereReverso(origen: EstadoPago, destino: EstadoPago): boolean {
  return origen === EstadoPago.PAGADO && destino === EstadoPago.DEVUELTO;
}
