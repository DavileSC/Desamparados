import { EstadoPago, MetodoPago } from '@prisma/client';

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
 *   PAGADO ─────────────────┬──> DEVUELTO     (el banco echa atrás un cobro)
 *                           └──> REEMBOLSADO  (se le devuelve al hermano)
 *
 * DEVUELTO, ANULADO, EXENTO y REEMBOLSADO son finales: para volver a cobrar se
 * emite un recibo nuevo, de modo que la contabilidad conserva el rastro completo.
 *
 * DEVUELTO y REEMBOLSADO llevan el mismo reverso, pero no significan lo mismo:
 * un devuelto se sigue debiendo (cuenta como por cobrar, se reemite y se puede
 * pagar en línea); un reembolso es dinero que el Grupo devolvió a propósito, al
 * anular una papeleta o cancelar una solicitud, y no se debe. Cuando los dos
 * eran DEVUELTO, Tesorería veía «Reemitir» en un donativo cancelado y volvía a
 * cobrarlo.
 *
 * PENDIENTE -> PAGADO y REMESADO -> PAGADO no están aquí a propósito: cobrar
 * no es una edición de estado, tiene su propia operación
 * (`adminMarcarComoPagado`) porque además genera el asiento de ingreso. Acepta
 * los dos estados de `ESTADOS_COBRABLES`: un remesado es un cobro en curso que
 * el banco acaba confirmando, y antes se quedaba en un callejón sin salida
 * (solo podía devolverse o anularse, nunca darse por cobrado).
 *
 *   PENDIENTE ─┐
 *              ├──(cobrar)──> PAGADO      (con su asiento de ingreso)
 *   REMESADO ──┘
 */
const TRANSICIONES: Record<EstadoPago, readonly EstadoPago[]> = {
  [EstadoPago.PENDIENTE]: [EstadoPago.REMESADO, EstadoPago.ANULADO, EstadoPago.EXENTO],
  [EstadoPago.REMESADO]: [EstadoPago.DEVUELTO, EstadoPago.ANULADO],
  [EstadoPago.PAGADO]: [EstadoPago.DEVUELTO, EstadoPago.REEMBOLSADO],
  [EstadoPago.DEVUELTO]: [],
  [EstadoPago.REEMBOLSADO]: [],
  [EstadoPago.ANULADO]: [],
  [EstadoPago.EXENTO]: [],
};

/** Estados desde los que ya no se puede mover un recibo. */
export const ESTADOS_FINALES: readonly EstadoPago[] = [
  EstadoPago.DEVUELTO,
  EstadoPago.ANULADO,
  EstadoPago.EXENTO,
  EstadoPago.REEMBOLSADO,
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
  return origen === EstadoPago.PAGADO && (destino === EstadoPago.DEVUELTO || destino === EstadoPago.REEMBOLSADO);
}

/** Estados desde los que se puede cobrar un recibo (ver el grafo de arriba). */
const ESTADOS_COBRABLES: readonly EstadoPago[] = [EstadoPago.PENDIENTE, EstadoPago.REMESADO];

/** `true` si el recibo puede darse por cobrado desde `estado`. */
export function puedeCobrarse(estado: EstadoPago): boolean {
  return ESTADOS_COBRABLES.includes(estado);
}

/**
 * Desde qué estados se cobra con `metodo`. Un remesado está en el banco, que
 * es quien lo cobra: solo se da por cobrado por domiciliación (o sin decir
 * método, que es lo mismo). Cobrarlo en mano con la remesa en el banco lo
 * cobraría dos veces; si el banco lo devuelve, se cobra su reemisión.
 */
export function estadosCobrablesCon(metodo: MetodoPago | null | undefined): EstadoPago[] {
  return metodo == null || metodo === MetodoPago.DOMICILIACION ? [...ESTADOS_COBRABLES] : [EstadoPago.PENDIENTE];
}

export const MENSAJE_REMESADO_EN_MANO = 'está en el banco, cobrándose por domiciliación: no se cobra en mano. Si el banco lo devuelve, se cobra su reemisión.';

/**
 * `true` si pasar un recibo de papeleta a `destino` deja la papeleta sin
 * efecto. Un recibo devuelto, reembolsado o anulado ya no respalda ningún sitio en la
 * procesión: si Tesorería lo devuelve, la papeleta se anula igual que si la
 * anulara la mesa de reparto. EXENTO no: el hermano sale sin pagar.
 */
export function anulaPapeleta(destino: EstadoPago): boolean {
  return destino === EstadoPago.DEVUELTO || destino === EstadoPago.REEMBOLSADO || destino === EstadoPago.ANULADO;
}
