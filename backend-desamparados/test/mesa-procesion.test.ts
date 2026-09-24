// Reglas de la mesa de la procesión sin base de datos: la altura de hombro
// dictada al tallar, la talla escrita en el número de la túnica, qué ropa se
// propone a quien vuelve.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  PUESTOS,
  alturaHombroEnCm,
  normalizarNumeroPrenda,
  propuestaDeRopa,
  tallaDeTunica,
} from '../src/domain/mesa-procesion.js';

describe('la altura de hombro', () => {
  test('se dicta en metros, con coma o con punto, y se guarda en centímetros', () => {
    assert.equal(alturaHombroEnCm('1,45'), 145);
    assert.equal(alturaHombroEnCm('1.54'), 154);
    assert.equal(alturaHombroEnCm('1,5'), 150);
    assert.equal(alturaHombroEnCm('1.4 m'), 140);
  });

  test('también vale en centímetros', () => {
    assert.equal(alturaHombroEnCm('145'), 145);
    assert.equal(alturaHombroEnCm('160 cm'), 160);
  });

  test('lo que no es una altura de hombro razonable no se guarda', () => {
    for (const texto of ['', 'alto', '14,5', '1450', '0,90', '2,40', '1,4,5']) {
      assert.equal(alturaHombroEnCm(texto), null, texto);
    }
  });
});

describe('el número de las prendas', () => {
  test('la túnica «145-31» es de la talla 145', () => {
    assert.equal(tallaDeTunica('145-31'), '145');
    assert.equal(tallaDeTunica('095-02'), '095');
    assert.equal(tallaDeTunica('140 - 107'), '140');
  });

  test('un número sin guion no dice talla', () => {
    assert.equal(tallaDeTunica('TUN-014'), null);
    assert.equal(tallaDeTunica('150'), null);
  });

  test('se guarda sin espacios y en mayúsculas', () => {
    assert.equal(normalizarNumeroPrenda(' 21m '), '21M');
    assert.equal(normalizarNumeroPrenda('145 - 31'), '145-31');
  });
});

describe('la ropa que se propone', () => {
  const sinNada = { anterior: null, prestadas: [], tieneTunicaPropia: false, puestoDeLaFicha: null };
  const anterior = {
    puesto: 'Nazareno', numTunicaAsignada: '140-107', numCapiroteAsignado: '150',
    numFaraonaAsignada: null, origenTunica: 'ROPERO' as const,
  };

  test('lo que ya tiene prestado manda sobre lo del año pasado', () => {
    const p = propuestaDeRopa({ ...sinNada, anterior, prestadas: [{ tipo: 'TUNICA', numero: '145-31' }] });
    assert.deepEqual(p.tunica, { origen: 'ROPERO', numero: '145-31' });
    assert.equal(p.capirote, '150');
    assert.equal(p.puesto, 'Nazareno');
  });

  test('si no tiene nada prestado, lo que llevó la última vez', () => {
    const p = propuestaDeRopa({ ...sinNada, anterior });
    assert.deepEqual(p.tunica, { origen: 'ROPERO', numero: '140-107' });
    assert.equal(p.capirote, '150');
  });

  test('quien salió con túnica propia o sin túnica vuelve igual', () => {
    assert.equal(propuestaDeRopa({ ...sinNada, anterior: { ...anterior, numTunicaAsignada: null, origenTunica: 'PROPIA' } }).tunica.origen, 'PROPIA');
    assert.equal(propuestaDeRopa({ ...sinNada, anterior: { ...anterior, numTunicaAsignada: null, origenTunica: 'NINGUNA' } }).tunica.origen, 'NINGUNA');
  });

  test('quien sale por primera vez: túnica propia si su ficha lo dice; si no, del ropero sin número', () => {
    assert.deepEqual(propuestaDeRopa({ ...sinNada, tieneTunicaPropia: true }).tunica, { origen: 'PROPIA', numero: null });
    assert.deepEqual(propuestaDeRopa(sinNada).tunica, { origen: 'ROPERO', numero: null });
    assert.equal(propuestaDeRopa({ ...sinNada, puestoDeLaFicha: 'Trono' }).puesto, 'Trono');
  });

  test('el cíngulo va con la túnica: del ropero se presta, con la propia lleva el suyo, sin túnica ninguno', () => {
    assert.equal(propuestaDeRopa(sinNada).cingulo, 'PRESTADO');
    assert.equal(propuestaDeRopa({ ...sinNada, tieneTunicaPropia: true }).cingulo, 'PROPIO');
    assert.equal(propuestaDeRopa({ ...sinNada, anterior: { ...anterior, numTunicaAsignada: null, origenTunica: 'NINGUNA' } }).cingulo, 'NINGUNO');
  });

  test('la faraona de guardería se propone aparte del capirote', () => {
    const p = propuestaDeRopa({ ...sinNada, prestadas: [{ tipo: 'FARAONA', numero: '21M' }] });
    assert.equal(p.faraona, '21M');
    assert.equal(p.capirote, null);
  });
});

test('el catálogo de puestos trae los de la hoja, con su ropa', () => {
  const puesto = (nombre: string) => PUESTOS.find((p) => p.nombre === nombre);
  assert.equal(puesto('Nazareno')?.tocado, 'CAPIROTE');
  assert.equal(puesto('Guardería')?.tocado, 'FARAONA');
  assert.equal(puesto('Trono')?.alturaHombro, true);
  assert.equal(puesto('Mantilla')?.tunica, false);
  assert.equal(new Set(PUESTOS.map((p) => p.nombre)).size, PUESTOS.length);
});
