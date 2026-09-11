import db from '../config/db.js';
import { Prisma } from '@prisma/client';
import { esConflictoDeConcurrencia } from './error.handle.js';

// Cinco y no tres: con varias mesas de reparto inscribiendo a la vez, los
// bloqueos de hueco de Serializable encadenan interbloqueos y tres intentos se
// agotaban. La espera crece con cada intento y lleva azar (ver abajo).
const MAX_ATTEMPTS = 5;

/**
 * `true` si el error es un choque transitorio entre transacciones, de los que
 * se arreglan repitiendo la transacción entera: la nueva lectura ya ve lo que
 * hizo la otra.
 *
 * Son P2034 y los errores 1020 y 1213 de MariaDB. El 1020 («Record has changed
 * since last read») sale porque MariaDB 11.8 trae `innodb_snapshot_isolation=ON`
 * y rechaza escribir una fila que otra transacción cambió después de tu primera
 * lectura; el 1213 es un interbloqueo. Prisma no los traduce a P2034, y cómo los
 * entrega depende de la versión: la 7.3 los dejaba como `DriverAdapterError`
 * suelto y la 7.10 los envuelve en un P2039 con el código en
 * `meta.driverAdapterError.cause`. El reconocimiento vive en un solo sitio
 * (`esConflictoDeConcurrencia`), el mismo que los traduce a 409, para que el
 * reintento y el mensaje no vuelvan a separarse con la próxima actualización.
 */
export function esConflictoTransitorio(error: unknown): boolean {
  return esConflictoDeConcurrencia(error);
}

/** Reintenta únicamente conflictos transitorios de transacciones Serializable. */
export async function transactionWithRetry<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { isolationLevel: Prisma.TransactionIsolationLevel },
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(operation, options);
    } catch (error) {
      if (!esConflictoTransitorio(error) || attempt === MAX_ATTEMPTS) throw error;
      // Algo de azar en la espera para que dos peticiones no reintenten al compás.
      await new Promise((resolve) => setTimeout(resolve, 25 * attempt + Math.floor(Math.random() * 25)));
    }
  }
  throw new Error('La transacción no pudo completarse.');
}
