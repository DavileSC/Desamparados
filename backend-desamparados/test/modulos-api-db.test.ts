// La API de los módulos: la lista pública que la web pide al arrancar, la
// pantalla de Administración (solo ADMIN) y la guarda conModulo, que
// responde 404 con el módulo apagado y deja pasar con él encendido.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { ModulosService } from '../src/services/modulos.service.js';
import { conModulo, nucleo } from '../src/middleware/modulos.js';
import { CLAVES_MODULO } from '../src/domain/modulos.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;
const usuarios: number[] = [];
const META = { ip: '127.0.0.1', userAgent: 'prueba-api' };

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  if (dbDisponible) {
    // Todo lo que estas pruebas apagan se vuelve a encender.
    for (const clave of ['loteria', 'tienda', 'tienda-web'] as const) await ModulosService.cambiar(clave, true, { conRequisitos: true }, undefined, META);
    await db.auditLog.deleteMany({ where: { userAgent: 'prueba-api' } });
    for (const id of usuarios) await borrarUsuarioPrueba(id);
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

async function cargo(role: Role) {
  const u = await crearUsuarioPrueba(role);
  usuarios.push(u.id);
  return `${COOKIE_CMS}=${generateToken(u.id, role, false, 'cms')}`;
}
const pedir = (ruta: string, cookie?: string, method = 'GET', cuerpo?: unknown) =>
  fetch(`${baseUrl}${ruta}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
  });

describe('GET /api/modulos', () => {
  test('sin sesión, la lista de claves activas', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const r = await pedir('/api/modulos');
    assert.equal(r.status, 200);
    const { activos } = await r.json() as { activos: string[] };
    assert.ok(Array.isArray(activos));
    for (const c of activos) assert.ok((CLAVES_MODULO as readonly string[]).includes(c), c);
    assert.ok(activos.includes('noticias'));
  });
});

describe('Sistema → Módulos', () => {
  test('solo Administración lee y cambia', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedir('/api/cms/modulos')).status, 401);
    const tesoreria = await cargo(Role.TESORERIA);
    assert.equal((await pedir('/api/cms/modulos', tesoreria)).status, 403);
    assert.equal((await pedir('/api/cms/modulos/loteria', tesoreria, 'PUT', { activo: false })).status, 403);
    const admin = await cargo(Role.ADMIN);
    const r = await pedir('/api/cms/modulos', admin);
    assert.equal(r.status, 200);
    const lista = await r.json() as { clave: string; activo: boolean; datos: { que: string; total: number }[] }[];
    assert.deepEqual(lista.map((m) => m.clave), [...CLAVES_MODULO]);
    assert.ok(lista.find((m) => m.clave === 'tienda')!.datos.some((d) => d.que === 'productos'));
  });

  test('encender sin requisitos es un 400 con lo que falta; con conRequisitos, enciende', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const admin = await cargo(Role.ADMIN);
    await ModulosService.cambiar('tienda-web', false, {}, undefined, META);
    await ModulosService.cambiar('tienda', false, {}, undefined, META);
    const no = await pedir('/api/cms/modulos/tienda-web', admin, 'PUT', { activo: true });
    assert.equal(no.status, 400);
    const cuerpo = await no.json() as { message: string; faltan: string[]; dependientes: string[] };
    assert.deepEqual(cuerpo.faltan, ['tienda']);
    assert.deepEqual(cuerpo.dependientes, []);
    const si = await pedir('/api/cms/modulos/tienda-web', admin, 'PUT', { activo: true, conRequisitos: true });
    assert.equal(si.status, 200);
    const hecho = await si.json() as { ok: boolean; cambiados: string[]; activos: string[] };
    assert.deepEqual(hecho.cambiados, ['tienda', 'tienda-web']);
    assert.ok(hecho.activos.includes('tienda-web'));
  });

  test('apagar con dependientes es un 400 con cuáles; una clave desconocida, 404; un cuerpo raro, 400', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const admin = await cargo(Role.ADMIN);
    const no = await pedir('/api/cms/modulos/tienda', admin, 'PUT', { activo: false });
    assert.equal(no.status, 400);
    assert.deepEqual((await no.json() as { dependientes: string[] }).dependientes, ['tienda-web']);
    assert.equal((await pedir('/api/cms/modulos/tiendaa', admin, 'PUT', { activo: false })).status, 404);
    assert.equal((await pedir('/api/cms/modulos/tienda', admin, 'PUT', { activo: 'no' })).status, 400);
  });
});

describe('conModulo', () => {
  test('apagado responde 404 con el nombre del módulo; encendido deja pasar; nucleo siempre pasa', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const mini = express();
    mini.get('/loteria', conModulo('loteria'), (_req, res) => { res.json({ ok: true }); });
    mini.get('/fijo', nucleo, (_req, res) => { res.json({ ok: true }); });
    const s = mini.listen(0);
    await new Promise<void>((resolve) => s.once('listening', resolve));
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    try {
      await ModulosService.cambiar('loteria', false, {}, undefined, META);
      const r = await fetch(`${url}/loteria`);
      assert.equal(r.status, 404);
      const cuerpo = await r.json() as { error: string; modulo: string; message: string };
      assert.equal(cuerpo.error, 'MODULO_NO_ACTIVADO');
      assert.equal(cuerpo.modulo, 'loteria');
      assert.match(cuerpo.message, /«Lotería y talonarios» no está activado en esta instalación/);
      assert.equal((await fetch(`${url}/fijo`)).status, 200);
      await ModulosService.cambiar('loteria', true, {}, undefined, META);
      assert.equal((await fetch(`${url}/loteria`)).status, 200);
    } finally {
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });
});
