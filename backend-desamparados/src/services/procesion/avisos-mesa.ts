/**
 * Lo que un puesto de la mesa cuenta a los demás: Inscripción apunta a
 * alguien y Tesorería lo ve en su cola; Tesorería cobra y Túnicas sabe que ya
 * puede darle la ropa. Van por un canal de eventos del servidor (SSE) que
 * cada ordenador de la mesa tiene abierto.
 *
 * Solo dicen quién ha cambiado: cada puesto vuelve a leer lo que necesita.
 * Así un aviso perdido (la WiFi se corta) no deja nada mal: al reconectar, la
 * mesa recarga todo.
 */
import { EventEmitter } from 'node:events';
import type { Salida } from '@prisma/client';

export type QueCambia = 'inscrito' | 'cobrado' | 'perdonado' | 'entregado' | 'corregido' | 'anulado' | 'alta' | 'devuelto';

export interface AvisoDeMesa {
  que: QueCambia;
  hermanoId: number;
  salida?: Salida;
  /** Quién lo hizo, para no avisarse a sí mismo de lo que acaba de hacer. */
  puesto?: string;
}

const canal = new EventEmitter();
// Cada ordenador abierto es un oyente: con muchos, Node avisaría de una fuga que no es tal.
canal.setMaxListeners(0);

export function avisarALaMesa(aviso: AvisoDeMesa) {
  canal.emit('aviso', aviso);
}

/** Escucha los avisos; devuelve cómo dejar de escucharlos. */
export function escucharLaMesa(oyente: (aviso: AvisoDeMesa) => void): () => void {
  canal.on('aviso', oyente);
  return () => { canal.off('aviso', oyente); };
}
