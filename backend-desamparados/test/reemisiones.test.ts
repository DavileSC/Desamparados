// test/reemisiones.test.ts
// Qué devuelto cuenta como ya reemitido: solo el que un recibo reemite de forma explícita.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { idsReemitidos } from '../src/domain/reemisiones.js';

describe('un devuelto ya reemitido no es deuda', () => {
  test('el recibo que apunta al devuelto es su reemisión', () => {
    assert.deepEqual([...idsReemitidos([{ reemisionDeId: null }, { reemisionDeId: 10 }])], [10]);
  });

  test('sin ningún recibo que lo reemita, sigue pendiente', () => {
    assert.equal(idsReemitidos([{ reemisionDeId: null }, { reemisionDeId: null }]).size, 0);
  });
});
