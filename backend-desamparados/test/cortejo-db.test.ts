// El cortejo contra MariaDB: los tramos se guardan en la configuración, la
// vista previa dice cuántas papeletas cambiarían, aplicar escribe tramo y lugar
// solo en los puestos que se reparten, y repetirlo no cambia nada. Siembra sus
// papeletas en un año que nadie usa (2098) y deja la configuración como estaba.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Prisma, Role, TipoRecibo } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { HttpError } from '../src/utils/error.handle.js';
import { CortejoService } from '../src/services/procesion/cortejo.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { idDeSalida, PASION, salida } from './fixtures/salidas.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const YEAR = 2098;
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

async function escenario() {
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const usuario = await crearUsuarioPrueba(Role.USER);
  // El cortejo vive en la fila de la salida: se guarda y se devuelve al terminar.
  const previa = (await salida(PASION)).cortejo;
  const hermanos: number[] = [];

  /** Un hermano con su papeleta de la Pasión de 2098. */
  const conPapeleta = async (fechaAlta: string, puesto = 'Nazareno') => {
    const h = await db.hermano.create({
      data: { userId: usuario.id, nombre: 'Prueba', apellidos: `Cortejo ${Date.now()}${hermanos.length}`, fechaNacimiento: new Date('1990-01-01T00:00:00Z'), fechaAlta: new Date(`${fechaAlta}T10:00:00Z`) },
    });
    hermanos.push(h.id);
    const recibo = await db.recibo.create({ data: { hermanoId: h.id, year: YEAR, concepto: `Papeleta ${YEAR}`, importe: '0', tipo: TipoRecibo.PAPELETA_SITIO } });
    return db.papeletaSitio.create({ data: { hermanoId: h.id, year: YEAR, salidaId: await idDeSalida(PASION), puesto, reciboId: recibo.id } });
  };

  const recoger = async () => {
    await db.papeletaSitio.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.recibo.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    await db.salida.update({ where: { slug: PASION }, data: { cortejo: previa ?? Prisma.DbNull } });
    await db.auditLog.deleteMany({ where: { userId: staff.id } });
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(staff.id);
  };
  return { staff, meta: { userId: staff.id }, conPapeleta, recoger };
}

test('repartir: los más nuevos delante, solo los puestos que se reparten, y la segunda vez no cambia nada', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    await CortejoService.guardarConfiguracion(await salida(PASION), {
      tramos: [{ nombre: ' Cruz de guía ', plazas: 2 }, { nombre: 'Tramo del trono', plazas: 2 }],
      puestos: ['nazareno', 'Nazareno '],
    }, e.meta);

    const antiguo = await e.conPapeleta('1980-01-01');
    const nuevo = await e.conPapeleta('2024-01-01');
    const medio = await e.conPapeleta('2000-01-01');
    const medio2 = await e.conPapeleta('2010-01-01');
    const trono = await e.conPapeleta('1990-01-01', 'Trono');

    const estado = await CortejoService.estado(await salida(PASION), YEAR);
    assert.deepEqual(estado.config, { tramos: [{ nombre: 'Cruz de guía', plazas: 2 }, { nombre: 'Tramo del trono', plazas: 2 }], puestos: ['nazareno'] });
    assert.equal(estado.papeletas, 5);
    assert.deepEqual(estado.reparto.tramos.map((x) => x.asignados), [2, 2]);
    assert.equal(estado.reparto.fuera, 1);
    assert.equal(estado.reparto.cambios, 4);

    const r = await CortejoService.aplicar(await salida(PASION), YEAR, e.meta);
    assert.equal(r.cambiadas, 4);
    const lugar = async (id: number) => {
      const p = await db.papeletaSitio.findUniqueOrThrow({ where: { id } });
      return [p.tramo, p.numero];
    };
    assert.deepEqual(await lugar(nuevo.id), ['Cruz de guía', 1]);
    assert.deepEqual(await lugar(medio2.id), ['Cruz de guía', 2]);
    assert.deepEqual(await lugar(medio.id), ['Tramo del trono', 1]);
    assert.deepEqual(await lugar(antiguo.id), ['Tramo del trono', 2]);
    assert.deepEqual(await lugar(trono.id), [null, null]);

    const despues = await CortejoService.estado(await salida(PASION), YEAR);
    assert.equal(despues.reparto.cambios, 0);
    assert.deepEqual(despues.actual.map((g) => [g.tramo, g.hermanos.length]), [['Cruz de guía', 2], ['Tramo del trono', 2], [null, 1]]);
    assert.equal((await CortejoService.aplicar(await salida(PASION), YEAR, e.meta)).cambiadas, 0);
  } finally {
    await e.recoger();
  }
});

test('una configuración que no vale no se guarda, y sin papeletas que repartir no se aplica', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    await assert.rejects(
      CortejoService.guardarConfiguracion(await salida(PASION), { tramos: [{ nombre: 'Uno', plazas: 3 }, { nombre: 'UNO', plazas: 3 }], puestos: ['Nazareno'] }, e.meta),
      (err: unknown) => err instanceof HttpError && /mismo nombre/.test(err.message),
    );
    await assert.rejects(CortejoService.aplicar(await salida(PASION), YEAR, e.meta), (err: unknown) => err instanceof HttpError && err.status === 409);
  } finally {
    await e.recoger();
  }
});

test('el cortejo lo ve la Junta y solo lo cambian Secretaría y la administración', async (t) => {
  assert.equal((await fetch(`${baseUrl}/api/procesion/admin/cortejo`)).status, 401);
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    const como = (id: number, rol: Role) => ({ Cookie: `${COOKIE_CMS}=${generateToken(id, rol)}`, 'Content-Type': 'application/json' });
    assert.equal((await fetch(`${baseUrl}/api/procesion/admin/cortejo?salida=${PASION}&year=${YEAR}`, { headers: como(tesorero.id, Role.TESORERIA) })).status, 200);
    const cuerpo = JSON.stringify({ salida: PASION, year: YEAR });
    assert.equal((await fetch(`${baseUrl}/api/procesion/admin/cortejo/aplicar`, { method: 'POST', headers: como(tesorero.id, Role.TESORERIA), body: cuerpo })).status, 403);
    const mal = await fetch(`${baseUrl}/api/procesion/admin/cortejo/configuracion`, {
      method: 'PUT', headers: como(e.staff.id, Role.SECRETARIA), body: JSON.stringify({ salida: PASION, tramos: [{ nombre: 'Uno', plazas: 0 }], puestos: ['Nazareno'] }),
    });
    assert.equal(mal.status, 400);
  } finally {
    await borrarUsuarioPrueba(tesorero.id);
    await e.recoger();
  }
});
