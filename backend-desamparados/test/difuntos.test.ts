// Los aniversarios de los hermanos difuntos (octubre de 2026).

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { aniosDeHermano, proximoAniversario } from '../src/domain/difuntos.js';

// Mediodía en Madrid: sin sustos de zona horaria en las fechas de las pruebas.
const d = (dia: string) => new Date(`${dia}T10:00:00Z`);

describe('el próximo aniversario', () => {
  test('este año si aún no ha pasado; si no, el que viene', () => {
    assert.deepEqual(proximoAniversario(d('2020-11-03'), d('2026-10-01')), { dia: '2026-11-03', anios: 6, faltan: 33 });
    assert.deepEqual(proximoAniversario(d('2020-03-15'), d('2026-10-01')), { dia: '2027-03-15', anios: 7, faltan: 165 });
  });

  test('hoy es hoy: faltan 0', () => {
    assert.deepEqual(proximoAniversario(d('2019-10-01'), d('2026-10-01')), { dia: '2026-10-01', anios: 7, faltan: 0 });
  });

  test('el mismo año del fallecimiento no hay aniversario: el primero, al año siguiente', () => {
    assert.deepEqual(proximoAniversario(d('2026-09-20'), d('2026-10-01')), { dia: '2027-09-20', anios: 1, faltan: 354 });
    assert.equal(proximoAniversario(d('2026-12-20'), d('2026-10-01')).dia, '2027-12-20');
  });

  test('un 29 de febrero se recuerda el 28 los años que no lo tienen', () => {
    assert.equal(proximoAniversario(d('2024-02-29'), d('2026-10-01')).dia, '2027-02-28');
    assert.equal(proximoAniversario(d('2024-02-29'), d('2027-10-01')).dia, '2028-02-29');
  });

  test('el día es el de Madrid: la medianoche del 3 en Madrid es el 2 en hora universal', () => {
    assert.equal(proximoAniversario(new Date('2020-11-02T23:30:00Z'), d('2026-10-01')).dia, '2026-11-03');
  });
});

describe('los años de hermano', () => {
  test('completos, del alta al fallecimiento', () => {
    assert.equal(aniosDeHermano(d('1990-05-10'), d('2026-05-09')), 35);
    assert.equal(aniosDeHermano(d('1990-05-10'), d('2026-05-10')), 36);
    assert.equal(aniosDeHermano(d('2026-05-10'), d('2026-01-01')), 0, 'nunca negativos');
  });
});
