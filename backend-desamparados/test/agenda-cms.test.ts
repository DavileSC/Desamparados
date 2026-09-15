// test/agenda-cms.test.ts
//
// D9: el CMS lista también los eventos pasados. Antes usaba la lectura pública,
//     que solo enseña desde hoy: un evento fechado por error en el pasado
//     desaparecía del CMS y ya no se podía corregir ni borrar.
// P6: sin sesión, un evento solo para hermanos responde 404 como uno que no
//     existe; antes un 400 «No tienes permisos» confirmaba que existía.

import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let server: Server;
let baseUrl: string;
let dbDisponible = false;
const usuarios: Partial<Record<Role, number>> = {};
const eventos: Record<'ayer' | 'anteayer' | 'hoy', number> = { ayer: 0, anteayer: 0, hoy: 0 };
const marca = `Prueba agenda ${Date.now()}`;

async function sondearDb(): Promise<boolean> {
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const);
  return (await Promise.race([consulta, timeout])) === 'ok';
}

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  dbDisponible = await sondearDb();
  if (!dbDisponible) return;
  for (const rol of [Role.USER, Role.SECRETARIA]) usuarios[rol] = (await crearUsuarioPrueba(rol)).id;

  // Pegados a la medianoche de hoy, que es donde el servidor corta entre pasados
  // y próximos: así caen en la primera página de cada pestaña aunque la base de
  // desarrollo tenga más eventos.
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const minutos = (n: number) => new Date(hoy.getTime() + n * 60_000);
  eventos.ayer = (await db.evento.create({ data: { title: `${marca} ayer`, startDate: minutos(-1), visibility: 'members_only' } })).id;
  eventos.anteayer = (await db.evento.create({ data: { title: `${marca} antes`, startDate: minutos(-2), visibility: 'public' } })).id;
  eventos.hoy = (await db.evento.create({ data: { title: `${marca} hoy`, startDate: hoy, visibility: 'members_only' } })).id;
});

after(async () => {
  server.close();
  await db.evento.deleteMany({ where: { id: { in: Object.values(eventos) } } });
  for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
  await db.$disconnect();
});

const como = (rol: Role | null, ruta: string) =>
  fetch(`${baseUrl}/api/events${ruta}`, {
    headers: rol ? { Cookie: `${COOKIE_CMS}=${generateToken(usuarios[rol]!, rol)}` } : {},
  });

type Pagina = { data: { id: number; title: string }[]; meta: { total: number } };

describe('agenda del CMS con eventos pasados (D9)', () => {
  test('sin sesión responde 401 y un hermano raso 403', async (t) => {
    assert.equal((await como(null, '/admin')).status, 401);
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await como(Role.USER, '/admin')).status, 403);
  });

  test('«Pasados» trae los anteriores a hoy, del más reciente hacia atrás, de las dos visibilidades', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como(Role.SECRETARIA, '/admin?periodo=pasados&limit=10');
    assert.equal(res.status, 200);
    const { data } = await res.json() as Pagina;
    const ids = data.map((e) => e.id);
    assert.deepEqual(ids.slice(0, 2), [eventos.ayer, eventos.anteayer], 'los dos de prueba son los pasados más recientes');
    assert.ok(!ids.includes(eventos.hoy));
  });

  test('«Próximos» (y sin periodo) trae desde hoy en orden ascendente', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    for (const ruta of ['/admin?periodo=proximos&limit=10', '/admin?limit=10']) {
      const { data } = await (await como(Role.SECRETARIA, ruta)).json() as Pagina;
      const ids = data.map((e) => e.id);
      assert.ok(ids.includes(eventos.hoy), `${ruta} debería incluir el de hoy`);
      assert.ok(!ids.includes(eventos.ayer) && !ids.includes(eventos.anteayer), `${ruta} no debería incluir los pasados`);
    }
  });

  test('un periodo que no existe se rechaza', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await como(Role.SECRETARIA, '/admin?periodo=siempre')).status, 400);
  });

  test('la lectura pública sigue sin enseñar los pasados', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { data } = await (await como(null, '?limit=50')).json() as Pagina;
    assert.ok(!data.some((e) => e.id === eventos.anteayer));
  });
});

describe('evento solo para hermanos sin sesión (P6)', () => {
  test('responde 404, igual que uno que no existe', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como(null, `/${eventos.ayer}`);
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as { error: string }).error, 'Evento no encontrado');
  });

  test('con sesión de hermano se ve, y uno público se ve sin sesión', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await como(Role.USER, `/${eventos.ayer}`)).status, 200);
    assert.equal((await como(null, `/${eventos.anteayer}`)).status, 200);
  });
});
