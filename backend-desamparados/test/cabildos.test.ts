// Pruebas de las reglas de los cabildos (domain/cabildos.ts), sin base: quién
// tiene voto el día del cabildo, cuántos hacen falta para el quórum y qué sale
// de cada votación.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { REGLAS_POR_DEFECTO as R, aniosAntes, problemaRecuento, quorum, resultado, tieneVoto } from '../src/domain/cabildos.js';

describe('quién tiene voto', () => {
  test('mayor de edad y con un año de antigüedad el día del cabildo, y activo', () => {
    const dia = '2026-10-15';
    assert.ok(tieneVoto({ activo: true, fechaNacimiento: '2008-10-15', fechaAlta: '2025-10-15' }, dia, R));
    assert.ok(!tieneVoto({ activo: true, fechaNacimiento: '2008-10-16', fechaAlta: '2020-01-01' }, dia, R), 'cumple los 18 al día siguiente');
    assert.ok(!tieneVoto({ activo: true, fechaNacimiento: '1980-01-01', fechaAlta: '2025-10-16' }, dia, R), 'le falta un día de antigüedad');
    assert.ok(!tieneVoto({ activo: false, fechaNacimiento: '1980-01-01', fechaAlta: '2000-01-01' }, dia, R));
  });

  test('el 29 de febrero, en un año sin él, pasa al 28', () => {
    assert.equal(aniosAntes('2028-02-29', 1), '2027-02-28');
    assert.equal(aniosAntes('2028-02-29', 4), '2024-02-29');
  });
});

describe('el quórum', () => {
  test('en primera, más de la mitad del censo con voto', () => {
    assert.deepEqual(quorum(51, 100, R), { necesarios: 51, enPrimera: true });
    assert.deepEqual(quorum(50, 100, R), { necesarios: 51, enPrimera: false });
    assert.deepEqual(quorum(2, 3, R), { necesarios: 2, enPrimera: true });
    assert.deepEqual(quorum(0, 0, R), { necesarios: 1, enPrimera: false });
    assert.equal(quorum(10, 100, { ...R, quorumPrimera: 33 }).necesarios, 34);
  });
});

describe('las votaciones', () => {
  test('mayoría simple: el empate no aprueba', () => {
    assert.equal(resultado({ aFavor: 10, enContra: 9, mayoria: 'SIMPLE' }), 'APROBADO');
    assert.equal(resultado({ aFavor: 9, enContra: 9, mayoria: 'SIMPLE' }), 'RECHAZADO');
  });

  test('dos tercios de los emitidos, sin contar abstenciones', () => {
    assert.equal(resultado({ aFavor: 20, enContra: 10, mayoria: 'DOS_TERCIOS' }), 'APROBADO');
    assert.equal(resultado({ aFavor: 19, enContra: 10, mayoria: 'DOS_TERCIOS' }), 'RECHAZADO');
    assert.equal(resultado({ aFavor: 0, enContra: 0, mayoria: 'DOS_TERCIOS' }), 'RECHAZADO');
  });

  test('no puede haber más votos que presentes con voto', () => {
    assert.equal(problemaRecuento({ aFavor: 3, enContra: 1, abstenciones: 1 }, 5), null);
    assert.match(problemaRecuento({ aFavor: 3, enContra: 2, abstenciones: 1 }, 5)!, /6 votos y solo 5 hermanos presentes con voto/);
    assert.match(problemaRecuento({ aFavor: 0, enContra: 0, abstenciones: 0 }, 5)!, /ningún voto/);
  });
});
