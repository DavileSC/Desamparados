// test/tesoreria-cobro-db.test.ts
//
// La ventana «Registrar cobro» de Tesorería: varios recibos de una vez, con la
// forma de pago, el día y una nota. Todo o nada: si uno ya no se puede cobrar,
// no se cobra ninguno y se dice cuál. Y lo que lee la entrada de Tesorería (el
// resumen del ejercicio) y la ficha de un recibo (su historial).

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { type } from 'arktype';
import { EstadoPago, MetodoPago, Role, TipoRecibo, TipoTransaccion } from '@prisma/client';
import db from '../src/config/db.js';
import { ReciboService } from '../src/services/recibo.service.js';
import { cobrarVariosSchema } from '../src/schemas/recibo.schema.js';
import { devueltosPendientes } from '../src/services/recibos/comunes.js';
import { diaMadrid } from '../src/domain/contabilidad.js';
import { diaDeHoy } from '../src/domain/fechas-hermano.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
const YEAR = Number(diaDeHoy().slice(0, 4));
const usuarios: number[] = [];
const hermanos: number[] = [];
const recibos: number[] = [];

before(async () => {
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  if (dbDisponible) {
    await db.transaccion.deleteMany({ where: { reciboId: { in: recibos } } });
    await db.auditLog.deleteMany({ where: { entityType: 'recibo', entityId: { in: recibos.map(String) } } });
    await db.recibo.deleteMany({ where: { id: { in: recibos } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    for (const id of usuarios) await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

async function hermanoConRecibos(importes: { concepto: string; importe: number; tipo?: TipoRecibo; estado?: EstadoPago }[]) {
  const usuario = await crearUsuarioPrueba(Role.USER);
  usuarios.push(usuario.id);
  const hermano = await db.hermano.create({
    data: { userId: usuario.id, nombre: 'Prueba', apellidos: `Cobro ${Date.now()}${hermanos.length}`, fechaNacimiento: new Date(Date.UTC(1990, 0, 1)), activo: true },
  });
  hermanos.push(hermano.id);
  const creados = [];
  for (const r of importes) {
    const recibo = await db.recibo.create({
      data: { hermanoId: hermano.id, year: YEAR, concepto: r.concepto, importe: r.importe, tipo: r.tipo ?? TipoRecibo.OTRO, estado: r.estado ?? EstadoPago.PENDIENTE },
    });
    recibos.push(recibo.id);
    creados.push(recibo);
  }
  return { hermano, recibos: creados };
}

describe('cobrar varios recibos de una vez', () => {
  test('el esquema pide entre 1 y 200 recibos y un cobro en mano', () => {
    const vale = (body: unknown) => !(cobrarVariosSchema({ body }) instanceof type.errors);
    assert.ok(vale({ ids: [1, 2], metodoPago: 'EFECTIVO' }));
    assert.ok(vale({ ids: [1], metodoPago: 'BIZUM', fecha: '2026-11-08', nota: 'En la mesa' }));
    assert.ok(!vale({ ids: [], metodoPago: 'EFECTIVO' }), 'sin recibos');
    assert.ok(!vale({ ids: Array.from({ length: 201 }, (_, i) => i + 1), metodoPago: 'EFECTIVO' }), 'más de 200');
    // Lo remesado lo cobra el banco: se confirma desde su remesa.
    assert.ok(!vale({ ids: [1], metodoPago: 'DOMICILIACION' }));
    assert.ok(!vale({ ids: [1], metodoPago: 'EFECTIVO', fecha: '2026-02-30' }));
    assert.ok(!vale({ ids: [1], metodoPago: 'EFECTIVO', nota: '<b>hola</b>' }));
  });

  test('todo o nada: con uno ya cobrado no se cobra ninguno, y se dice cuál', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { recibos: [cuota, donativo, cobrado] } = await hermanoConRecibos([
      { concepto: 'Cuota de prueba', importe: 36 },
      { concepto: 'Donativo de prueba', importe: 20 },
      { concepto: 'Ya cobrado de prueba', importe: 10, estado: EstadoPago.PAGADO },
    ]);

    await assert.rejects(
      ReciboService.cobrarVarios({ ids: [cuota.id, donativo.id, cobrado.id], metodoPago: MetodoPago.EFECTIVO }),
      (e: Error) => e.message.includes('Ya cobrado de prueba') && e.message.includes('No se ha cobrado ninguno'),
    );
    const siguen = await db.recibo.findMany({ where: { id: { in: [cuota.id, donativo.id] } }, select: { estado: true } });
    assert.deepEqual(siguen.map((r) => r.estado), [EstadoPago.PENDIENTE, EstadoPago.PENDIENTE]);
    assert.equal(await db.transaccion.count({ where: { reciboId: { in: [cuota.id, donativo.id] } } }), 0, 'ni un apunte suelto');

    // Un día de mañana no es un cobro: el dinero aún no ha entrado.
    const manana = diaMadrid(new Date(Date.now() + 36 * 3600_000));
    await assert.rejects(ReciboService.cobrarVarios({ ids: [cuota.id], metodoPago: MetodoPago.EFECTIVO, fecha: manana }), /posterior a hoy/);
  });

  test('cobra cada uno con su apunte al día del cobro, guarda la nota y la ficha la cuenta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { recibos: [cuota, donativo, pendiente] } = await hermanoConRecibos([
      { concepto: 'Cuota de prueba', importe: 36, tipo: TipoRecibo.CUOTA_HERMANO },
      { concepto: 'Donativo de prueba', importe: 20, tipo: TipoRecibo.DONATIVO },
      { concepto: 'Otro de prueba', importe: 12.5 },
    ]);
    const ayer = diaMadrid(new Date(Date.now() - 24 * 3600_000));

    const r = await ReciboService.cobrarVarios({ ids: [cuota.id, donativo.id, cuota.id], metodoPago: MetodoPago.BIZUM, fecha: ayer, nota: '  En la mesa de reparto  ' });
    assert.deepEqual(r, { cobrados: 2, total: 56 }, 'un id repetido se cobra una vez');

    const cobrados = await db.recibo.findMany({ where: { id: { in: [cuota.id, donativo.id] } }, orderBy: { id: 'asc' } });
    for (const c of cobrados) {
      assert.equal(c.estado, EstadoPago.PAGADO);
      assert.equal(c.metodoPago, MetodoPago.BIZUM);
      assert.equal(diaMadrid(c.fechaPago!), ayer, 'al día que se dijo, no al del clic');
      assert.equal(c.observaciones, 'Al cobrar: En la mesa de reparto');
    }
    const apuntes = await db.transaccion.findMany({ where: { reciboId: { in: [cuota.id, donativo.id] } } });
    assert.equal(apuntes.length, 2);
    assert.ok(apuntes.every((a) => a.tipo === TipoTransaccion.INGRESO && diaMadrid(a.fecha) === ayer));

    const { historial } = await ReciboService.historial(cuota.id);
    const cobro = historial.find((h) => h.accion === 'RECIBO_COBRAR');
    assert.ok(cobro, 'el cobro queda en su historial');
    assert.equal(cobro.estado, EstadoPago.PAGADO);
    assert.equal(cobro.nota, 'En la mesa de reparto');

    // La entrada de Tesorería ve lo que queda por cobrar de ese hermano.
    const panel = await ReciboService.panel(YEAR);
    assert.equal(panel.year, YEAR);
    assert.ok(panel.tareas.porCobrar.recibos >= 1);
    assert.ok(panel.antiguedad.some((a) => a.year === YEAR && a.total >= 12.5));
    assert.ok(panel.porMetodo.some((m) => m.metodo === MetodoPago.BIZUM && m.cuenta >= 2));
    assert.ok(panel.emitido.total >= panel.estados.PAGADO.total);
    assert.equal(pendiente.estado, EstadoPago.PENDIENTE);
  });

  test('una papeleta devuelta se da por perdida: deja de pedirse y no se puede repetir', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { hermano, recibos: [papeleta, cuota] } = await hermanoConRecibos([
      { concepto: 'Papeleta de prueba', importe: 30, tipo: TipoRecibo.PAPELETA_SITIO, estado: EstadoPago.DEVUELTO },
      { concepto: 'Cuota devuelta de prueba', importe: 36, tipo: TipoRecibo.CUOTA_HERMANO, estado: EstadoPago.DEVUELTO },
    ]);
    const antes = await devueltosPendientes({ hermanoId: hermano.id });
    assert.equal(antes.total, 2);
    const resumenAntes = await ReciboService.getResumenAdmin({ hermano: String(hermano.id) });
    assert.deepEqual(resumenAntes.devueltosPorResolver, { cuenta: 2, total: 66 });

    // Una cuota no: se perdona, o se reemite.
    await assert.rejects(ReciboService.darPorPerdida(cuota.id, undefined), /Solo se da por perdida una papeleta/);

    const r = await ReciboService.darPorPerdida(papeleta.id, 'Se dio de baja');
    recibos.push(r.reemisionId);
    const reemision = await db.recibo.findUniqueOrThrow({ where: { id: r.reemisionId } });
    assert.equal(reemision.estado, EstadoPago.EXENTO);
    assert.equal(reemision.reemisionDeId, papeleta.id);
    assert.match(reemision.observaciones ?? '', /Perdonada por decisión del Hermano Mayor el .*Motivo: Se dio de baja/);
    assert.equal(await db.transaccion.count({ where: { reciboId: { in: [papeleta.id, r.reemisionId] } } }), 0, 'ni un apunte: el ingreso ya se anuló al devolverse');

    assert.equal((await devueltosPendientes({ hermanoId: hermano.id })).total, 1, 'solo queda la cuota');
    await assert.rejects(ReciboService.darPorPerdida(papeleta.id, undefined));
  });
});
