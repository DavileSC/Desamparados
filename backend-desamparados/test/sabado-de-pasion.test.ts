// test/sabado-de-pasion.test.ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { motivoRepartoFueraDeTemporada, sabadoDePasion } from '../src/domain/sabado-de-pasion.js';

describe('el Sábado de Pasión', () => {
  test('el Sábado de Pasión es ocho días antes de Pascua', () => {
    // Pascua: 5 abr 2026, 28 mar 2027, 16 abr 2028.
    assert.equal(sabadoDePasion(2026), '2026-03-28');
    assert.equal(sabadoDePasion(2027), '2027-03-20');
    assert.equal(sabadoDePasion(2028), '2028-04-08');
  });
});

describe('los días de reparto, en su temporada', () => {
  test('la Pasión se reparte del 1 de enero a la víspera de su Sábado de Pasión', () => {
    assert.equal(motivoRepartoFueraDeTemporada('2027-01-01', 'PASION'), null);
    assert.equal(motivoRepartoFueraDeTemporada('2027-03-19', 'PASION'), null);
    // El Sábado de Pasión de 2027 es el 20 de marzo: ese día ya no.
    assert.match(motivoRepartoFueraDeTemporada('2027-03-20', 'PASION') ?? '', /para la de 2028, pon un día del 1 de enero al 7 de abril de 2028/);
  });

  test('un reparto de la Pasión en otoño se rechaza y dice cuándo ponerlo', () => {
    // La mesa lo apuntaría en la salida de 2026, que ya pasó.
    assert.match(motivoRepartoFueraDeTemporada('2026-10-01', 'PASION') ?? '', /para la de 2027, pon un día del 1 de enero al 19 de marzo de 2027/);
  });

  test('el Rosario se reparte solo en octubre', () => {
    assert.equal(motivoRepartoFueraDeTemporada('2026-10-01', 'ROSARIO'), null);
    assert.equal(motivoRepartoFueraDeTemporada('2026-10-31', 'ROSARIO'), null);
    assert.match(motivoRepartoFueraDeTemporada('2026-09-20', 'ROSARIO') ?? '', /1 al 31 de octubre de 2026/);
    assert.match(motivoRepartoFueraDeTemporada('2026-11-02', 'ROSARIO') ?? '', /1 al 31 de octubre de 2027/);
  });
});
