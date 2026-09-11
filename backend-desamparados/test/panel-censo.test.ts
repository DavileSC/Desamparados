// La serie del censo no se puede consultar: no existe "cuántos activos había en
// enero". Se reconstruye hacia atrás desde el total de hoy, así que el cálculo
// vive aparte y se prueba sin base de datos.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { claveMes, serieCensoMensual, ultimosMeses, whereAltasAprobadas } from '../src/domain/panel-censo.js';
import { claveMesMadrid } from '../src/domain/contabilidad.js';

describe('serie mensual del censo', () => {
  test('resta las altas y suma las bajas para ir hacia atrás', () => {
    const serie = serieCensoMensual(
      342,
      [{ mes: '2026-08', total: 5 }],
      [{ mes: '2026-08', total: 2 }],
      ['2026-07', '2026-08'],
    );
    // En agosto entraron 5 y salieron 2, luego en julio cerraron 339.
    assert.deepEqual(serie, [
      { mes: '2026-07', activos: 339 },
      { mes: '2026-08', activos: 342 },
    ]);
  });

  test('un mes sin movimientos repite el total', () => {
    const serie = serieCensoMensual(100, [], [], ['2026-06', '2026-07', '2026-08']);
    assert.deepEqual(serie.map((p) => p.activos), [100, 100, 100]);
  });

  test('un alta y una baja el mismo mes se compensan', () => {
    const serie = serieCensoMensual(
      50,
      [{ mes: '2026-08', total: 3 }],
      [{ mes: '2026-08', total: 3 }],
      ['2026-07', '2026-08'],
    );
    assert.equal(serie[0].activos, 50);
  });

  test('nunca devuelve un censo negativo', () => {
    // Datos incoherentes (mas altas registradas que hermanos hay hoy) llevarian
    // el acumulado a -3 en julio. Sin el suelo en cero, la grafica bajaria por
    // debajo del eje. Este caso falla si se quita el Math.max de panel-censo.ts.
    const serie = serieCensoMensual(2, [{ mes: '2026-08', total: 5 }], [], ['2026-07', '2026-08']);
    assert.deepEqual(serie.map((p) => p.activos), [0, 2]);
  });

  test('ignora movimientos de meses que no están en la ventana', () => {
    const serie = serieCensoMensual(
      10,
      [{ mes: '2020-01', total: 999 }],
      [],
      ['2026-07', '2026-08'],
    );
    assert.deepEqual(serie.map((p) => p.activos), [10, 10]);
  });
});

describe('ultimosMeses', () => {
  test('devuelve doce meses en orden, terminando en el actual', () => {
    const meses = ultimosMeses(new Date('2026-08-15T12:00:00Z'), 12);
    assert.equal(meses.length, 12);
    assert.equal(meses[11], '2026-08');
    assert.equal(meses[0], '2025-09');
  });

  test('cruza bien el cambio de año', () => {
    const meses = ultimosMeses(new Date('2026-02-01T12:00:00Z'), 3);
    assert.deepEqual(meses, ['2025-12', '2026-01', '2026-02']);
  });

  test('el mes en curso es el de Madrid: el 31-12 a las 23:30 UTC ya es enero', () => {
    const meses = ultimosMeses(new Date('2026-12-31T23:30:00Z'), 2);
    assert.deepEqual(meses, ['2026-12', '2027-01']);
  });
});

// El panel y la contabilidad tienen que partir los meses igual: antes el panel
// contaba en UTC y lo cobrado en la primera hora del día 1 caía en el mes anterior.
describe('claveMes cuenta en meses de Madrid', () => {
  test('la primera hora del 1 de febrero (invierno) es febrero', () => {
    // 00:30 del 1-02 en Madrid = 23:30 UTC del 31-01.
    assert.equal(claveMes(new Date('2026-01-31T23:30:00Z')), '2026-02');
  });

  test('la primera hora y media del 1 de julio (verano) es julio', () => {
    // 01:30 del 1-07 en Madrid = 23:30 UTC del 30-06.
    assert.equal(claveMes(new Date('2026-06-30T23:30:00Z')), '2026-07');
  });

  test('y coincide con la contabilidad', () => {
    for (const iso of ['2026-01-31T23:30:00Z', '2026-03-28T23:30:00Z', '2026-10-24T22:30:00Z', '2026-12-31T23:00:00Z']) {
      assert.equal(claveMes(new Date(iso)), claveMesMadrid(new Date(iso)), iso);
    }
  });
});

describe('altas del censo', () => {
  test('cuentan solo hermanos aprobados, no solicitudes pendientes', () => {
    const desde = new Date('2025-09-10T22:00:00Z');
    // Pendiente = activo:false y sin fechaBaja: queda fuera del OR.
    assert.deepEqual(whereAltasAprobadas(desde), {
      fechaAlta: { gte: desde },
      OR: [{ activo: true }, { fechaBaja: { not: null } }],
    });
  });
});
