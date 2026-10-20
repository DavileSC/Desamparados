// Reglas de las salidas sin base de datos: qué hace falta para recoger la
// ropa (o el puesto, en las salidas sin ropa), cómo se nombra el recibo de cada salida,
// la nota del perdón que ve el hermano y cuándo se ofrece el pago en línea.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EstadoPago } from '@prisma/client';
import {
  conceptoDeSalida, tipoReciboDe, esPerdonada, notaDePerdon, pagoEnLineaDisponible,
  pendienteDeLaSalida, puestoDeLaLista, requisitosParaRecoger, type CuotaDelHermano,
} from '../src/domain/salidas.js';

const cuota = (year: number, estado: EstadoPago, importe = 20): CuotaDelHermano => ({ id: year, year, concepto: `Cuota ${year}`, importe, estado });
const apuntado = { cobro: 'CUOTA' as const, salidaPendiente: 0 };
const CUOTA = { cobro: 'CUOTA' as const, importeCuota: 12.5 };
const DONATIVO = { cobro: 'DONATIVO' as const, importeCuota: 30 };

describe('qué hace falta para recoger', () => {
  test('en activo, apuntado, sin nada de la salida por pagar y sin cuotas pendientes, recoge', () => {
    const r = requisitosParaRecoger({ activo: true, solicitud: apuntado, cuotas: [] });
    assert.equal(r.puedeRecoger, true);
    assert.deepEqual(r.motivos, []);
    assert.equal(r.totalPendiente, 0);
  });

  test('una cuota sin pagar no deja recoger la túnica, y dice cuál', () => {
    const r = requisitosParaRecoger({ activo: true, solicitud: apuntado, cuotas: [cuota(2026, EstadoPago.PENDIENTE)] });
    assert.equal(r.puedeRecoger, false);
    assert.deepEqual(r.motivos, ['Tiene la cuota de 2026 sin pagar.']);
    assert.equal(r.totalPendiente, 20);
  });

  test('una devuelta por el banco cuenta como sin pagar; varias se nombran por año', () => {
    const r = requisitosParaRecoger({
      activo: true, solicitud: apuntado,
      cuotas: [cuota(2026, EstadoPago.PENDIENTE, 25), cuota(2025, EstadoPago.DEVUELTO, 20.5)],
    });
    assert.deepEqual(r.cuotasPendientes.map((c) => c.year), [2025, 2026]);
    assert.deepEqual(r.motivos, ['Tiene 2 cuotas sin pagar (2025, 2026).']);
    assert.equal(r.totalPendiente, 45.5);
  });

  test('una cuota en el banco (domiciliada) no bloquea, pero se ve', () => {
    const r = requisitosParaRecoger({ activo: true, solicitud: apuntado, cuotas: [cuota(2026, EstadoPago.REMESADO)] });
    assert.equal(r.puedeRecoger, true);
    assert.equal(r.cuotasEnElBanco.length, 1);
  });

  test('lo de la salida sin pagar bloquea y suma: la papeleta con cuota, el donativo con voluntad', () => {
    const pasion = requisitosParaRecoger({ activo: true, solicitud: { cobro: 'CUOTA', salidaPendiente: 5 }, cuotas: [] });
    assert.equal(pasion.salidaPagada, false);
    assert.deepEqual(pasion.motivos, ['Falta pagar la papeleta.']);
    assert.equal(pasion.totalPendiente, 5);
    const rosario = requisitosParaRecoger({ activo: true, solicitud: { cobro: 'DONATIVO', salidaPendiente: 3 }, cuotas: [] });
    assert.deepEqual(rosario.motivos, ['Falta el donativo.']);
  });

  test('quien no está en activo o no se ha apuntado no recoge', () => {
    assert.equal(requisitosParaRecoger({ activo: false, solicitud: apuntado, cuotas: [] }).puedeRecoger, false);
    assert.deepEqual(requisitosParaRecoger({ activo: true, solicitud: null, cuotas: [] }).motivos, ['Todavía no está apuntado.']);
  });

  test('suma en céntimos: 0,10 + 0,20 son 0,30', () => {
    const r = requisitosParaRecoger({ activo: true, solicitud: { cobro: 'CUOTA', salidaPendiente: 0.1 }, cuotas: [cuota(2026, EstadoPago.PENDIENTE, 0.2)] });
    assert.equal(r.totalPendiente, 0.3);
  });
});

describe('lo que queda de la salida', () => {
  test('con cuota, la de la salida (0 € si no se cobra); pagada o exenta, nada', () => {
    assert.equal(pendienteDeLaSalida({ donativo: null, recibo: null }, { cobro: 'CUOTA', importeCuota: 0 }), 0);
    assert.equal(pendienteDeLaSalida({ donativo: null, recibo: null }, CUOTA), 12.5);
    assert.equal(pendienteDeLaSalida({ donativo: null, recibo: { estado: EstadoPago.PAGADO } }, CUOTA), 0);
    assert.equal(pendienteDeLaSalida({ donativo: null, recibo: { estado: EstadoPago.EXENTO } }, CUOTA), 0);
  });

  test('con donativo, la voluntad que dijo y no la cuota; si el banco devolvió el pago, se debe otra vez', () => {
    assert.equal(pendienteDeLaSalida({ donativo: 5, recibo: null }, DONATIVO), 5);
    assert.equal(pendienteDeLaSalida({ donativo: null, recibo: null }, DONATIVO), 0);
    assert.equal(pendienteDeLaSalida({ donativo: 5, recibo: { estado: EstadoPago.DEVUELTO } }, DONATIVO), 5);
  });
});

describe('cada salida con su recibo', () => {
  test('el concepto lleva el nombre de la salida: «Papeleta …» con cuota, «Donativo …» con voluntad', () => {
    const pasion = { nombre: 'Sábado de Pasión', cobro: 'CUOTA' as const };
    const rosario = { nombre: 'Rosario vespertino', cobro: 'DONATIVO' as const };
    assert.equal(conceptoDeSalida(pasion, 2026, []), 'Papeleta Sábado de Pasión 2026');
    assert.equal(conceptoDeSalida(rosario, 2026, []), 'Donativo Rosario vespertino 2026');
    assert.equal(conceptoDeSalida(rosario, 2026, ['Papeleta Sábado de Pasión 2026']), 'Donativo Rosario vespertino 2026');
    assert.equal(conceptoDeSalida(rosario, 2026, ['donativo rosario vespertino 2026']), 'Donativo Rosario vespertino 2026 (reemisión 2)');
  });

  test('dos salidas con cuota el mismo año no chocan: ninguna sale como reemisión', () => {
    const pasion = { nombre: 'Sábado de Pasión', cobro: 'CUOTA' as const };
    const traslado = { nombre: 'Traslado', cobro: 'CUOTA' as const };
    const primero = conceptoDeSalida(pasion, 2027, []);
    const segundo = conceptoDeSalida(traslado, 2027, [primero]);
    assert.notEqual(primero, segundo);
    assert.equal(segundo, 'Papeleta Traslado 2027');
    assert.doesNotMatch(segundo, /reemisi/);
  });

  test('el recibo es una papeleta de sitio con cuota y un donativo con voluntad', () => {
    assert.equal(tipoReciboDe('CUOTA'), 'PAPELETA_SITIO');
    assert.equal(tipoReciboDe('DONATIVO'), 'DONATIVO');
  });
});

describe('el perdón de la cuota', () => {
  test('la nota dice que lo decidió el Hermano Mayor, cuándo y por qué', () => {
    const nota = notaDePerdon('Situación familiar', new Date('2026-09-25T10:00:00Z'));
    assert.equal(nota, 'Perdonada por decisión del Hermano Mayor el 25/09/2026. Motivo: Situación familiar');
    assert.equal(esPerdonada(nota), true);
    assert.equal(esPerdonada(`Nota de Tesorería · ${notaDePerdon(undefined)}`), true);
    assert.equal(esPerdonada('Anulado por devolución de la papeleta de sitio.'), false);
    assert.equal(esPerdonada(null), false);
  });
});

describe('el pago en línea: si se ofrece', () => {
  test('en producción, solo si se enciende a propósito', () => {
    assert.equal(pagoEnLineaDisponible({ NODE_ENV: 'production' }), false);
    assert.equal(pagoEnLineaDisponible({ NODE_ENV: 'production', PAGO_EN_LINEA: 'simulado' }), true);
    assert.equal(pagoEnLineaDisponible({ NODE_ENV: 'production', PAGO_EN_LINEA: 'redsys' }), true);
  });

  test('fuera de producción está encendido salvo que se apague', () => {
    assert.equal(pagoEnLineaDisponible({ NODE_ENV: 'development' }), true);
    assert.equal(pagoEnLineaDisponible({ NODE_ENV: 'test', PAGO_EN_LINEA: 'no' }), false);
  });
});

describe('el puesto, de la lista de la salida', () => {
  const puestos = [{ nombre: 'Nazareno de cirio', tunica: true, tocado: 'CAPIROTE', alturaHombro: false }, { nombre: 'Hombre de trono', tunica: true, tocado: null, alturaHombro: true }];

  test('se guarda como está escrito en la lista, sin mirar mayúsculas ni tildes', () => {
    assert.equal(puestoDeLaLista(puestos, ' nazareno de cirio '), 'Nazareno de cirio');
    assert.equal(puestoDeLaLista(puestos, 'HOMBRE DE TRONO'), 'Hombre de trono');
  });

  test('una errata no entra, pero el puesto que ya tenía se puede dejar como está', () => {
    assert.equal(puestoDeLaLista(puestos, 'Nazareno de ciriod'), null);
    assert.equal(puestoDeLaLista(puestos, 'Nazareno de ciriod', 'Nazareno de ciriod'), 'Nazareno de ciriod');
    assert.equal(puestoDeLaLista(null, 'Nazareno'), null);
  });
});
