// test/panel-acceso.test.ts
// Quién puede entrar se comprueba sondeando el servidor, no leyendo el router:
// así se detectó la regresión de agosto. 401/403 no necesitan base de datos
// porque el middleware corta antes de consultarla.

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
let usuariosTestId: number[] = [];
const roleToUserId: Record<string, number> = {};

const STAFF = ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'REDES', 'ALBACERIA'];

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // Crear usuarios de prueba con los roles necesarios
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
    headers: rol ? { Cookie: `${COOKIE_SESION}=${generateToken(roleToUserId[rol]!, rol)}` } : {},
  });

describe('acceso al panel', () => {
  test('sin sesión responde 401', async () => {
    assert.equal((await pedirPanel()).status, 401);
  });

  test('un hermano raso responde 403', async () => {
    assert.equal((await pedirPanel('USER')).status, 403);
  });

  for (const rol of STAFF) {
    test(`${rol} pasa el filtro de permisos`, async () => {
      const res = await pedirPanel(rol);
      // 200 con base de datos, 500 sin ella: lo que se comprueba aquí es que
      // NO es 401 ni 403, es decir, que el rol tiene permiso.
      assert.ok(res.status !== 401 && res.status !== 403, `${rol} recibió ${res.status}`);
    });
  }
});
