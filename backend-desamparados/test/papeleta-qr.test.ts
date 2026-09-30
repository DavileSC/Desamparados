// El código del QR de la papeleta (octubre de 2026): el contrato entre la
// papeleta que lo imprime y el escaneo en la puerta del templo.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { codigoDePapeleta, leerCodigoDePapeleta } from '../src/domain/papeleta-qr.js';

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
