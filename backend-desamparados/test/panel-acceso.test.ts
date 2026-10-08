// test/panel-acceso.test.ts
// El test del 401 sin sesión se ejecuta siempre (no toca BD, solo verifica middleware).
// Los demás tests (403 para USER y permisos de staff) requieren BD con usuarios y se omiten si no está.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import app from '../src/app.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import db from '../src/config/db.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { Role } from '@prisma/client';
import { SIN_DB } from './fixtures/sin-db.js';

let server: Server;
let baseUrl: string;
let usuariosTestId: number[] = [];
const roleToUserId: Record<string, number> = {};

const STAFF = ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'REDES', 'ALBACERIA'];

let dbDisponible = false;
let motivoSinDb = '';

async function sondearDb(): Promise<boolean> {
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`
    .then(() => 'ok' as const)
    .catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));

  const resultado = await Promise.race([consulta, timeout]);
  if (resultado === 'ok') return true;

  motivoSinDb = resultado === 'timeout'
    ? `la conexión no respondió en 3 s (DATABASE_HOST=${process.env.DATABASE_HOST ?? 'sin definir'})`
    : resultado.message;
  return false;
}

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  dbDisponible = await sondearDb();
  if (!dbDisponible) {
    console.log(`
ℹ  Sin conexión a la base de datos: se omiten los tests que la necesitan.`);
    console.log(`   Motivo: ${motivoSinDb}`);
    console.log(`   El test «sin sesión responde 401» sigue ejecutándose (no necesita BD).
`);
    return;
  }

  // Crear usuarios de prueba con los roles necesarios (solo si hay BD)
  const usuarioUser = await crearUsuarioPrueba(Role.USER);
  usuariosTestId.push(usuarioUser.id);
  roleToUserId['USER'] = usuarioUser.id;

  for (const rol of STAFF) {
    const usuario = await crearUsuarioPrueba(rol as Role);
    usuariosTestId.push(usuario.id);
    roleToUserId[rol] = usuario.id;
  }
});

after(async () => {
  server.close();
  // Limpiar usuarios de prueba
  for (const id of usuariosTestId) {
    await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

const pedirPanel = (rol?: string) =>
  fetch(`${baseUrl}/api/panel`, {
    headers: rol ? { Cookie: `${COOKIE_CMS}=${generateToken(roleToUserId[rol]!, rol)}` } : {},
  });

describe('acceso al panel', () => {
  test('sin sesión responde 401', async () => {
    assert.equal((await pedirPanel()).status, 401);
  });

  test('un hermano raso responde 403', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedirPanel('USER')).status, 403);
  });

  for (const rol of STAFF) {
    test(`${rol} pasa el filtro de permisos`, async (t) => {
      if (!dbDisponible) return t.skip(SIN_DB);
      const res = await pedirPanel(rol);
      // Estos seis casos ya solo corren con MariaDB levantada (si no, se
      // omiten arriba), así que aquí no vale un 404 ni un 500: solo 200 es
      // que el rol tiene permiso y el panel respondió de verdad.
      assert.equal(res.status, 200, `${rol} recibió ${res.status}`);
    });
  }

  test('un año que no existe devuelve 400, no 500', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await fetch(`${baseUrl}/api/panel?anio=abc`, {
      headers: { Cookie: `${COOKIE_CMS}=${generateToken(roleToUserId['ADMIN']!, 'ADMIN')}` },
    });
    assert.equal(res.status, 400);
    const cuerpo = await res.json();
    assert.match(cuerpo.error, /año/i);
  });
});
