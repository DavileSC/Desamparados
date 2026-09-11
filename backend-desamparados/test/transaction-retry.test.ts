import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import { esConflictoTransitorio } from '../src/utils/transaction-retry.js';

/** Así llega el error de MariaDB a través del adaptador de Prisma: sin traducir. */
function errorAdaptador(code: number) {
  const e = new Error('Record has changed since last read') as Error & { cause: unknown };
  e.name = 'DriverAdapterError';
  e.cause = { kind: 'mysql', code, message: 'Record has changed since last read' };
  return e;
}

function errorPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError('conflicto', { code, clientVersion: 'test' });
}

test('reconoce los choques de MariaDB que el adaptador no traduce', () => {
  assert.equal(esConflictoTransitorio(errorAdaptador(1020)), true, '1020: la fila cambió tras la lectura');
  assert.equal(esConflictoTransitorio(errorAdaptador(1213)), true, '1213: interbloqueo');
});

// Así lo entrega Prisma 7.10 (sacado de un 1020 real de la MariaDB local): ya
// no como DriverAdapterError suelto, sino envuelto en un P2039. Con solo la
// forma anterior, la actualización de Prisma volvió a convertir los dobles
// clics en errores.
test('reconoce el 1020 envuelto por Prisma 7.10 en un P2039', () => {
  const envuelto = new Prisma.PrismaClientKnownRequestError('Database error. Code: `1020`', {
    code: 'P2039',
    clientVersion: '7.10.0',
    meta: {
      modelName: 'Hermano',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: { originalCode: '1020', kind: 'mysql', code: 1020, state: 'HY000' }
      }
    }
  });
  assert.equal(esConflictoTransitorio(envuelto), true);
});

test('reconoce P2034, el conflicto de serialización que sí traduce Prisma', () => {
  assert.equal(esConflictoTransitorio(errorPrisma('P2034')), true);
});

test('no reintenta errores que no se arreglan repitiendo', () => {
  assert.equal(esConflictoTransitorio(errorPrisma('P2002')), false, 'un duplicado es del usuario');
  assert.equal(esConflictoTransitorio(errorPrisma('P2025')), false);
  assert.equal(esConflictoTransitorio(errorAdaptador(1062)), false, 'clave duplicada en crudo');
  assert.equal(esConflictoTransitorio(new Error('cualquier otra cosa')), false);
  assert.equal(esConflictoTransitorio(null), false);
});
