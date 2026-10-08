// La partida doble contra MariaDB: la cuenta asignada a una categoría manda
// sobre la propuesta, el ejercicio cuadra (debe = haber), el diario se pagina
// y el Excel sale con sus tres hojas. Apunta en 2097, un año que nadie usa.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import ExcelJS from 'exceljs';
import { Role, TipoTransaccion } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { HttpError } from '../src/utils/error.handle.js';
import { PartidaDobleService } from '../src/services/partida-doble.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

test('el ejercicio cuadra, la cuenta asignada manda y el Excel lleva sus hojas', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  const sufijo = Date.now();
  const ingreso = await db.categoriaTransaccion.create({ data: { nombre: `Cuotas prueba ${sufijo}`, tipo: TipoTransaccion.INGRESO } });
  const gasto = await db.categoriaTransaccion.create({ data: { nombre: `Varios prueba ${sufijo}`, tipo: TipoTransaccion.GASTO } });
  try {
    await db.transaccion.createMany({
      data: [
        { tipo: 'INGRESO', categoriaId: ingreso.id, concepto: 'Cuota', importe: '30.00', fecha: new Date('2097-02-01T10:00:00Z'), metodoPago: 'EFECTIVO' },
        { tipo: 'INGRESO', categoriaId: ingreso.id, concepto: 'Cuota', importe: '30.00', fecha: new Date('2097-02-02T10:00:00Z'), metodoPago: 'DOMICILIACION' },
        { tipo: 'GASTO', categoriaId: gasto.id, concepto: 'Cera', importe: '12.50', fecha: new Date('2097-03-01T10:00:00Z'), metodoPago: 'TRANSFERENCIA' },
      ],
    });

    const plan = await PartidaDobleService.plan();
    const suya = plan.categorias.find((c) => c.id === gasto.id)!;
    assert.deepEqual([suya.cuenta, suya.propuesta], ['629', true]);

    await PartidaDobleService.asignarCuenta(gasto.id, '602', { userId: tesorero.id });
    await assert.rejects(PartidaDobleService.asignarCuenta(gasto.id, '999', { userId: tesorero.id }), (err: unknown) => err instanceof HttpError && /no está en el plan/.test(err.message));

    const e = await PartidaDobleService.ejercicio(2097);
    assert.equal(e.asientos, 3);
    assert.equal(e.sumas.reduce((s, x) => s + x.debe, 0), e.sumas.reduce((s, x) => s + x.haber, 0));
    assert.deepEqual(e.sumas.map((s) => s.cuenta), ['570', '572', '602', '720']);
    assert.equal(e.resultados.excedente, 47.5);

    const pagina = await PartidaDobleService.diario(2097, 2, 2);
    assert.deepEqual([pagina.total, pagina.asientos.length, pagina.asientos[0].numero], [3, 1, 3]);
    assert.deepEqual(pagina.asientos[0].lineas.map((l) => [l.cuenta, l.debe, l.haber]), [['602', 12.5, 0], ['572', 0, 12.5]]);

    const { contenido, nombre } = await PartidaDobleService.excel(2097, { userId: tesorero.id });
    assert.equal(nombre, 'contabilidad-2097.xlsx');
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(contenido as unknown as ArrayBuffer);
    assert.deepEqual(libro.worksheets.map((h) => h.name), ['Libro diario', 'Sumas y saldos', 'Cuenta de resultados']);
    assert.equal(libro.getWorksheet('Libro diario')!.rowCount, 1 + 6);

    // Sin sesión, fuera; con otro cargo, tampoco.
    assert.equal((await fetch(`${baseUrl}/api/transacciones/partida-doble/2097`)).status, 401);
    const secretario = await crearUsuarioPrueba(Role.SECRETARIA);
    try {
      assert.equal((await fetch(`${baseUrl}/api/transacciones/partida-doble/2097`, { headers: { Cookie: `${COOKIE_CMS}=${generateToken(secretario.id, Role.SECRETARIA)}` } })).status, 403);
    } finally { await borrarUsuarioPrueba(secretario.id); }
    assert.equal((await fetch(`${baseUrl}/api/transacciones/partida-doble/2097`, { headers: { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}` } })).status, 200);
  } finally {
    await db.transaccion.deleteMany({ where: { categoriaId: { in: [ingreso.id, gasto.id] } } });
    await db.categoriaTransaccion.deleteMany({ where: { id: { in: [ingreso.id, gasto.id] } } });
    await db.auditLog.deleteMany({ where: { userId: tesorero.id } });
    await borrarUsuarioPrueba(tesorero.id);
  }
});
