// El código del QR de la papeleta (octubre de 2026): el contrato entre la
// papeleta que lo imprime y el escaneo en la puerta del templo.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { codigoDeFamilia, codigoDePapeleta, leerCodigoDeFamilia, leerCodigoDePapeleta } from '../src/domain/papeleta-qr.js';

const SECRETO = 'secreto-de-prueba-con-mas-de-treinta-y-dos-caracteres';

describe('el código del QR de la papeleta', () => {
  test('tiene la forma DSP1.<id>.<firma> y se lee de vuelta', () => {
    const codigo = codigoDePapeleta(1234, SECRETO);
    assert.match(codigo, /^DSP1\.1234\.[A-Za-z0-9_-]{16}$/);
    assert.equal(leerCodigoDePapeleta(codigo, SECRETO), 1234);
    assert.equal(leerCodigoDePapeleta(`  ${codigo}\n`, SECRETO), 1234, 'el lector puede añadir espacios');
  });

  test('no se puede cambiar el número ni fabricar uno sin la clave', () => {
    const firmaDe1234 = codigoDePapeleta(1234, SECRETO).split('.')[2];
    assert.equal(leerCodigoDePapeleta(`DSP1.1235.${firmaDe1234}`, SECRETO), null, 'otro número con la firma de 1234');
    assert.equal(leerCodigoDePapeleta(codigoDePapeleta(1234, 'otra-clave-distinta-de-la-del-servidor-xx'), SECRETO), null);
  });

  test('lo que no es un código de papeleta, null', () => {
    for (const texto of ['', 'hola', 'DSP1.0.AAAAAAAAAAAAAAAA', 'DSP2.12.AAAAAAAAAAAAAAAA', 'DSP1.12.corta', 'https://example.com/DSP1.12.AAAAAAAAAAAAAAAA']) {
      assert.equal(leerCodigoDePapeleta(texto, SECRETO), null, texto);
    }
    assert.throws(() => codigoDePapeleta(0, SECRETO));
  });
});

describe('el código del QR de la familia', () => {
  const FAMILIA = { cuenta: 9047, salidaId: 1, year: 2027 };

  test('tiene la forma DSF1.<cuenta>.<salida>.<año>.<firma>, se lee de vuelta y cabe en la puerta', () => {
    const codigo = codigoDeFamilia(FAMILIA, SECRETO);
    assert.match(codigo, /^DSF1\.9047\.1\.2027\.[A-Za-z0-9_-]{16}$/);
    assert.deepEqual(leerCodigoDeFamilia(` ${codigo}
`, SECRETO), FAMILIA);
    assert.ok(codigoDeFamilia({ cuenta: 9_999_999_999, salidaId: 9_999_999_999, year: 2100 }, SECRETO).length <= 64, 'el esquema de la puerta acepta hasta 64');
  });

  test('no se puede cambiar la cuenta, la salida ni el año, ni pasar por una papeleta', () => {
    const firmaBuena = codigoDeFamilia(FAMILIA, SECRETO).split('.')[4];
    assert.equal(leerCodigoDeFamilia(`DSF1.9048.1.2027.${firmaBuena}`, SECRETO), null, 'otra cuenta');
    assert.equal(leerCodigoDeFamilia(`DSF1.9047.2.2027.${firmaBuena}`, SECRETO), null, 'otra salida');
    assert.equal(leerCodigoDeFamilia(`DSF1.9047.1.2028.${firmaBuena}`, SECRETO), null, 'otro año');
    assert.equal(leerCodigoDePapeleta(codigoDeFamilia(FAMILIA, SECRETO), SECRETO), null);
    assert.equal(leerCodigoDeFamilia(codigoDePapeleta(9047, SECRETO), SECRETO), null);
    assert.throws(() => codigoDeFamilia({ ...FAMILIA, cuenta: 0 }, SECRETO));
  });
});
