// `PapeletaSitio.puesto` y `Hermano.tunica` son texto libre escrito a mano. En
// los ejemplos del propio schema conviven "Diputado" y "hombre de trono", así
// que agrupar en crudo partiría el mismo puesto en varias filas.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { agruparPorTextoLibre } from '../src/domain/panel-agrupar.js';

describe('agrupar texto libre', () => {
  test('junta lo que solo se diferencia en mayúsculas o espacios', () => {
    const filas = agruparPorTextoLibre(['Hombre de trono', 'hombre de trono', '  HOMBRE DE TRONO  ']);
    assert.equal(filas.length, 1);
    assert.equal(filas[0].total, 3);
  });

  test('colapsa los espacios de sobra de dentro', () => {
    const filas = agruparPorTextoLibre(['Hombre  de   trono', 'hombre de trono']);
    assert.equal(filas.length, 1);
  });

  test('devuelve la etiqueta con la primera letra en mayúscula', () => {
    const filas = agruparPorTextoLibre(['nazareno', 'NAZARENO']);
    assert.equal(filas[0].etiqueta, 'Nazareno');
  });

  test('ordena de mayor a menor', () => {
    const filas = agruparPorTextoLibre(['a', 'b', 'b', 'c', 'c', 'c']);
    assert.deepEqual(filas.map((f) => f.etiqueta), ['C', 'B', 'A']);
  });

  test('ignora los vacíos y los nulos', () => {
    const filas = agruparPorTextoLibre(['Cirio', null, undefined, '', '   ']);
    assert.deepEqual(filas, [{ etiqueta: 'Cirio', total: 1 }]);
  });

  test('agrupa la cola en Otros', () => {
    const filas = agruparPorTextoLibre(['a', 'a', 'a', 'b', 'b', 'c', 'd'], 2);
    assert.deepEqual(filas, [
      { etiqueta: 'A', total: 3 },
      { etiqueta: 'B', total: 2 },
      { etiqueta: 'Otros', total: 2 },
    ]);
  });

  test('sin valores devuelve una lista vacía, no una fila de Otros a cero', () => {
    assert.deepEqual(agruparPorTextoLibre([]), []);
  });
});
