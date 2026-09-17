// test/inventario-acceso.test.ts
// Los enseres (qué hay y dónde se guarda) y el resumen del inventario son de
// Albacería: el CMS solo enseña Inventario a ADMIN, ALBACERIA y HERMANO_MAYOR.
// Las rutas de lectura no llevaban `checkRole`, así que cualquier hermano con
// sesión del área de hermanos (o cualquier cargo del CMS) las leía por la API.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;
const creados: number[] = [];

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  server.close();
  for (const id of creados) await borrarUsuarioPrueba(id);
  await db.$disconnect();
});

const RUTAS = ['/api/inventario/dashboard', '/api/inventario/enseres', '/api/inventario/enseres/1'];

test('un hermano con sesión del área de hermanos no lee el inventario', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');
  const user = await crearUsuarioPrueba(Role.USER);
  creados.push(user.id);
  const cookie = `${COOKIE_HERMANO}=${generateToken(user.id, Role.USER, false, 'hermanos')}`;

  for (const ruta of RUTAS) {
    const respuesta = await fetch(`${baseUrl}${ruta}`, { headers: { cookie } });
    assert.equal(respuesta.status, 403, `${ruta} respondió ${respuesta.status}`);
  }
});

test('un cargo del CMS sin Inventario (Redes) no lee el inventario', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');
  const user = await crearUsuarioPrueba(Role.REDES);
  creados.push(user.id);
  const cookie = `${COOKIE_CMS}=${generateToken(user.id, Role.REDES, false, 'cms')}`;

  for (const ruta of RUTAS) {
    const respuesta = await fetch(`${baseUrl}${ruta}`, { headers: { cookie } });
    assert.equal(respuesta.status, 403, `${ruta} respondió ${respuesta.status}`);
  }
});

test('Albacería sí lee el inventario', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');
  const user = await crearUsuarioPrueba(Role.ALBACERIA);
  creados.push(user.id);
  const cookie = `${COOKIE_CMS}=${generateToken(user.id, Role.ALBACERIA, false, 'cms')}`;

  for (const ruta of ['/api/inventario/dashboard', '/api/inventario/enseres']) {
    const respuesta = await fetch(`${baseUrl}${ruta}`, { headers: { cookie } });
    assert.equal(respuesta.status, 200, `${ruta} respondió ${respuesta.status}`);
  }
});
