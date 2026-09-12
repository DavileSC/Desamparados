// Funciones puras: se ejecutan siempre, sin base de datos.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  leerEjercicio,
  mesesDelEjercicio,
  mesesParaReconstruir,
  rangoDeMeses,
  rangoDelEjercicio,
} from '../src/domain/panel-ejercicio.js';
import { ultimosMeses } from '../src/domain/panel-censo.js';
import { HttpError } from '../src/utils/error.handle.js';

// 11 de septiembre de 2026, a mediodía: lejos de los bordes de día y de zona.
const HOY = new Date('2026-09-11T12:00:00.000Z');

describe('leerEjercicio', () => {
  test('sin parámetro, el año en curso y abierto', () => {
    assert.deepEqual(leerEjercicio(undefined, HOY), { anio: 2026, cerrado: false });
    assert.deepEqual(leerEjercicio('', HOY), { anio: 2026, cerrado: false });
  });

  test('un año anterior queda marcado como cerrado', () => {
    assert.deepEqual(leerEjercicio('2025', HOY), { anio: 2025, cerrado: true });
  });

  test('acepta el número además de la cadena de la query', () => {
    assert.deepEqual(leerEjercicio(2024, HOY), { anio: 2024, cerrado: true });
  });

  test('rechaza lo que no es un año con un 400 explicado', () => {
    // La cadena vacía no entra aquí: es «sin parámetro», y ya se comprueba arriba.
    const malos: unknown[] = ['abc', '2025.5', '20255', ' ', '2027', '1999', -1, [], {}];
    for (const malo of malos) {
      assert.throws(
        () => leerEjercicio(malo, HOY),
        (e: unknown) => e instanceof HttpError && e.status === 400 && /2000/.test(e.message),
        `${JSON.stringify(malo)} debería dar 400`,
      );
    }
  });

  test('el año en curso es el último válido: el que viene no', () => {
    assert.deepEqual(leerEjercicio('2026', HOY), { anio: 2026, cerrado: false });
    assert.throws(() => leerEjercicio('2027', HOY), HttpError);
  });
});

describe('mesesDelEjercicio', () => {
  test('el año en curso enseña los últimos doce meses, como hasta ahora', () => {
    const meses = mesesDelEjercicio({ anio: 2026, cerrado: false }, HOY);
    assert.deepEqual(meses, ultimosMeses(HOY, 12));
    assert.equal(meses[11], '2026-09');
  });

  test('un año cerrado enseña sus doce meses naturales', () => {
    const meses = mesesDelEjercicio({ anio: 2025, cerrado: true }, HOY);
    assert.equal(meses.length, 12);
    assert.equal(meses[0], '2025-01');
    assert.equal(meses[11], '2025-12');
  });
});

describe('mesesParaReconstruir', () => {
  test('el año en curso no necesita más meses de los que enseña', () => {
    const mostrados = mesesDelEjercicio({ anio: 2026, cerrado: false }, HOY);
    assert.deepEqual(mesesParaReconstruir(mostrados, HOY), mostrados);
  });

  test('un año cerrado llega hasta el mes de hoy', () => {
    // El censo se reconstruye hacia atrás desde los activos de HOY: sin las
    // altas y bajas de 2026 no se sabe cuántos había en diciembre de 2025.
    const mostrados = mesesDelEjercicio({ anio: 2025, cerrado: true }, HOY);
    const recorrido = mesesParaReconstruir(mostrados, HOY);
    assert.equal(recorrido[0], '2025-01');
    assert.equal(recorrido[recorrido.length - 1], '2026-09');
    assert.equal(recorrido.length, 21);
    for (const mes of mostrados) assert.ok(recorrido.includes(mes), `falta ${mes}`);
  });
});

describe('rangos de fechas', () => {
  test('el ejercicio va del 1 de enero al 1 de enero siguiente', () => {
    const { desde, hasta } = rangoDelEjercicio(2025);
    assert.equal(desde.toISOString(), '2024-12-31T23:00:00.000Z'); // 00:00 de Madrid
    assert.equal(hasta.toISOString(), '2025-12-31T23:00:00.000Z');
  });

  test('el rango de unos meses abarca el último entero', () => {
    const { desde, hasta } = rangoDeMeses(['2025-11', '2025-12']);
    assert.equal(desde.toISOString(), '2025-10-31T23:00:00.000Z');
    assert.equal(hasta.toISOString(), '2025-12-31T23:00:00.000Z');
  });
});
