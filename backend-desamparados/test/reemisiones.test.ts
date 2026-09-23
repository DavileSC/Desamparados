// test/reemisiones.test.ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { idsReemitidos } from '../src/domain/reemisiones.js';

const r = (id: number, hermanoId = 1, year = 2025, tipo = 'CUOTA_HERMANO') => ({ id, hermanoId, year, tipo });

describe('un devuelto ya reemitido no es deuda', () => {
  test('un recibo posterior del mismo hermano, año y tipo es su reemisión', () => {
    assert.deepEqual([...idsReemitidos([r(10)], [r(10), r(12)])], [10]);
  });

  test('sin reemisión, sigue pendiente', () => {
    assert.equal(idsReemitidos([r(10)], [r(10)]).size, 0);
  });

  test('otro año, otro tipo u otro hermano no cuentan como reemisión', () => {
    assert.equal(idsReemitidos([r(10)], [r(10), r(11, 1, 2026), r(12, 1, 2025, 'DONATIVO'), r(13, 2)]).size, 0);
  });

  test('un recibo anterior no reemite al devuelto', () => {
    assert.equal(idsReemitidos([r(10)], [r(8), r(10)]).size, 0);
  });

  test('si la reemisión también se devolvió, la pendiente es solo la última', () => {
    const reemitidos = idsReemitidos([r(10), r(12)], [r(10), r(12)]);
    assert.deepEqual([...reemitidos], [10]);
  });
});
