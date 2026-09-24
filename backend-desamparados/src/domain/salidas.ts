import { EstadoPago, TipoRecibo, type Salida } from '@prisma/client';
import catalogo from '../../../shared/puestos-procesion.json' with { type: 'json' };
import { claveConcepto } from './datos-procesion.js';

/**
 * Las salidas del año y lo que las distingue, sin base de datos: la del
 * Sábado de Pasión (con túnica del ropero y una cuota de salida que hoy es
 * 0 €) y el Rosario vespertino de octubre (en traje, con un donativo libre).
 *
 * Las dos piden lo mismo para salir: ser hermano en activo con las cuotas al
 * día (pagadas o perdonadas). Ver `requisitosParaRecoger`.
 */

export const SALIDAS = ['PASION', 'ROSARIO'] as const satisfies readonly Salida[];

export interface DatosDeSalida {
  nombre: string;
  /** Si en la última zona se da ropa del ropero (túnica, capirote, faraona). */
  conRopa: boolean;
  /** Clave de `Configuracion` que abre y cierra la solicitud en el área de hermanos. */
  clavePlazo: string;
  /** Cómo se llama el recibo de la papeleta, sin el año. */
  concepto: string;
  tipoRecibo: TipoRecibo;
  /** Si el importe lo pone el hermano (el donativo) en vez de la configuración. */
  importeLibre: boolean;
}

export const DATOS_SALIDA: Record<Salida, DatosDeSalida> = {
  PASION: {
    nombre: 'Sábado de Pasión',
    conRopa: true,
    clavePlazo: 'papeletas_abiertas',
    concepto: 'Papeleta Sitio',
    tipoRecibo: TipoRecibo.PAPELETA_SITIO,
    importeLibre: false,
  },
  ROSARIO: {
    nombre: 'Rosario vespertino',
    conRopa: false,
    clavePlazo: 'papeletas_abiertas_rosario',
    concepto: 'Donativo Rosario vespertino',
    tipoRecibo: TipoRecibo.DONATIVO,
    importeLibre: true,
  },
};

/** La cuota de salida de la Pasión: hoy no se cobra, pero queda configurable. */
export const CLAVE_CUOTA_SALIDA = 'precio_papeleta_sitio';
export const CUOTA_SALIDA_POR_DEFECTO = 0;

/** Un puesto del catálogo (shared/puestos-procesion.json). */
export interface PuestoDelCatalogo {
  nombre: string;
  tunica: boolean;
  tocado: 'CAPIROTE' | 'FARAONA' | null;
  alturaHombro: boolean;
}

/** Los puestos que sugiere cada salida. Son sugerencias: se puede escribir otro. */
export const PUESTOS_POR_SALIDA: Record<Salida, readonly PuestoDelCatalogo[]> = {
  PASION: catalogo.puestos as PuestoDelCatalogo[],
  ROSARIO: catalogo.rosario as PuestoDelCatalogo[],
};

/**
 * Concepto del recibo de una papeleta que no choque con los que el hermano ya
 * tiene ese año: «Papeleta Sitio 2026», y si ya se le anuló una, «Papeleta
 * Sitio 2026 (reemisión 2)». El recibo de la papeleta anulada se queda (la
 * contabilidad conserva el rastro) y ocupa su concepto en la clave única.
 */
export function conceptoDeSalida(salida: Salida, year: number, conceptosExistentes: readonly string[]): string {
  const base = `${DATOS_SALIDA[salida].concepto} ${year}`;
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

export interface Requisitos {
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

/** Cuántas cuotas atrasadas se admiten antes de avisar de que se pierde la condición de hermano. */
export const CUOTAS_ATRASADAS_MAXIMAS = 2;

/**
 * Lo que queda por pagar de la salida en una solicitud: nada si ya tiene su
 * recibo pagado (o exento); si no, la cuota de salida en la Pasión (hoy 0 €)
 * o la voluntad que dijo en el Rosario.
 */
export function pendienteDeLaSalida(solicitud: {
  salida: Salida;
  donativo: number | null;
  recibo: { estado: EstadoPago } | null;
}, cuotaSalida: number): number {
  const { recibo } = solicitud;
  if (recibo && (recibo.estado === EstadoPago.PAGADO || recibo.estado === EstadoPago.EXENTO)) return 0;
  const importe = DATOS_SALIDA[solicitud.salida].importeLibre ? solicitud.donativo ?? 0 : cuotaSalida;
  return Math.round(importe * 100) / 100;
}

/**
 * Lo que la mesa comprueba antes de dar la ropa (o el puesto, en el
 * Rosario): hermano en activo, con su solicitud, lo de la salida pagado y
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
  solicitud: { salida: Salida; salidaPendiente: number } | null;
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
  else if (salidaPendiente > 0) motivos.push(solicitud.salida === 'ROSARIO' ? 'Falta el donativo.' : 'Falta pagar la papeleta.');
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

/**
 * Si el área de hermanos ofrece pagar en línea. Hoy la pasarela se SIMULA
 * (aún no hay cuenta del banco para cobrar con tarjeta ni Bizum): el pago se
 * da por hecho sin mover dinero. Por eso, en producción solo se enciende a
 * propósito con `PAGO_EN_LINEA=simulado`; fuera de producción está encendido
 * salvo que se apague con `PAGO_EN_LINEA=no`.
 */
export function pagoEnLineaDisponible(env: Record<string, string | undefined> = process.env): boolean {
  if (env.PAGO_EN_LINEA === 'simulado') return true;
  if (env.PAGO_EN_LINEA !== undefined) return false;
  return env.NODE_ENV !== 'production';
}
