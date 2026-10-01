/**
 * Las cuentas de la lotería, sin base de datos: cuántas participaciones se
 * pueden emitir, qué número lleva cada una y cuánto cobra si toca.
 *
 * Una participación juega una parte de los décimos que el Grupo guarda en
 * Secretaría. Si el Grupo juega varios números, lo que juega cada
 * participación se reparte a partes iguales entre todos («juega 4 €: 2 € a
 * cada número»). Lo que paga de más quien la compra es donativo.
 *
 * Todo el dinero va en céntimos: con decimales, 0,1 + 0,2 no da 0,3 y una
 * liquidación descuadra.
 */
import { deLaCorporacion } from './articulos.js';

export interface NumeroJugado {
  /** Las cinco cifras, con sus ceros a la izquierda: «04512». */
  numero: string;
  /** Lo que gana un décimo de este número, en céntimos; null hasta el sorteo. */
  premio: number | null;
}

export interface Reparto {
  numeros: NumeroJugado[];
  decimos: number;
  precioDecimo: number;
  precioParticipacion: number;
  jugado: number;
  porTalonario: number;
}

export const NUMERO_DE_LOTERIA = /^\d{5}$/;

/** Los números guardados, por si el JSON viene torcido: lo que no sea un número válido se descarta. */
export function numerosDe(valor: unknown): NumeroJugado[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((n) => {
    const numero = typeof n?.numero === 'string' ? n.numero : null;
    if (!numero || !NUMERO_DE_LOTERIA.test(numero)) return [];
    return [{ numero, premio: Number.isInteger(n.premio) && n.premio >= 0 ? n.premio : null }];
  });
}

/**
 * Cuántas participaciones caben en los décimos comprados: entre todas no
 * pueden jugar más dinero del que hay en décimos. Vender una de más es vender
 * lotería que no existe, y si toca no hay con qué pagarla.
 */
export function maximoDeParticipaciones(r: Pick<Reparto, 'numeros' | 'decimos' | 'precioDecimo' | 'jugado'>): number {
  if (r.jugado <= 0) return 0;
  return Math.floor((r.numeros.length * r.decimos * r.precioDecimo) / r.jugado);
}

/** Cuántos talonarios enteros caben. */
export const maximoDeTalonarios = (r: Reparto) => (r.porTalonario > 0 ? Math.floor(maximoDeParticipaciones(r) / r.porTalonario) : 0);

/** Lo que juega una participación a cada número, en céntimos (puede no ser redondo: 4 € a tres números). */
export const jugadoPorNumero = (r: Pick<Reparto, 'numeros' | 'jugado'>) => (r.numeros.length ? r.jugado / r.numeros.length : 0);

/**
 * Lo que cobra una participación, en céntimos: por cada número premiado, la
 * parte del décimo que juega. Se redondea hacia abajo al céntimo: lo que no
 * se puede pagar exacto no se paga de más.
 */
export function premioPorParticipacion(r: Pick<Reparto, 'numeros' | 'precioDecimo' | 'jugado'>): number {
  if (r.precioDecimo <= 0) return 0;
  const porNumero = jugadoPorNumero(r);
  return Math.floor(r.numeros.reduce((suma, n) => suma + (n.premio ?? 0) * (porNumero / r.precioDecimo), 0) + 1e-6);
}

/** La primera y la última participación del talonario `numero` (empezando en 1). */
export function participacionesDelTalonario(numero: number, porTalonario: number): { desde: number; hasta: number } {
  return { desde: (numero - 1) * porTalonario + 1, hasta: numero * porTalonario };
}

/** El número impreso, con ceros para que todos midan lo mismo: «0042». */
export const numeroImpreso = (n: number, total: number) => String(n).padStart(Math.max(4, String(total).length), '0');

/** El texto legal de la participación cuando el sorteo no trae uno propio. */
export const LEYENDA_POR_DEFECTO = `Los décimos quedan depositados en la Secretaría ${deLaCorporacion()}. `
  + 'Los premios se pagan en Secretaría, presentando esta participación, y caducan a los tres meses de la celebración del sorteo. '
  + 'Están sujetos a las retenciones que marque la ley.';
