import { EstadoPago, TipoRecibo, type CobroSalida } from '@prisma/client';
import { claveConcepto } from './datos-procesion.js';
import { modoDePago } from './redsys.js';

/**
 * Lo que distingue a cada salida sin base de datos. Las salidas son filas
 * que define el CMS (`Salida`); aquí solo lo que se deduce de su forma de
 * cobro: una cuota fija (la papeleta de sitio) o la voluntad del hermano.
 *
 * Todas piden lo mismo para salir: ser hermano en activo con las cuotas al
 * día (pagadas o perdonadas). Ver `requisitosParaRecoger`.
 */

/** Un puesto del catálogo de una salida (la columna `Salida.puestos`). */
export interface PuestoDelCatalogo {
  nombre: string;
  tunica: boolean;
  tocado: 'CAPIROTE' | 'FARAONA' | null;
  alturaHombro: boolean;
}

/**
 * El puesto tal como está en el catálogo de la salida, o null si no está.
 * Desde el 20-10-2026 la mesa solo da puestos de la lista: escritos a mano
 * salían erratas («Nazareno de ciriod») que luego no casaban con el cortejo
 * ni con los filtros. El que ya tenía se admite aunque no esté (una papeleta
 * de antes se sigue pudiendo corregir en lo demás).
 */
export function puestoDeLaLista(puestos: unknown, puesto: string, actual?: string | null): string | null {
  const limpio = puesto.trim();
  if (actual && limpio === actual.trim()) return actual;
  const lista = Array.isArray(puestos) ? (puestos as PuestoDelCatalogo[]) : [];
  return lista.find((p) => p.nombre.localeCompare(limpio, 'es', { sensitivity: 'base' }) === 0)?.nombre ?? null;
}

/** El tipo del recibo de la papeleta: la cuota es una papeleta de sitio; la voluntad, un donativo. */
export function tipoReciboDe(cobro: CobroSalida): TipoRecibo {
  return cobro === 'DONATIVO' ? TipoRecibo.DONATIVO : TipoRecibo.PAPELETA_SITIO;
}

/**
 * Concepto del recibo de una papeleta que no choque con los que el hermano ya
 * tiene ese año: «Papeleta Sábado de Pasión 2026», y si ya se le anuló una,
 * «Papeleta Sábado de Pasión 2026 (reemisión 2)». El recibo de la papeleta
 * anulada se queda (la contabilidad conserva el rastro) y ocupa su concepto en
 * la clave única.
 */
export function conceptoDeSalida(salida: { nombre: string; cobro: CobroSalida }, year: number, conceptosExistentes: readonly string[]): string {
  // Siempre con el nombre de la salida: con varias salidas de cuota el mismo
  // año, un «Papeleta de sitio 2026» común haría que la segunda saliera como
  // «(reemisión 2)» sin haberse anulado nada.
  const base = `${salida.cobro === 'DONATIVO' ? 'Donativo' : 'Papeleta'} ${salida.nombre} ${year}`;
  const usados = new Set(conceptosExistentes.map(claveConcepto));
  if (!usados.has(claveConcepto(base))) return base;
  for (let n = 2; ; n += 1) {
    const candidato = `${base} (reemisión ${n})`;
    if (!usados.has(claveConcepto(candidato))) return candidato;
  }
}

// ---------------------------------------------------------------------------
//  Qué hace falta para recoger
// ---------------------------------------------------------------------------

export interface CuotaDelHermano {
  id: number;
  year: number;
  concepto: string;
  importe: number;
  estado: EstadoPago;
}

interface Requisitos {
  /** Lo de la salida (la cuota de salida o el donativo) está pagado o no hay nada que pagar. */
  salidaPagada: boolean;
  /** Lo que falta de la salida, en euros (0 si nada). */
  salidaPendiente: number;
  /** Las cuotas de hermano que quedan por pagar (pendientes o devueltas por el banco). */
  cuotasPendientes: CuotaDelHermano[];
  /** Las que están en el banco, cobrándose: no bloquean, pero la mesa lo ve. */
  cuotasEnElBanco: CuotaDelHermano[];
  /** Lo que falta pagar, en euros: lo de la salida y las cuotas. */
  totalPendiente: number;
  /** Si puede pasar a la última zona. */
  puedeRecoger: boolean;
  /** Por qué no, dicho para la mesa. Vacío si puede. */
  motivos: string[];
}

/**
 * Lo que queda por pagar de la salida en una solicitud: nada si ya tiene su
 * recibo pagado (o exento); si no, la cuota de la salida o la voluntad que
 * dijo el hermano, según cobre la salida.
 */
export function pendienteDeLaSalida(solicitud: {
  donativo: number | null;
  recibo: { estado: EstadoPago } | null;
}, salida: { cobro: CobroSalida; importeCuota: number }): number {
  const { recibo } = solicitud;
  if (recibo && (recibo.estado === EstadoPago.PAGADO || recibo.estado === EstadoPago.EXENTO)) return 0;
  const importe = salida.cobro === 'DONATIVO' ? solicitud.donativo ?? 0 : salida.importeCuota;
  return Math.round(importe * 100) / 100;
}

/**
 * Lo que la mesa comprueba antes de dar la ropa (o el puesto, en las
 * salidas sin ropa): hermano en activo, con su solicitud, lo de la salida pagado y
 * ninguna cuota de hermano sin pagar ni perdonar. Una cuota en el banco no
 * bloquea: el hermano ya la ha pagado por domiciliación y el banco la está
 * cobrando.
 *
 * `solicitud` es null si no se ha apuntado; `salidaPendiente`, lo que le
 * queda de la salida (ver `pendienteDeLaSalida`). `cuotas` son las de hermano
 * sin las devueltas que ya se reemitieron (esas las cubre su reemisión).
 */
export function requisitosParaRecoger(entrada: {
  activo: boolean;
  solicitud: { cobro: CobroSalida; salidaPendiente: number } | null;
  cuotas: CuotaDelHermano[];
}): Requisitos {
  const { activo, solicitud, cuotas } = entrada;
  const cuotasPendientes = cuotas
    .filter((c) => c.estado === EstadoPago.PENDIENTE || c.estado === EstadoPago.DEVUELTO)
    .sort((a, b) => a.year - b.year || a.id - b.id);
  const cuotasEnElBanco = cuotas.filter((c) => c.estado === EstadoPago.REMESADO);
  const salidaPendiente = solicitud?.salidaPendiente ?? 0;

  const motivos: string[] = [];
  if (!activo) motivos.push('No está en activo en el censo.');
  if (!solicitud) motivos.push('Todavía no está apuntado.');
  else if (salidaPendiente > 0) motivos.push(solicitud.cobro === 'DONATIVO' ? 'Falta el donativo.' : 'Falta pagar la papeleta.');
  if (cuotasPendientes.length > 0) {
    motivos.push(cuotasPendientes.length === 1
      ? `Tiene la cuota de ${cuotasPendientes[0].year} sin pagar.`
      : `Tiene ${cuotasPendientes.length} cuotas sin pagar (${cuotasPendientes.map((c) => c.year).join(', ')}).`);
  }

  const centimos = cuotasPendientes.reduce((s, c) => s + Math.round(c.importe * 100), 0) + Math.round(salidaPendiente * 100);

  return {
    salidaPagada: salidaPendiente === 0,
    salidaPendiente,
    cuotasPendientes,
    cuotasEnElBanco,
    totalPendiente: centimos / 100,
    puedeRecoger: motivos.length === 0,
    motivos,
  };
}

/**
 * Nota que queda en el recibo perdonado. La decisión es del Hermano Mayor
 * aunque lo marque Tesorería: se dice así en el propio recibo, que es lo que
 * ve el hermano en su área.
 */
export function notaDePerdon(motivo: string | undefined, fecha: Date = new Date()): string {
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(fecha);
  const porque = motivo?.trim() ? ` Motivo: ${motivo.trim()}` : '';
  return `Perdonada por decisión del Hermano Mayor el ${dia}.${porque}`;
}

/** La marca que deja `notaDePerdon`: con ella el área del hermano dice «Perdonada». */
export const esPerdonada = (observaciones: string | null | undefined) =>
  Boolean(observaciones?.includes('Perdonada por decisión del Hermano Mayor'));

/** Si el área de hermanos ofrece pagar en línea (ver `modoDePago`). */
export function pagoEnLineaDisponible(env: Record<string, string | undefined> = process.env): boolean {
  return modoDePago(env) !== null;
}
