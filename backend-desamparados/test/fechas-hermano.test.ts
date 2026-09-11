// La regla vive suelta, sin base de datos: secretaría regulariza fichas antiguas
// a mano y estas fechas son las que más se tocan.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  aniosCumplidos,
  comprobarBajaNoFutura,
  comprobarFechasHermano,
  comprobarMayoriaDeEdad,
  diaDeHoy,
} from '../src/domain/fechas-hermano.js';

const ALTA = new Date('2020-03-15');

describe('fechas de alta y baja del hermano', () => {
  test('una baja posterior al alta vale', () => {
    assert.doesNotThrow(() => comprobarFechasHermano(ALTA, new Date('2024-01-10')));
  });

  test('la baja el mismo día del alta vale', () => {
    // Alguien que se da de alta y se arrepiente el mismo día existe.
    assert.doesNotThrow(() => comprobarFechasHermano(ALTA, ALTA));
  });

  test('una baja anterior al alta se rechaza', () => {
    assert.throws(
      () => comprobarFechasHermano(ALTA, new Date('2019-12-31')),
      /baja.*anterior.*alta/i,
    );
  });

  test('quitar la fecha de baja ya no reactiva a nadie', () => {
    // Antes devolvía { activo: true }: una ficha pendiente se activaba sin
    // pasar por «Aprobar» y una baja se deshacía sin número ni cuenta.
    assert.equal(comprobarFechasHermano(ALTA, null), undefined);
  });

  test('si no se toca ninguna fecha, no pasa nada', () => {
    assert.doesNotThrow(() => comprobarFechasHermano(undefined, undefined));
  });

  test('una baja con fecha futura se rechaza; la de hoy vale', () => {
    assert.throws(() => comprobarBajaNoFutura(new Date('2026-09-12'), '2026-09-11'), /posterior a hoy/i);
    assert.doesNotThrow(() => comprobarBajaNoFutura(new Date('2026-09-11'), '2026-09-11'));
  });

  test('«hoy» es el día de Málaga, no el de UTC', () => {
    // 22:30 UTC del 11 de septiembre son las 00:30 del 12 en Málaga (UTC+2).
    assert.equal(diaDeHoy(new Date('2026-09-11T22:30:00Z')), '2026-09-12');
  });
});

describe('mayoría de edad para la emancipación', () => {
  test('cuenta el cumpleaños del año en curso', () => {
    const nacimiento = new Date('2008-09-11');
    assert.equal(aniosCumplidos(nacimiento, '2026-09-10'), 17);
    assert.equal(aniosCumplidos(nacimiento, '2026-09-11'), 18);
  });

  test('con 18 años cumplidos se puede emancipar', () => {
    assert.doesNotThrow(() => comprobarMayoriaDeEdad(new Date('2008-09-11'), '2026-09-11'));
  });

  test('un día antes de cumplirlos, no', () => {
    assert.throws(() => comprobarMayoriaDeEdad(new Date('2008-09-12'), '2026-09-11'), /18 años/);
  });

  test('sin fecha de nacimiento se pide completarla', () => {
    assert.throws(() => comprobarMayoriaDeEdad(null), /fecha de nacimiento/i);
  });
});
