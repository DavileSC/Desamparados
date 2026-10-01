// La puerta del templo sin base de datos: qué se dice al leer una papeleta y
// cómo se cuentan los tramos.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cuentasPorTramo, veredicto } from '../src/domain/puerta.js';

// Los ids de dos salidas cualesquiera: la puerta solo compara.
const PASION = 1;
const ROSARIO = 2;
const esperada = { year: 2027, salidaId: PASION };

test('veredicto: entra, repetida, de otra salida o anulada', () => {
  assert.equal(veredicto({ year: 2027, salidaId: PASION, entradaEl: null }, esperada), 'ENTRA');
  assert.equal(veredicto({ year: 2027, salidaId: PASION, entradaEl: new Date() }, esperada), 'REPETIDA');
  assert.equal(veredicto({ year: 2026, salidaId: PASION, entradaEl: null }, esperada), 'OTRA_SALIDA');
  assert.equal(veredicto({ year: 2027, salidaId: ROSARIO, entradaEl: null }, esperada), 'OTRA_SALIDA');
  // Anular borra la papeleta: el código sigue siendo bueno, pero ya no hay nada detrás.
  assert.equal(veredicto(null, esperada), 'ANULADA');
});

test('los tramos, en el orden del cortejo; los escritos a mano después; sin tramo, al final', () => {
  const ahora = new Date();
  const cuentas = cuentasPorTramo([
    { tramo: null, entradaEl: null },
    { tramo: 'Tramo 2', entradaEl: ahora },
    { tramo: 'Otro', entradaEl: null },
    { tramo: 'Tramo 1', entradaEl: null },
    { tramo: 'Tramo 2', entradaEl: null },
    { tramo: 'Tramo 1', entradaEl: ahora },
  ], ['Tramo 1', 'Tramo 2']);
  assert.deepEqual(cuentas, [
    { tramo: 'Tramo 1', total: 2, dentro: 1 },
    { tramo: 'Tramo 2', total: 2, dentro: 1 },
    { tramo: 'Otro', total: 1, dentro: 0 },
    { tramo: null, total: 1, dentro: 0 },
  ]);
});
