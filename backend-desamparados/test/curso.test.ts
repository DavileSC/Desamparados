// test/curso.test.ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { motivoRepartoFueraDeSuAnio, rangoDelCurso, sabadoDePasion } from '../src/domain/curso.js';

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

describe('los días de reparto, dentro del año de su salida', () => {
  test('la Pasión se reparte antes de su Sábado de Pasión, y el día mismo ya no', () => {
    assert.equal(motivoRepartoFueraDeSuAnio('2027-02-12', 'PASION'), null);
    assert.equal(motivoRepartoFueraDeSuAnio('2027-03-19', 'PASION'), null);
    assert.match(motivoRepartoFueraDeSuAnio('2027-03-20', 'PASION') ?? '', /Sábado de Pasión de 2027 es el 20 de marzo/);
  });

  test('un reparto de la Pasión en otoño se rechaza y dice cuándo ponerlo', () => {
    // La mesa lo apuntaría en la salida de 2026, que ya pasó.
    assert.match(
      motivoRepartoFueraDeSuAnio('2026-10-01', 'PASION') ?? '',
      /Para la de 2027, pon un día desde el 1 de enero hasta el 20 de marzo/,
    );
  });

  test('el Rosario se reparte hasta octubre', () => {
    assert.equal(motivoRepartoFueraDeSuAnio('2026-09-20', 'ROSARIO'), null);
    assert.equal(motivoRepartoFueraDeSuAnio('2026-10-31', 'ROSARIO'), null);
    assert.match(motivoRepartoFueraDeSuAnio('2026-11-02', 'ROSARIO') ?? '', /en octubre como muy tarde/);
  });
});
