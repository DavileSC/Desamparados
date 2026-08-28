// La serie del censo no se puede consultar: no existe "cuántos activos había en
// enero". Se reconstruye hacia atrás desde el total de hoy, así que el cálculo
// vive aparte y se prueba sin base de datos.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { serieCensoMensual, ultimosMeses } from '../src/domain/panel-censo.js';

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
});
