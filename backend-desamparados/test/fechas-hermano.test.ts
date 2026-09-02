// La regla vive suelta, sin base de datos: secretaría regulariza fichas antiguas
// a mano y estas dos fechas son las que más se tocan.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { comprobarFechasHermano } from '../src/domain/fechas-hermano.js';

const ALTA = new Date('2020-03-15');

describe('fechas de alta y baja del hermano', () => {
  test('una baja posterior al alta vale', () => {
    assert.deepEqual(comprobarFechasHermano(ALTA, new Date('2024-01-10')), {});
  });

  test('la baja el mismo día del alta vale', () => {
    // Alguien que se da de alta y se arrepiente el mismo día existe.
    assert.deepEqual(comprobarFechasHermano(ALTA, ALTA), {});
  });

  test('una baja anterior al alta se rechaza', () => {
    assert.throws(
      () => comprobarFechasHermano(ALTA, new Date('2019-12-31')),
      /baja.*anterior.*alta/i,
    );
  });

  test('quitar la fecha de baja vuelve a poner activo al hermano', () => {
    assert.deepEqual(comprobarFechasHermano(ALTA, null), { activo: true });
  });

  test('si no se toca ninguna fecha, no fuerza nada', () => {
    assert.deepEqual(comprobarFechasHermano(undefined, undefined), {});
  });

  test('poner solo la baja, sin tocar el alta, no se puede comprobar y pasa', () => {
    // El servicio le pasará el alta que ya tiene la ficha; si aun así llega sin
    // ella, no inventamos una regla con datos que no tenemos.
    assert.deepEqual(comprobarFechasHermano(undefined, new Date('2024-01-10')), {});
  });
});
