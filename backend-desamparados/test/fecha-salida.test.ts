import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  anioDeLaSalida, fechaDeSalida, motivoRepartoFueraDeTemporada, pascua, proximaFecha,
} from '../src/domain/fecha-salida.js';

const PASION = { fecha: 'PASCUA', diasDesdePascua: -8 } as const;

describe('la Pascua y las salidas que dependen de ella', () => {
  test('Domingo de Resurrección', () => {
    assert.equal(pascua(2025), '2025-04-20');
    assert.equal(pascua(2026), '2026-04-05');
    assert.equal(pascua(2027), '2027-03-28');
    assert.equal(pascua(2030), '2030-04-21');
  });

  test('Pascua −8 es el Sábado de Pasión', () => {
    assert.equal(fechaDeSalida(PASION, 2025), '2025-04-12');
    assert.equal(fechaDeSalida(PASION, 2026), '2026-03-28');
    assert.equal(fechaDeSalida(PASION, 2027), '2027-03-20');
    assert.equal(fechaDeSalida(PASION, 2030), '2030-04-13');
  });
});

describe('la salida a mano', () => {
  const rosario = { fecha: 'MANUAL', acto: '2026-10-17' } as const;
  test('su fecha es la del acto, solo en su año', () => {
    assert.equal(fechaDeSalida(rosario, 2026), '2026-10-17');
    assert.equal(fechaDeSalida(rosario, 2027), null);
  });
  test('sin acto no tiene fecha', () => {
    assert.equal(fechaDeSalida({ fecha: 'MANUAL', acto: null }, 2026), null);
  });
});

describe('el año de la salida en curso', () => {
  test('hasta el mismo día de la salida, la de ese año', () => {
    assert.equal(anioDeLaSalida(PASION, '2026-01-10'), 2026);
    assert.equal(anioDeLaSalida(PASION, '2026-03-28'), 2026);
  });
  test('al día siguiente, la del año que viene', () => {
    assert.equal(anioDeLaSalida(PASION, '2026-03-29'), 2027);
    assert.equal(proximaFecha(PASION, '2026-10-01'), '2027-03-20');
  });
  test('a mano: la del acto si no ha pasado; si pasó, el año siguiente', () => {
    assert.equal(anioDeLaSalida({ fecha: 'MANUAL', acto: '2026-10-17' }, '2026-10-01'), 2026);
    assert.equal(anioDeLaSalida({ fecha: 'MANUAL', acto: '2026-10-17' }, '2026-10-18'), 2027);
    assert.equal(anioDeLaSalida({ fecha: 'MANUAL', acto: null }, '2026-05-01'), 2026);
  });
});

describe('los días de reparto, antes de su salida', () => {
  test('la víspera vale; el mismo día ya no', () => {
    assert.equal(motivoRepartoFueraDeTemporada('2027-03-19', PASION, '2026-10-01', 'Sábado de Pasión', 'el'), null);
    assert.match(
      motivoRepartoFueraDeTemporada('2027-03-20', PASION, '2026-10-01', 'Sábado de Pasión', 'el') ?? '',
      /Sábado de Pasión.*20 de marzo de 2027/,
    );
  });
  test('un reparto en otoño vale para la Pasión del año siguiente', () => {
    assert.equal(motivoRepartoFueraDeTemporada('2026-10-05', PASION, '2026-10-01', 'Sábado de Pasión', 'el'), null);
  });
  test('a mano sin fecha: hay que ponerla antes', () => {
    assert.match(
      motivoRepartoFueraDeTemporada('2026-10-05', { fecha: 'MANUAL', acto: null }, '2026-10-01', 'Rosario vespertino', 'el') ?? '',
      /Pon antes la fecha de la salida en la Agenda/,
    );
  });
  test('a mano: antes del acto vale; después, no', () => {
    const r = { fecha: 'MANUAL', acto: '2026-10-17' } as const;
    assert.equal(motivoRepartoFueraDeTemporada('2026-10-16', r, '2026-10-01', 'Rosario vespertino', 'el'), null);
    assert.match(motivoRepartoFueraDeTemporada('2026-10-18', r, '2026-10-01', 'Rosario vespertino', 'el') ?? '', /17 de octubre de 2026/);
  });
  test('a mano sin fecha, la frase empieza por la salida con su artículo y concuerda en número', () => {
    const sinFecha = { fecha: 'MANUAL', acto: null } as const;
    assert.match(motivoRepartoFueraDeTemporada('2026-10-05', sinFecha, '2026-10-01', 'Rosario vespertino', 'el') ?? '', /^El Rosario vespertino todavía no tiene fecha\./);
    assert.match(motivoRepartoFueraDeTemporada('2026-10-05', sinFecha, '2026-10-01', 'Procesión Magna', 'la') ?? '', /^La Procesión Magna todavía no tiene fecha\./);
    assert.match(motivoRepartoFueraDeTemporada('2026-10-05', sinFecha, '2026-10-01', 'Santos Oficios', 'los') ?? '', /^Los Santos Oficios todavía no tienen fecha\./);
  });
  test('con otro artículo, concuerda: «de la», no «del»', () => {
    assert.match(
      motivoRepartoFueraDeTemporada('2027-03-20', PASION, '2026-10-01', 'Procesión Magna', 'la') ?? '',
      /El reparto de la Procesión Magna tiene que ser/,
    );
  });
});
