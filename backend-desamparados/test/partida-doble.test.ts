// Pruebas de la partida doble (domain/partida-doble.ts), sin base: la cuenta
// que se propone a cada categoría, los asientos que salen de los apuntes de
// caja, las sumas y saldos y la cuenta de resultados.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cuentaDeResultados, cuentaDeTesoreria, cuentaPropuesta, libroDiario, sumasYSaldos, type ApunteDeCaja } from '../src/domain/partida-doble.js';

describe('la cuenta de cada categoría', () => {
  test('se propone por el nombre, con las del plan de las entidades sin fines lucrativos', () => {
    assert.equal(cuentaPropuesta('Cuotas de hermanos', 'INGRESO'), '720');
    assert.equal(cuentaPropuesta('Papeletas de sitio', 'INGRESO'), '721');
    assert.equal(cuentaPropuesta('Donativos', 'INGRESO'), '740');
    assert.equal(cuentaPropuesta('Lotería y rifas', 'INGRESO'), '722');
    assert.equal(cuentaPropuesta('Comisiones bancarias', 'GASTO'), '626');
    assert.equal(cuentaPropuesta('Culto y cera', 'GASTO'), '602');
    assert.equal(cuentaPropuesta('Caridad', 'GASTO'), '650');
    assert.equal(cuentaPropuesta('Mantenimiento de enseres', 'GASTO'), '622');
    assert.equal(cuentaPropuesta('Devoluciones de recibos', 'GASTO'), '720');
  });

  test('lo que no casa va a la genérica de su lado', () => {
    assert.equal(cuentaPropuesta('Varios', 'INGRESO'), '759');
    assert.equal(cuentaPropuesta('Varios', 'GASTO'), '629');
  });

  test('el efectivo va a caja y todo lo demás al banco', () => {
    assert.equal(cuentaDeTesoreria('EFECTIVO'), '570');
    for (const m of ['BIZUM', 'TRANSFERENCIA', 'DOMICILIACION', 'TARJETA', null]) assert.equal(cuentaDeTesoreria(m), '572');
  });
});

describe('los asientos', () => {
  const apunte = (id: number, fecha: string, tipo: 'INGRESO' | 'GASTO', centimos: number, metodoPago: string | null, cuentaCategoria: string): ApunteDeCaja =>
    ({ id, fecha, concepto: `Apunte ${id}`, tipo, centimos, metodoPago, cuentaCategoria });
  const diario = libroDiario([
    apunte(3, '2026-03-01', 'GASTO', 1200, 'TRANSFERENCIA', '602'),
    apunte(1, '2026-01-10', 'INGRESO', 3000, 'EFECTIVO', '720'),
    apunte(2, '2026-01-10', 'INGRESO', 5000, 'DOMICILIACION', '720'),
    apunte(4, '2026-04-01', 'GASTO', 3000, 'DOMICILIACION', '720'), // una devolución
    apunte(5, '2026-05-01', 'INGRESO', -500, 'EFECTIVO', '740'), // una corrección en negativo
  ]);

  test('un ingreso carga la tesorería y abona su cuenta; un gasto, al revés; numerados por fecha', () => {
    assert.deepEqual(diario.map((a) => a.apunteId), [1, 2, 3, 4, 5]);
    assert.deepEqual(diario.map((a) => a.numero), [1, 2, 3, 4, 5]);
    assert.deepEqual(diario[0].lineas, [{ cuenta: '570', debe: 3000, haber: 0 }, { cuenta: '720', debe: 0, haber: 3000 }]);
    assert.deepEqual(diario[2].lineas, [{ cuenta: '602', debe: 1200, haber: 0 }, { cuenta: '572', debe: 0, haber: 1200 }]);
    assert.deepEqual(diario[4].lineas, [{ cuenta: '740', debe: 500, haber: 0 }, { cuenta: '570', debe: 0, haber: 500 }]);
  });

  test('cada asiento cuadra, y las sumas también', () => {
    for (const a of diario) assert.equal(a.lineas.reduce((s, l) => s + l.debe - l.haber, 0), 0);
    const sumas = sumasYSaldos(diario);
    assert.equal(sumas.reduce((s, x) => s + x.debe, 0), sumas.reduce((s, x) => s + x.haber, 0));
    assert.deepEqual(sumas.find((s) => s.cuenta === '720'), { cuenta: '720', nombre: 'Cuotas de asociados y afiliados', debe: 3000, haber: 8000, saldo: -5000 });
    assert.deepEqual(sumas.map((s) => s.cuenta), ['570', '572', '602', '720', '740']);
  });

  test('la cuenta de resultados: ingresos menos gastos, con la devolución minorando las cuotas', () => {
    const r = cuentaDeResultados(sumasYSaldos(diario));
    assert.deepEqual(r.ingresos.map((x) => [x.cuenta, x.importe]), [['720', 5000], ['740', -500]]);
    assert.deepEqual(r.gastos.map((x) => [x.cuenta, x.importe]), [['602', 1200]]);
    assert.equal(r.excedente, 5000 - 500 - 1200);
  });
});
