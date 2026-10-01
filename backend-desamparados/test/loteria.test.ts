// Las cuentas de la lotería (octubre de 2026): cuántas participaciones caben,
// qué cobra cada una y cómo se numeran.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  maximoDeParticipaciones, maximoDeTalonarios, numeroImpreso, numerosDe, participacionesDelTalonario, premioPorParticipacion,
} from '../src/domain/loteria.js';

// 50 décimos de 20 € de un número; participaciones de 5 € que juegan 4 €.
const NAVIDAD = { numeros: [{ numero: '04512', premio: null }], decimos: 50, precioDecimo: 2000, precioParticipacion: 500, jugado: 400, porTalonario: 50 };

describe('la lotería', () => {
  test('no se emiten más participaciones de las que juegan los décimos', () => {
    assert.equal(maximoDeParticipaciones(NAVIDAD), 250, '1.000 € en décimos / 4 € cada una');
    assert.equal(maximoDeTalonarios(NAVIDAD), 5);
    const dos = { ...NAVIDAD, numeros: [...NAVIDAD.numeros, { numero: '81234', premio: null }] };
    assert.equal(maximoDeParticipaciones(dos), 500, 'con dos números hay el doble de décimos');
  });

  test('el premio: la parte del décimo que juega, repartida entre los números', () => {
    // El Gordo: 400.000 € al décimo. Una participación de 4 € es la quinta parte.
    assert.equal(premioPorParticipacion({ ...NAVIDAD, numeros: [{ numero: '04512', premio: 40_000_000 }] }), 8_000_000);
    // Dos números: 2 € a cada uno. Si toca uno con 100 € al décimo, cobra 10 €.
    assert.equal(premioPorParticipacion({ ...NAVIDAD, numeros: [{ numero: '04512', premio: 10_000 }, { numero: '81234', premio: null }] }), 1000);
    // Tres números: 1,333… € a cada uno; no se paga el céntimo que no existe.
    assert.equal(premioPorParticipacion({ ...NAVIDAD, numeros: ['1', '2', '3'].map((n) => ({ numero: `0000${n}`, premio: 2000 })) }), 400);
  });

  test('cada talonario tiene su tramo y los números miden lo mismo', () => {
    assert.deepEqual(participacionesDelTalonario(3, 50), { desde: 101, hasta: 150 });
    assert.equal(numeroImpreso(42, 250), '0042');
    assert.equal(numeroImpreso(42, 12000), '00042');
  });

  test('los números guardados se leen con cuidado', () => {
    assert.deepEqual(numerosDe([{ numero: '04512', premio: 500 }, { numero: '4512' }, { numero: '00001', premio: -3 }, 'x']), [
      { numero: '04512', premio: 500 }, { numero: '00001', premio: null },
    ]);
    assert.deepEqual(numerosDe(null), []);
  });
});
