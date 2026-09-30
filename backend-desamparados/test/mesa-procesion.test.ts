// Reglas de la mesa de la procesión sin base de datos: la altura de hombro
// dictada al tallar, la talla escrita en el número de la túnica, qué ropa se
// propone a quien vuelve.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  tunicaParaSuTalla,
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

describe('la túnica de su talla', () => {
  const libres = [
    { numero: '140-12', talla: null },
    { numero: '146-03', talla: null },
    { numero: '150-07', talla: null },
    { numero: 'T-9', talla: '1,44' },
    { numero: 'sin-talla', talla: null },
  ];

  test('la de talla más cercana a su altura al hombro; a igual distancia, la más larga', () => {
    assert.equal(tunicaParaSuTalla(145, libres)?.numero, '146-03');
    assert.equal(tunicaParaSuTalla(143, libres)?.numero, 'T-9', 'la talla apuntada vale si el número no la dice');
    assert.equal(tunicaParaSuTalla(148, [{ numero: '146-01', talla: null }, { numero: '150-02', talla: null }])?.numero, '150-02', 'empate: la más larga');
  });

  test('fuera de la holgura, o sin saber su altura, ninguna', () => {
    assert.equal(tunicaParaSuTalla(160, libres), null, 'demasiado corta: no hay de su talla');
    assert.equal(tunicaParaSuTalla(130, libres), null, 'demasiado larga');
    assert.equal(tunicaParaSuTalla(null, libres), null);
  });

  test('la propuesta: la de su talla si no tiene en casa ni está libre la de antes', () => {
    const base = { prestadas: [], tieneTunicaPropia: false, puestoDeLaFicha: null };
    const ropero = { libres, alturaHombro: 145 };
    const anterior = (numTunicaAsignada: string | null) => ({ puesto: 'Nazareno', numTunicaAsignada, numCapiroteAsignado: null, numFaraonaAsignada: null, origenTunica: 'ROPERO' as const });

    assert.deepEqual(propuestaDeRopa({ ...base, anterior: null, ropero }).tunica, { origen: 'ROPERO', numero: '146-03', porTalla: true }, 'primera vez');
    assert.deepEqual(propuestaDeRopa({ ...base, anterior: anterior('150-07'), ropero }).tunica, { origen: 'ROPERO', numero: '150-07' }, 'la de antes, libre: esa');
    assert.deepEqual(propuestaDeRopa({ ...base, anterior: anterior('999-99'), ropero }).tunica, { origen: 'ROPERO', numero: '146-03', porTalla: true }, 'la de antes, ocupada: la de su talla');
    assert.deepEqual(propuestaDeRopa({ ...base, anterior: anterior('999-99'), ropero: { libres, alturaHombro: 180 } }).tunica, { origen: 'ROPERO', numero: '999-99' }, 'sin ninguna de su talla, se queda la de antes');
    assert.deepEqual(propuestaDeRopa({ ...base, prestadas: [{ tipo: 'TUNICA', numero: '120-01' }], anterior: null, ropero }).tunica, { origen: 'ROPERO', numero: '120-01' }, 'la que tiene en casa, siempre');
    assert.deepEqual(propuestaDeRopa({ ...base, tieneTunicaPropia: true, anterior: null, ropero }).tunica, { origen: 'PROPIA', numero: null }, 'la propia no se toca');
    assert.deepEqual(propuestaDeRopa({ ...base, anterior: null }).tunica, { origen: 'ROPERO', numero: null }, 'sin ropero, como siempre');
  });
});
