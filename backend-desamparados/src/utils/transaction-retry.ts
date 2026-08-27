import db from '../config/db.js';
import { Prisma } from '@prisma/client';

const MAX_ATTEMPTS = 3;

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
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
      if (!isSerializationConflict(error) || attempt === MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
    }
  }
  throw new Error('La transacción no pudo completarse.');
}
