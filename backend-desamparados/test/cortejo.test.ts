// Pruebas del reparto del cortejo por antigüedad (domain/cortejo.ts), sin base:
// quién va delante, cuántos caben en cada tramo y qué puestos no se tocan.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cuantosPorTramo, problemaConfiguracion, repartirCortejo, seReparte, type PapeletaDelCortejo } from '../src/domain/cortejo.js';

const papeleta = (id: number, fechaAlta: string, puesto = 'Nazareno', numeroHermano: number | null = id): PapeletaDelCortejo =>
  ({ id, puesto, fechaAlta, numeroHermano, hermanoId: id });

describe('cuántos en cada tramo', () => {
  test('en proporción a las plazas, sin dejar tramos vacíos ni amontonar', () => {
    assert.deepEqual(cuantosPorTramo([30, 30, 30, 30], 10), [2, 2, 3, 3]);
    assert.deepEqual(cuantosPorTramo([30, 30, 30, 30], 120), [30, 30, 30, 30]);
    assert.deepEqual(cuantosPorTramo([30, 30, 30, 30], 130), [32, 32, 33, 33]);
    assert.deepEqual(cuantosPorTramo([10, 30], 8), [2, 6]);
  });

  test('los números siempre suman el total', () => {
    for (const total of [0, 1, 7, 99, 1001]) {
      assert.equal(cuantosPorTramo([13, 7, 29, 1], total).reduce((s, c) => s + c, 0), total);
    }
  });
});

describe('el reparto', () => {
  const config = { tramos: [{ nombre: 'Cruz de guía', plazas: 2 }, { nombre: 'Tramo del trono', plazas: 2 }], puestos: ['nazareno'] };

  test('los más nuevos delante, los más antiguos junto al trono, y el número dentro de cada tramo', () => {
    const r = repartirCortejo(config, [
      papeleta(1, '1980-01-01'),
      papeleta(2, '2024-05-01'),
      papeleta(3, '2001-03-01'),
      papeleta(4, '2015-09-01'),
      papeleta(5, '2001-03-01', 'Trono'),
    ]);
    assert.deepEqual(r.asignaciones, [
      { papeletaId: 2, tramo: 'Cruz de guía', numero: 1 },
      { papeletaId: 4, tramo: 'Cruz de guía', numero: 2 },
      { papeletaId: 3, tramo: 'Tramo del trono', numero: 1 },
      { papeletaId: 1, tramo: 'Tramo del trono', numero: 2 },
    ]);
    assert.equal(r.fuera, 1);
    assert.deepEqual(r.tramos.map((t) => t.asignados), [2, 2]);
  });

  test('a igual fecha de alta, el número más alto es más nuevo, y quien aún no tiene número, el que más', () => {
    const r = repartirCortejo({ ...config, tramos: [{ nombre: 'Único', plazas: 5 }] }, [
      papeleta(10, '2000-01-01', 'Nazareno', 5), papeleta(11, '2000-01-01', 'Nazareno', 9), papeleta(12, '2000-01-01', 'Nazareno', null),
    ]);
    assert.deepEqual(r.asignaciones.map((a) => a.papeletaId), [12, 11, 10]);
  });

  test('el puesto se reconoce sin tildes ni mayúsculas', () => {
    assert.ok(seReparte({ tramos: [], puestos: ['Acólito'] }, ' ACOLITO '));
    assert.ok(!seReparte({ tramos: [], puestos: ['Nazareno'] }, 'Trono'));
  });
});

describe('la configuración', () => {
  test('explica qué falta', () => {
    assert.equal(problemaConfiguracion({ tramos: [{ nombre: 'Uno', plazas: 10 }], puestos: ['Nazareno'] }), null);
    assert.match(problemaConfiguracion({ tramos: [], puestos: ['Nazareno'] })!, /al menos un tramo/);
    assert.match(problemaConfiguracion({ tramos: [{ nombre: 'Uno', plazas: 1 }, { nombre: 'uno', plazas: 1 }], puestos: ['N'] })!, /mismo nombre/);
    assert.match(problemaConfiguracion({ tramos: [{ nombre: 'Uno', plazas: 0 }], puestos: ['N'] })!, /al menos una plaza/);
    assert.match(problemaConfiguracion({ tramos: [{ nombre: 'Uno', plazas: 3 }], puestos: [] })!, /al menos un puesto/);
  });
});
