// La ficha con medalla y tratamiento, los filtros del censo que hacen útil una
// lista y las listas guardadas (octubre de 2026).

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { filtrosAvanzados } from '../src/domain/filtros-censo.js';
import { consultaLimpia } from '../src/services/listas.service.js';
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

describe('los filtros del censo', () => {
  const hoy = new Date(Date.UTC(2026, 9, 1));

  test('menor es quien nació hace menos de 18 años, contados a hoy', () => {
    assert.deepEqual(filtrosAvanzados({ edad: 'menores' }, hoy), [{ fechaNacimiento: { gt: new Date(Date.UTC(2008, 9, 1)) } }]);
    assert.deepEqual(filtrosAvanzados({ edad: 'adultos' }, hoy), [{ fechaNacimiento: { lte: new Date(Date.UTC(2008, 9, 1)) } }]);
  });

  test('sin correo es la ficha sin correo que no es titular: el titular tiene el de su cuenta', () => {
    const [ficha, titular] = filtrosAvanzados({ correo: 'sin' }, hoy);
    assert.deepEqual(ficha, { OR: [{ email: null }, { email: '' }] });
    assert.deepEqual(titular, { esTitular: false });
  });

  test('sin filtros, ninguna condición', () => {
    assert.deepEqual(filtrosAvanzados({}, hoy), []);
  });
});

describe('las listas guardadas', () => {
  test('solo guardan los filtros del listado, en su orden', () => {
    assert.equal(consultaLimpia('censo', 'ficha=12&edad=menores&pagina=3&estado=activo&inventado=1'), 'estado=activo&edad=menores');
    assert.equal(consultaLimpia('censo', ''), '');
  });
});

test('por HTTP: medalla y tratamiento en la ficha, filtros en el buscador y listas guardadas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
  const hermano = await crearUsuarioPrueba(Role.USER);
  const albacea = await crearUsuarioPrueba(Role.ALBACERIA);
  const marca = `Listas${Date.now().toString(36)}`;
  const nino = await db.hermano.create({
    data: { userId: hermano.id, nombre: 'Pablo', apellidos: `${marca} Ruiz`, fechaNacimiento: new Date(Date.UTC(2016, 2, 3)), activo: true, esTitular: false, parentesco: 'HIJO' },
  });
  const adulto = await db.hermano.create({
    data: { userId: hermano.id, nombre: 'Luis', apellidos: `${marca} Ruiz`, fechaNacimiento: new Date(Date.UTC(1975, 2, 3)), activo: true, esTitular: true, iban: 'ES9121000418450200051332' },
  });
  const como = (userId: number, rol: Role, ruta: string, init: { method?: string; json?: unknown } = {}) => fetch(`${baseUrl}/api/hermanos${ruta}`, {
    method: init.method ?? 'GET',
    headers: { Cookie: `${COOKIE_CMS}=${generateToken(userId, rol)}`, ...(init.json !== undefined && { 'Content-Type': 'application/json' }) },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  const nombre = `ZZ ${marca}`;
  try {
    // La medalla y el tratamiento los pone Secretaría.
    const cambio = await como(secretaria.id, Role.SECRETARIA, `/admin/${adulto.id}`, { method: 'PUT', json: { fechaMedalla: '2020-12-08', tratamiento: 'Excmo. Sr. D.' } });
    assert.equal(cambio.status, 200);
    const ficha = await db.hermano.findUniqueOrThrow({ where: { id: adulto.id } });
    assert.equal(ficha.tratamiento, 'Excmo. Sr. D.');
    assert.ok(ficha.fechaMedalla, 'queda la fecha de la medalla');
    assert.equal((await como(secretaria.id, Role.SECRETARIA, `/admin/${adulto.id}`, { method: 'PUT', json: { tratamiento: 'x'.repeat(41) } })).status, 400);

    // Los filtros nuevos.
    const ids = async (consulta: string) => {
      const r = await como(secretaria.id, Role.SECRETARIA, `/admin/search?q=${encodeURIComponent(marca)}&${consulta}`);
      assert.equal(r.status, 200, consulta);
      return ((await r.json()) as { data: { id: number }[] }).data.map((h) => h.id).sort();
    };
    assert.deepEqual(await ids('edad=menores'), [nino.id]);
    assert.deepEqual(await ids('edad=adultos'), [adulto.id]);
    assert.deepEqual(await ids('correo=sin'), [nino.id], 'el niño no tiene correo; el titular, el de su cuenta');
    assert.deepEqual(await ids('cuenta=con'), [adulto.id]);
    assert.deepEqual(await ids('medalla=con'), [adulto.id]);
    assert.deepEqual(await ids('medalla=sin&edad=menores'), [nino.id]);
    assert.equal((await como(secretaria.id, Role.SECRETARIA, '/admin/search?edad=bebes')).status, 400);

    // Las listas: se guardan, se sustituyen con el mismo nombre y se borran.
    assert.equal((await como(albacea.id, Role.ALBACERIA, '/admin/listas')).status, 403, 'solo quien gestiona el censo');
    const guardada = await como(secretaria.id, Role.SECRETARIA, '/admin/listas', { method: 'POST', json: { nombre, consulta: 'edad=menores&ficha=3' } });
    assert.equal(guardada.status, 200);
    const lista = await guardada.json() as { id: number; consulta: string };
    assert.equal(lista.consulta, 'edad=menores', 'sin la ficha abierta');
    await como(secretaria.id, Role.SECRETARIA, '/admin/listas', { method: 'POST', json: { nombre, consulta: 'edad=menores&correo=sin' } });
    const todas = await (await como(secretaria.id, Role.SECRETARIA, '/admin/listas')).json() as { id: number; nombre: string; consulta: string }[];
    assert.deepEqual(todas.filter((l) => l.nombre === nombre).map((l) => l.consulta), ['correo=sin&edad=menores'], 'una sola, con lo último');
    assert.equal((await como(secretaria.id, Role.SECRETARIA, `/admin/listas/${lista.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await como(secretaria.id, Role.SECRETARIA, `/admin/listas/${lista.id}`, { method: 'DELETE' })).status, 404);
  } finally {
    await db.listaGuardada.deleteMany({ where: { nombre } });
    await db.auditLog.deleteMany({ where: { userId: secretaria.id } });
    await db.hermano.deleteMany({ where: { id: { in: [nino.id, adulto.id] } } });
    for (const u of [secretaria, hermano, albacea]) await borrarUsuarioPrueba(u.id);
  }
});
