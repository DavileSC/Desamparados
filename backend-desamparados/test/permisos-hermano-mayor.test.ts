// test/permisos-hermano-mayor.test.ts
// El Hermano Mayor pasa a ver y editar todo salvo la administración del
// sistema. Se comprueba sondeando el servidor, con el patrón de sondeo de
// Task 9 (test/fixtures/usuarios.ts): authenticateToken revalida la sesión
// contra la base de datos (cierre del hallazgo 02, ver session.ts), así que
// un token con un id inventado no basta para simular un rol — hace falta un
// usuario real. Los 401/403 previos a esa consulta no necesitan datos, pero
// aquí TODOS los casos pasan primero por esa revalidación.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import app from '../src/app.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_SESION } from '../src/utils/cookies.js';
import db from '../src/config/db.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { Role } from '@prisma/client';

let server: Server;
let baseUrl: string;
const usuariosTestId: number[] = [];
const roleToUserId: Record<string, number> = {};

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // Usuarios reales y desechables para los dos roles que sondean estas pruebas.
  for (const rol of [Role.HERMANO_MAYOR, Role.REDES]) {
    const usuario = await crearUsuarioPrueba(rol);
    usuariosTestId.push(usuario.id);
    roleToUserId[rol] = usuario.id;
  }
});

after(async () => {
  server.close();
  for (const id of usuariosTestId) {
    await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

const como = (rol: string, ruta: string, init: RequestInit = {}) =>
  fetch(`${baseUrl}${ruta}`, {
    ...init,
    headers: { Cookie: `${COOKIE_SESION}=${generateToken(roleToUserId[rol]!, rol)}`, ...(init.headers ?? {}) },
  });

describe('permisos del Hermano Mayor', () => {
  test('entra en tesorería', async () => {
    const res = await como('HERMANO_MAYOR', '/api/recibos/admin');
    assert.notEqual(res.status, 403);
  });

  test('entra en contabilidad', async () => {
    const res = await como('HERMANO_MAYOR', '/api/transacciones');
    assert.notEqual(res.status, 403);
  });

  test('lee el registro de auditoría', async () => {
    const res = await como('HERMANO_MAYOR', '/api/admin/audit-logs');
    assert.notEqual(res.status, 403);
  });

  test('NO puede promover cargos', async () => {
    const res = await como('HERMANO_MAYOR', '/api/admin/staff/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 2, role: 'ADMIN' }),
    });
    assert.equal(res.status, 403);
  });

  test('NO puede cambiar la configuración global', async () => {
    const res = await como('HERMANO_MAYOR', '/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'precio', value: '30' }),
    });
    assert.equal(res.status, 403);
  });

  test('el community manager sigue sin entrar en tesorería', async () => {
    const res = await como('REDES', '/api/transacciones');
    assert.equal(res.status, 403);
  });
});
