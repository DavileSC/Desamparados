// test/bajas-impagos.test.ts
//
// El motivo de la baja (voluntaria, impago, fallecimiento, otro) y la lista de
// quién debe cuotas, desde la que Secretaría da las bajas por impago.

import assert from 'node:assert/strict';
import { after, before, describe, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoPago, Role, TipoRecibo } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { agruparImpagos } from '../src/domain/impagos.js';
import { diaDeHoy } from '../src/domain/fechas-hermano.js';
import { ReciboService } from '../src/services/recibo.service.js';
import { CensoService } from '../src/services/censo.service.js';
import { EmailService } from '../src/services/email.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const ANIO = Number(diaDeHoy().slice(0, 4));

describe('agrupar los impagos por hermano', () => {
  const ana = { id: 1, nombre: 'Ana', apellidos: 'Ruiz', numeroHermano: 10 };
  const blas = { id: 2, nombre: 'Blas', apellidos: 'Alba', numeroHermano: null };
  const recibo = (id: number, hermano: typeof ana | typeof blas, year: number, importe: number, estado = 'PENDIENTE') =>
    ({ id, year, estado, importe, hermano });

  test('suma lo que debe cada uno y ordena por quién debe más cuotas', () => {
    const filas = agruparImpagos([
      recibo(1, blas, 2024, 30),
      recibo(2, ana, 2025, 30.1),
      recibo(3, ana, 2023, 30.2, 'DEVUELTO'),
    ]);
    assert.deepEqual(filas.map((f) => f.hermano.id), [1, 2]);
    assert.equal(filas[0].total, 60.3, 'sin errores de coma flotante');
    assert.deepEqual(filas[0].cuotas.map((c) => c.year), [2023, 2025], 'las cuotas, de la más antigua a la más nueva');
  });

  test('con el mismo número de cuotas, por apellidos', () => {
    const filas = agruparImpagos([recibo(1, ana, 2024, 30), recibo(2, blas, 2024, 30)]);
    assert.deepEqual(filas.map((f) => f.hermano.apellidos), ['Alba', 'Ruiz']);
  });

  test('«mínimo» deja fuera a quien debe menos cuotas', () => {
    const filas = agruparImpagos([recibo(1, ana, 2023, 30), recibo(2, ana, 2024, 30), recibo(3, blas, 2024, 30)], 2);
    assert.deepEqual(filas.map((f) => f.hermano.id), [1]);
  });
});

describe('bajas con motivo e impagos, contra la base de datos', () => {
  let dbDisponible = false;
  let server: Server;
  let baseUrl: string;
  const usuarios: number[] = [];
  const hermanos: number[] = [];
  let secretaria: { id: number };

  before(async () => {
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    if (dbDisponible) {
      secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
      usuarios.push(secretaria.id);
    }
  });

  after(async () => {
    mock.restoreAll();
    if (dbDisponible) {
      await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: usuarios } }, { entityType: 'hermano', entityId: { in: hermanos.map(String) } }] } });
      await db.recibo.deleteMany({ where: { hermanoId: { in: hermanos } } });
      await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
      for (const id of usuarios) await borrarUsuarioPrueba(id);
    }
    server.close();
    await db.$disconnect();
  });

  /** Un hermano activo, con alta en 2020 para poder darle de baja con fecha pasada. */
  async function hermanoActivo(apellidos: string) {
    const usuario = await crearUsuarioPrueba(Role.USER);
    usuarios.push(usuario.id);
    const ficha = await db.hermano.create({
      data: {
        userId: usuario.id, nombre: 'Prueba', apellidos, fechaNacimiento: new Date('1980-01-01'),
        fechaAlta: new Date('2020-03-15'), activo: true, esTitular: true, email: 'impago@ejemplo.test',
      },
    });
    hermanos.push(ficha.id);
    return ficha;
  }

  /** La lista entera, página a página: la base de pruebas puede traer muchos más. */
  async function listaEntera(query: { incluirAnioActual?: string } = {}) {
    const filas = [];
    for (let page = 1; ; page++) {
      const { data, meta } = await ReciboService.impagos({ ...query, page: String(page), limit: '100' });
      filas.push(...data);
      if (page >= meta.totalPages) return filas;
    }
  }

  const cuota = (hermanoId: number, year: number, estado: EstadoPago) =>
    db.recibo.create({ data: { hermanoId, year, concepto: `Cuota ${year}`, importe: 30, tipo: TipoRecibo.CUOTA_HERMANO, estado } });

  test('la lista trae las cuotas pendientes y devueltas de años pasados, y la de este año solo si se pide', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const moroso = await hermanoActivo('Impagos Moroso');
    await cuota(moroso.id, ANIO - 2, EstadoPago.DEVUELTO);
    await cuota(moroso.id, ANIO - 1, EstadoPago.PENDIENTE);
    await cuota(moroso.id, ANIO, EstadoPago.PENDIENTE);
    const alDia = await hermanoActivo('Impagos AlDia');
    await cuota(alDia.id, ANIO - 1, EstadoPago.PAGADO);
    await cuota(alDia.id, ANIO, EstadoPago.PENDIENTE);

    const deEsteAnio = await listaEntera();
    const suya = deEsteAnio.find((f) => f.hermano.id === moroso.id);
    assert.deepEqual(suya?.cuotas.map((c) => c.year), [ANIO - 2, ANIO - 1]);
    assert.equal(suya?.total, 60);
    assert.ok(!deEsteAnio.some((f) => f.hermano.id === alDia.id), 'la cuota de este año pendiente no es un impago');

    const conEsteAnio = await listaEntera({ incluirAnioActual: 'true' });
    assert.equal(conEsteAnio.find((f) => f.hermano.id === moroso.id)?.cuotas.length, 3);
    assert.ok(conEsteAnio.some((f) => f.hermano.id === alDia.id));
  });

  test('Secretaría consulta la lista aunque no entre en Tesorería; un hermano raso no', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const pedir = (id: number, rol: Role) =>
      fetch(`${baseUrl}/api/recibos/admin/impagos`, { headers: { Cookie: `${COOKIE_CMS}=${generateToken(id, rol)}` } });
    assert.equal((await pedir(secretaria.id, Role.SECRETARIA)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/recibos/admin`, { headers: { Cookie: `${COOKIE_CMS}=${generateToken(secretaria.id, Role.SECRETARIA)}` } })).status, 403,
      'el resto de Tesorería sigue cerrado para Secretaría');
    const raso = await crearUsuarioPrueba(Role.USER);
    usuarios.push(raso.id);
    assert.equal((await pedir(raso.id, Role.USER)).status, 403);
  });

  test('la baja por impago guarda el motivo, sale de la lista y lo dice en el correo; al reactivar se limpia', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const correo = mock.method(EmailService, 'enviarBajaORechazo', async () => undefined);
    const ficha = await hermanoActivo('Impagos Baja');
    await cuota(ficha.id, ANIO - 1, EstadoPago.PENDIENTE);

    const res = await fetch(`${baseUrl}/api/hermanos/admin/${ficha.id}/baja`, {
      method: 'DELETE',
      headers: { Cookie: `${COOKIE_CMS}=${generateToken(secretaria.id, Role.SECRETARIA)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: 'IMPAGO' }),
    });
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: ficha.id } })).motivoBaja, 'IMPAGO');
    assert.deepEqual(correo.mock.calls.at(-1)?.arguments.slice(2), ['baja', true], 'el correo dice que es por impago');
    const lista = await listaEntera();
    assert.ok(!lista.some((f) => f.hermano.id === ficha.id), 'quien está de baja ya no sale');

    await CensoService.reactivarHermano(ficha.id, { userId: secretaria.id });
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: ficha.id } })).motivoBaja, null);
  });

  test('tras un fallecimiento no se manda el correo de baja', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const correo = mock.method(EmailService, 'enviarBajaORechazo', async () => undefined);
    const ficha = await hermanoActivo('Impagos Fallecido');
    await CensoService.darDeBajaHermano(ficha.id, { userId: secretaria.id }, undefined, 'FALLECIMIENTO');
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: ficha.id } })).motivoBaja, 'FALLECIMIENTO');
    assert.equal(correo.mock.callCount(), 0);
  });
});
