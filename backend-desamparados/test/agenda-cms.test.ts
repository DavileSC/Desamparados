// test/agenda-cms.test.ts
//
// D9: el CMS lista también los eventos pasados. Antes usaba la lectura pública,
//     que solo enseña desde hoy: un evento fechado por error en el pasado
//     desaparecía del CMS y ya no se podía corregir ni borrar.
// Todos los actos son públicos: se leen sin sesión, y uno que no existe da 404.

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
import { ACTOS_EN_PORTADA, actosEnPortada } from '../src/services/agenda.service.js';

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
  eventos.ayer = (await db.evento.create({ data: { title: `${marca} ayer`, startDate: minutos(-1) } })).id;
  eventos.anteayer = (await db.evento.create({ data: { title: `${marca} antes`, startDate: minutos(-2) } })).id;
  eventos.hoy = (await db.evento.create({ data: { title: `${marca} hoy`, startDate: hoy } })).id;
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

describe('un acto suelto, sin sesión', () => {
  test('todos los actos se leen sin sesión', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await como(null, `/${eventos.ayer}`)).status, 200);
    assert.equal((await como(null, `/${eventos.anteayer}`)).status, 200);
  });

  test('uno que no existe responde 404', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como(null, '/999999999');
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as { error: string }).error, 'Evento no encontrado');
  });

  test('ya no viaja ninguna visibilidad', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const acto = await (await como(null, `/${eventos.ayer}`)).json() as Record<string, unknown>;
    assert.ok(!('visibility' in acto));
  });
});

describe('listado de la agenda en el CMS: búsqueda, filtros y resumen', () => {
  type ConResumen = Pagina & {
    resumen: { proximos: number; pasados: number; siguiente: { id: number } | null; portada: { limite: number; ids: number[] } };
  };

  test('busca en el título y deja fuera lo que no casa', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como(Role.SECRETARIA, `/admin?periodo=pasados&limit=50&q=${encodeURIComponent(`${marca} ayer`)}`);
    assert.equal(res.status, 200);
    const { data, resumen } = await res.json() as ConResumen;
    assert.deepEqual(data.map((e) => e.id), [eventos.ayer]);
    assert.equal(resumen.pasados, 1, 'la cifra de la pestaña respeta la búsqueda');
    assert.equal(resumen.proximos, 0);
  });

  test('filtra por tipo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const q = encodeURIComponent(marca);
    const cultos = await (await como(Role.SECRETARIA, `/admin?periodo=pasados&limit=50&q=${q}&tipo=CULTO`)).json() as Pagina;
    assert.equal(cultos.data.length, 0, 'los de prueba son de tipo OTRO');
    assert.equal((await como(Role.SECRETARIA, '/admin?tipo=MISA')).status, 400);
  });

  test('el resumen trae el siguiente acto y lo que sale en la portada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { resumen } = await (await como(Role.SECRETARIA, '/admin')).json() as ConResumen;
    assert.ok(resumen.siguiente, 'hay al menos el de hoy');
    assert.equal(resumen.portada.limite, ACTOS_EN_PORTADA);
    assert.ok(resumen.portada.ids.includes(eventos.hoy), 'el de hoy es el primero de los próximos: sale en la portada');
    assert.ok(!('soloHermanos' in resumen));
  });
});

describe('qué actos salen en la portada', () => {
  const el = (id: number, anio: number, mes: number, dia: number) => ({ id, startDate: new Date(anio, mes, dia, 20) });

  test('como mucho cinco, desde el próximo', () => {
    const actos = [1, 2, 3, 4, 5, 6, 7].map((n) => el(n, 2026, 9, n));
    assert.deepEqual(actosEnPortada(actos).map((e) => e.id), [1, 2, 3, 4, 5]);
  });

  test('solo el mes del próximo acto y el siguiente, que es lo que abarca el calendario', () => {
    const actos = [el(1, 2026, 9, 30), el(2, 2026, 10, 15), el(3, 2026, 11, 1)];
    assert.deepEqual(actosEnPortada(actos).map((e) => e.id), [1, 2]);
  });

  test('sin actos, ninguno', () => {
    assert.deepEqual(actosEnPortada([]), []);
  });
});
