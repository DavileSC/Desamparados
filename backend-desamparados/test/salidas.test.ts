// Reglas de las salidas sin base de datos: qué hace falta para recoger la
// ropa (o el puesto, en el Rosario), cómo se nombra el recibo de cada salida,
// la nota del perdón que ve el hermano y cuándo se ofrece el pago en línea.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EstadoPago } from '@prisma/client';
import {
  DATOS_SALIDA, PUESTOS_POR_SALIDA, conceptoDeSalida, esPerdonada, notaDePerdon, pagoEnLineaDisponible,
  pendienteDeLaSalida, requisitosParaRecoger, type CuotaDelHermano,
} from '../src/domain/salidas.js';

const cuota = (year: number, estado: EstadoPago, importe = 20): CuotaDelHermano => ({ id: year, year, concepto: `Cuota ${year}`, importe, estado });
const apuntado = { salida: 'PASION' as const, salidaPendiente: 0 };

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

  test('lo de la salida sin pagar bloquea y suma: la papeleta en la Pasión, el donativo en el Rosario', () => {
    const pasion = requisitosParaRecoger({ activo: true, solicitud: { salida: 'PASION', salidaPendiente: 5 }, cuotas: [] });
    assert.equal(pasion.salidaPagada, false);
    assert.deepEqual(pasion.motivos, ['Falta pagar la papeleta.']);
    assert.equal(pasion.totalPendiente, 5);
    const rosario = requisitosParaRecoger({ activo: true, solicitud: { salida: 'ROSARIO', salidaPendiente: 3 }, cuotas: [] });
    assert.deepEqual(rosario.motivos, ['Falta el donativo.']);
  });

  test('quien no está en activo o no se ha apuntado no recoge', () => {
    assert.equal(requisitosParaRecoger({ activo: false, solicitud: apuntado, cuotas: [] }).puedeRecoger, false);
    assert.deepEqual(requisitosParaRecoger({ activo: true, solicitud: null, cuotas: [] }).motivos, ['Todavía no está apuntado.']);
  });

  test('suma en céntimos: 0,10 + 0,20 son 0,30', () => {
    const r = requisitosParaRecoger({ activo: true, solicitud: { salida: 'PASION', salidaPendiente: 0.1 }, cuotas: [cuota(2026, EstadoPago.PENDIENTE, 0.2)] });
    assert.equal(r.totalPendiente, 0.3);
  });
});

describe('lo que queda de la salida', () => {
  test('en la Pasión, la cuota de salida (hoy 0 €); pagada o exenta, nada', () => {
    assert.equal(pendienteDeLaSalida({ salida: 'PASION', donativo: null, recibo: null }, 0), 0);
    assert.equal(pendienteDeLaSalida({ salida: 'PASION', donativo: null, recibo: null }, 12.5), 12.5);
    assert.equal(pendienteDeLaSalida({ salida: 'PASION', donativo: null, recibo: { estado: EstadoPago.PAGADO } }, 12.5), 0);
    assert.equal(pendienteDeLaSalida({ salida: 'PASION', donativo: null, recibo: { estado: EstadoPago.EXENTO } }, 12.5), 0);
  });

  test('en el Rosario, la voluntad que dijo; si el banco devolvió el pago, se debe otra vez', () => {
    assert.equal(pendienteDeLaSalida({ salida: 'ROSARIO', donativo: 5, recibo: null }, 30), 5);
    assert.equal(pendienteDeLaSalida({ salida: 'ROSARIO', donativo: null, recibo: null }, 30), 0);
    assert.equal(pendienteDeLaSalida({ salida: 'ROSARIO', donativo: 5, recibo: { estado: EstadoPago.DEVUELTO } }, 30), 5);
  });
});

describe('cada salida con su recibo', () => {
  test('la Pasión lleva el concepto de siempre y el Rosario, el suyo', () => {
    assert.equal(conceptoDeSalida('PASION', 2026, []), 'Papeleta de sitio 2026');
    assert.equal(conceptoDeSalida('ROSARIO', 2026, []), 'Donativo Rosario vespertino 2026');
    assert.equal(conceptoDeSalida('ROSARIO', 2026, ['Papeleta de sitio 2026']), 'Donativo Rosario vespertino 2026');
    assert.equal(conceptoDeSalida('ROSARIO', 2026, ['donativo rosario vespertino 2026']), 'Donativo Rosario vespertino 2026 (reemisión 2)');
  });

  test('en el Rosario se va de traje (sin ropero) y el importe lo pone el hermano', () => {
    assert.equal(DATOS_SALIDA.ROSARIO.conRopa, false);
    assert.equal(DATOS_SALIDA.ROSARIO.importeLibre, true);
    assert.equal(DATOS_SALIDA.PASION.conRopa, true);
    assert.notEqual(DATOS_SALIDA.PASION.clavePlazo, DATOS_SALIDA.ROSARIO.clavePlazo);
  });

  test('el Rosario tiene su catálogo de puestos, sin túnica, y su trono se talla al hombro', () => {
    const rosario = PUESTOS_POR_SALIDA.ROSARIO;
    assert.ok(rosario.length > 0);
    assert.ok(rosario.every((p) => !p.tunica && p.tocado === null));
    assert.ok(rosario.some((p) => p.alturaHombro));
    assert.equal(new Set(rosario.map((p) => p.nombre)).size, rosario.length);
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
