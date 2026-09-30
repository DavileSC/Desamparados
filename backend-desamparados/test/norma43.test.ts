// Pruebas del lector de extractos Norma 43 y del casado con las remesas
// (domain/norma43.ts). Sin base de datos: fijan las posiciones de cada campo,
// que los totales se comprueben y qué movimiento se toma por devolución o por
// cobro de una remesa, y cuál se deja para que Tesorería lo mire a mano.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { casarMovimientos, leerNorma43, recibosNombrados, type MovimientoN43 } from '../src/domain/norma43.js';
import { extracto } from './fixtures/norma43.js';

describe('leer un extracto Norma 43', () => {
  test('saca la cuenta, el periodo, los saldos y cada movimiento con sus conceptos', () => {
    const { cuentas, errores } = leerNorma43(extracto([
      { fecha: '260905', signo: 2, centimos: 93600, ref2: 'REMESA-000007', conceptos: ['ABONO REMESA RECIBOS'] },
      { fecha: '260912', signo: 1, centimos: 3600, conceptos: ['DEVOLUCION RECIBO REC-41', 'MD01 SIN MANDATO'] },
    ]));
    assert.deepEqual(errores, []);
    assert.equal(cuentas.length, 1);
    const [c] = cuentas;
    assert.deepEqual([c.entidad, c.oficina, c.cuenta, c.desde, c.hasta, c.titular], ['2100', '0418', '4502000513', '2026-09-01', '2026-09-30', 'GRUPO PARROQUIAL']);
    assert.equal(c.saldoInicial, 100000);
    assert.equal(c.saldoFinal, 100000 + 93600 - 3600);
    assert.deepEqual(c.movimientos.map((m) => [m.fechaOperacion, m.signo, m.centimos]), [['2026-09-05', 'ABONO', 93600], ['2026-09-12', 'CARGO', 3600]]);
    assert.equal(c.movimientos[0].referencia2, 'REMESA-000007');
    assert.deepEqual(c.movimientos[1].conceptos, ['DEVOLUCION RECIBO REC-41', 'MD01 SIN MANDATO']);
  });

  test('acepta líneas recortadas por el final y el fin de línea de Unix', () => {
    const recortado = extracto([{ fecha: '260905', signo: 2, centimos: 500 }]).split('\r\n').map((l) => l.trimEnd()).join('\n');
    assert.deepEqual(leerNorma43(recortado).errores, []);
  });

  test('avisa si los totales no cuadran o falta el final', () => {
    assert.match(leerNorma43(extracto([{ fecha: '260905', signo: 1, centimos: 500 }], { trucarTotales: true })).errores.join(' '), /no cuadran/);
    const sinFin = extracto([{ fecha: '260905', signo: 1, centimos: 500 }]).split('\r\n').slice(0, -1).join('\r\n');
    assert.match(leerNorma43(sinFin).errores.join(' '), /fin de fichero/);
  });

  test('otro fichero cualquiera no pasa por un extracto', () => {
    assert.match(leerNorma43('nombre;apellidos\nJuan;Pérez').errores[0], /desconocido/);
    assert.match(leerNorma43('').errores[0], /ninguna cuenta/);
  });
});

describe('casar el extracto con las remesas', () => {
  const mov = (signo: 'CARGO' | 'ABONO', centimos: number, textos: string[] = [], fechaValor = '2026-10-05'): MovimientoN43 => ({
    linea: 1, fechaOperacion: fechaValor, fechaValor, conceptoComun: '03', conceptoPropio: '000', signo, centimos,
    documento: '', referencia1: '', referencia2: '', conceptos: textos,
  });
  const recibos = [
    { id: 41, hermanoId: 7, centimos: 3600, remesaId: 3 },
    { id: 42, hermanoId: 8, centimos: 3600, remesaId: 3 },
    { id: 43, hermanoId: 8, centimos: 1800, remesaId: 3 },
  ];
  const remesas = [
    { id: 3, mensajeId: 'REMESA-000003-20261002', fechaCobro: '2026-10-02', centimos: 9000 },
    { id: 4, mensajeId: 'REMESA-000004-20261016', fechaCobro: '2026-10-16', centimos: 5000 },
  ];

  test('la devolución se reconoce por el recibo que nombra y su importe', () => {
    assert.deepEqual(recibosNombrados(mov('CARGO', 1, ['DEVOL. rec-41 y REC-41'])), [41]);
    const c = casarMovimientos([mov('CARGO', 3600, ['DEVOLUCION REC-41 AM04'])], recibos, remesas);
    assert.deepEqual(c.devoluciones.map((d) => d.reciboId), [41]);
    assert.deepEqual(c.dudosos, []);
  });

  test('o por el mandato, si ese hermano solo tiene un recibo con ese importe', () => {
    const c = casarMovimientos([mov('CARGO', 1800, ['DEVOLUCION HERMANO-000008-20200315'])], recibos, remesas);
    assert.deepEqual(c.devoluciones.map((d) => d.reciboId), [43]);
  });

  test('lo que no cuadra se deja para mirarlo a mano, y lo ajeno ni se menciona', () => {
    const c = casarMovimientos([
      mov('CARGO', 999, ['DEVOLUCION REC-41']),
      mov('CARGO', 3600, ['REC-41 REC-42']),
      mov('CARGO', 4500, ['RECIBO LUZ ENDESA']),
    ], recibos, remesas);
    assert.deepEqual(c.devoluciones, []);
    assert.deepEqual(c.dudosos.map((d) => d.motivo), ['Nombra el recibo 41, pero el importe no coincide.', 'Nombra varios recibos a la vez.']);
  });

  test('el cobro de la remesa, por su nombre o por su total en los días siguientes', () => {
    assert.deepEqual(casarMovimientos([mov('ABONO', 1, ['ABONO REMESA-000004-20261016'])], recibos, remesas).cobros.map((c) => c.remesaId), [4]);
    assert.deepEqual(casarMovimientos([mov('ABONO', 9000, ['ABONO ADEUDOS'], '2026-10-03')], recibos, remesas).cobros.map((c) => c.remesaId), [3]);
    // Mismo importe, pero antes de la fecha de cobro o mucho después: no es ella.
    assert.deepEqual(casarMovimientos([mov('ABONO', 9000, [], '2026-10-01'), mov('ABONO', 9000, [], '2026-10-20')], recibos, remesas).cobros, []);
  });

  test('si el importe casa con dos remesas, no elige ninguna', () => {
    const iguales = [...remesas, { id: 5, mensajeId: 'REMESA-000005-20261002', fechaCobro: '2026-10-02', centimos: 9000 }];
    const c = casarMovimientos([mov('ABONO', 9000, [], '2026-10-03')], recibos, iguales);
    assert.deepEqual(c.cobros, []);
    assert.equal(c.dudosos.length, 1);
  });
});
