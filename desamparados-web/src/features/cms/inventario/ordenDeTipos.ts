import type { Prenda, RecuentoDeTipo } from '../../../lib/api/inventario'

const ORDEN_TIPOS: Prenda['tipo'][] = ['TUNICA', 'CAPIROTE', 'FARAONA', 'CAPA', 'OTRO']

/** Los tipos que tienen alguna prenda, en el orden de siempre. */
export const tiposConPrendas = (recuento: RecuentoDeTipo[]) => ORDEN_TIPOS
  .map((tipo) => recuento.find((r) => r.tipo === tipo))
  .filter((r): r is RecuentoDeTipo => Boolean(r && r.total > 0))
