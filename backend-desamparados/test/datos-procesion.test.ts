// Reglas de la papeleta de sitio sin base de datos: concepto de la
// reemisión, datos del evento y fechas de mantenimiento. Son las que, cuando
// fallan, cobran de más o citan a los hermanos a una hora que no es.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  claveConcepto,
  instanteLimiteAusencias,
  motivoTurnoInvalido,
} from '../src/domain/datos-procesion.js';
import { conceptoDeSalida } from '../src/domain/salidas.js';

const conceptoPapeleta = (year: number, existentes: string[]) => conceptoDeSalida({ nombre: 'Sábado de Pasión', cobro: 'CUOTA' }, year, existentes);

describe('D2 · concepto del recibo al reinscribir', () => {
  test('la primera papeleta del año lleva el concepto de siempre', () => {
    assert.equal(conceptoPapeleta(2026, []), 'Papeleta Sábado de Pasión 2026');
    assert.equal(conceptoPapeleta(2026, ['Cuota anual']), 'Papeleta Sábado de Pasión 2026');
  });

  test('tras una anulación, la nueva sale como reemisión y no choca con la clave única', () => {
    assert.equal(conceptoPapeleta(2026, ['Papeleta Sábado de Pasión 2026']), 'Papeleta Sábado de Pasión 2026 (reemisión 2)');
    assert.equal(
      conceptoPapeleta(2026, ['Papeleta Sábado de Pasión 2026', 'Papeleta Sábado de Pasión 2026 (reemisión 2)']),
      'Papeleta Sábado de Pasión 2026 (reemisión 3)',
    );
  });

  test('ocupa el primer hueco libre si falta alguna reemisión intermedia', () => {
    assert.equal(
      conceptoPapeleta(2026, ['Papeleta Sábado de Pasión 2026', 'Papeleta Sábado de Pasión 2026 (reemisión 3)']),
      'Papeleta Sábado de Pasión 2026 (reemisión 2)',
    );
  });
});

describe('P5 · fecha límite de las ausencias', () => {
  const ahora = new Date('2026-09-11T12:00:00Z');

  test('sin fecha, el límite es ahora mismo', () => {
    assert.equal(instanteLimiteAusencias(undefined, ahora), ahora);
  });

  test('un día AAAA-MM-DD es el principio de ese día en Madrid, no la medianoche UTC', () => {
    // En verano Madrid va dos horas por delante: su medianoche son las 22:00 UTC del día anterior.
    assert.deepEqual(instanteLimiteAusencias('2026-09-11', ahora), new Date('2026-09-10T22:00:00.000Z'));
    // Y en invierno, una hora.
    assert.deepEqual(instanteLimiteAusencias('2026-01-15', ahora), new Date('2026-01-14T23:00:00.000Z'));
  });

  test('entre las 00:00 y las 02:00 de Madrid, «hoy» sigue siendo hoy y no un día futuro', () => {
    // 00:30 del 11 de septiembre en Madrid = 22:30 UTC del 10: leído en UTC, el 11 aún no había llegado y daba 400.
    const madrugada = new Date('2026-09-10T22:30:00Z');
    assert.deepEqual(instanteLimiteAusencias('2026-09-11', madrugada), new Date('2026-09-10T22:00:00.000Z'));
    assert.equal(instanteLimiteAusencias('2026-09-12', madrugada), null);
  });

  test('un instante completo vale si no es futuro', () => {
    assert.deepEqual(instanteLimiteAusencias('2026-09-11T12:00:00Z', ahora), ahora);
    assert.equal(instanteLimiteAusencias('2026-09-11T12:00:01Z', ahora), null);
  });

  test('una fecha futura no: marcaría ausentes a quien aún no le ha tocado', () => {
    assert.equal(instanteLimiteAusencias('2026-09-12', ahora), null);
  });

  test('una fecha ilegible o imposible no, en vez de acabar en Invalid Date y un 500', () => {
    assert.equal(instanteLimiteAusencias('mañana', ahora), null);
    assert.equal(instanteLimiteAusencias('', ahora), null);
    assert.equal(instanteLimiteAusencias('2026-02-30', ahora), null);
  });
});

describe('Turnos · horas del mismo día (de Madrid) y en orden', () => {
  const t = (s: string) => new Date(s);

  test('un turno de tarde normal vale', () => {
    assert.equal(motivoTurnoInvalido('2026-03-15', t('2026-03-15T18:00:00+01:00'), t('2026-03-15T21:00:00+01:00')), null);
  });

  test('el día se mira en Madrid: las 00:30 del 15 son todavía el 14 en UTC y valen', () => {
    assert.equal(motivoTurnoInvalido('2026-03-15', t('2026-03-15T00:30:00+01:00'), t('2026-03-15T02:00:00+01:00')), null);
    // Y en verano, las 23:30 del 15 en Madrid son las 21:30 UTC del mismo día.
    assert.equal(motivoTurnoInvalido('2026-07-15', t('2026-07-15T20:00:00+02:00'), t('2026-07-15T23:30:00+02:00')), null);
  });

  test('también con la fecha ya guardada (medianoche UTC, como la siembra y crearTurno)', () => {
    assert.equal(motivoTurnoInvalido(new Date(Date.UTC(2026, 1, 10)), t('2026-02-10T18:00:00+01:00'), t('2026-02-10T21:00:00+01:00')), null);
  });

  test('una hora sobre una fecha ficticia no vale: el turno parecería terminado desde siempre', () => {
    assert.equal(
      motivoTurnoInvalido('2026-03-15', t('1970-01-01T18:00:00Z'), t('1970-01-01T21:00:00Z')),
      'La hora de inicio tiene que ser del mismo día que el turno (15/03/2026).',
    );
  });

  test('un fin al día siguiente no vale', () => {
    assert.equal(
      motivoTurnoInvalido('2026-03-15', t('2026-03-15T22:00:00+01:00'), t('2026-03-16T00:30:00+01:00')),
      'La hora de fin tiene que ser del mismo día que el turno (15/03/2026).',
    );
  });

  test('el fin tiene que ir después del inicio', () => {
    const motivo = 'La hora de fin debe ser posterior a la hora de inicio.';
    assert.equal(motivoTurnoInvalido('2026-03-15', t('2026-03-15T21:00:00+01:00'), t('2026-03-15T18:00:00+01:00')), motivo);
    assert.equal(motivoTurnoInvalido('2026-03-15', t('2026-03-15T18:00:00+01:00'), t('2026-03-15T18:00:00+01:00')), motivo);
  });

  test('una fecha imposible o unas horas ilegibles no valen', () => {
    assert.equal(motivoTurnoInvalido('2026-02-30', t('2026-03-02T18:00:00+01:00'), t('2026-03-02T21:00:00+01:00')), 'La fecha del turno no es un día válido.');
    assert.equal(motivoTurnoInvalido('2026-03-15', t('ayer'), t('2026-03-15T21:00:00+01:00')), 'Las horas del turno no son válidas.');
  });
});

describe('D2 · conceptos comparados como los compara MariaDB (utf8mb4_unicode_ci)', () => {
  test('sin mayúsculas, sin tildes, con la ñ igual a la n y sin espacios finales', () => {
    assert.equal(claveConcepto('Papeleta de sitio 2026 (Reemisión 2)  '), 'papeleta de sitio 2026 (reemision 2)');
    assert.equal(claveConcepto('Año'), claveConcepto('ano'));
    assert.equal(claveConcepto('PAPELETA'), claveConcepto('papeleta'));
  });

  test('los espacios del principio sí cuentan, como en la base', () => {
    assert.notEqual(claveConcepto(' papeleta'), claveConcepto('papeleta'));
  });

  test('un «papeleta sábado de pasión 2026» en minúsculas ocupa el hueco de la primera emisión', () => {
    // Con un Set sensible a mayúsculas se proponía «Papeleta Sábado de Pasión 2026», que
    // chocaba con la clave única y la inscripción daba un 409 sin explicación.
    assert.equal(conceptoPapeleta(2026, ['papeleta sábado de pasión 2026']), 'Papeleta Sábado de Pasión 2026 (reemisión 2)');
    assert.equal(conceptoPapeleta(2026, ['Papeleta Sábado de Pasión 2026', 'PAPELETA SÁBADO DE PASIÓN 2026 (REEMISION 2) ']), 'Papeleta Sábado de Pasión 2026 (reemisión 3)');
  });
});
