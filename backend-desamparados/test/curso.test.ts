// test/curso.test.ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { rangoDelCurso, sabadoDePasion } from '../src/domain/curso.js';

describe('el curso, de un Sábado de Pasión al siguiente', () => {
  test('el Sábado de Pasión es ocho días antes de Pascua', () => {
    // Pascua: 5 abr 2026, 28 mar 2027, 16 abr 2028.
    assert.equal(sabadoDePasion(2026), '2026-03-28');
    assert.equal(sabadoDePasion(2027), '2027-03-20');
    assert.equal(sabadoDePasion(2028), '2028-04-08');
  });

  test('en septiembre, el curso va de la estación de este año a la del que viene', () => {
    const { desde, hasta } = rangoDelCurso('2026-09-23');
    // Medianoche de Madrid: en marzo de 2026 aún es horario de invierno (UTC+1).
    assert.equal(desde.toISOString(), '2026-03-27T23:00:00.000Z');
    // Hasta el final del 20 de marzo de 2027, incluido.
    assert.equal(hasta.toISOString(), '2027-03-20T23:00:00.000Z');
  });

  test('el mismo día de la estación todavía es del curso que acaba', () => {
    assert.equal(rangoDelCurso('2027-03-20').desde.toISOString(), '2026-03-27T23:00:00.000Z');
    assert.equal(rangoDelCurso('2027-03-21').desde.toISOString(), '2027-03-19T23:00:00.000Z');
  });

  test('en enero, el curso empezó el año anterior', () => {
    const { desde, hasta } = rangoDelCurso('2027-01-10');
    assert.equal(desde.toISOString(), '2026-03-27T23:00:00.000Z');
    assert.equal(hasta.toISOString(), '2027-03-20T23:00:00.000Z');
  });
});
