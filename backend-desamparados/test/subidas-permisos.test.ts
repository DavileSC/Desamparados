// test/subidas-permisos.test.ts
//
// Quién abre los documentos privados (la foto y el certificado de bautismo del
// alta) y quién sube fotos públicas. Lo privado es del censo: con la lista
// entera de staff, Redes o Tesorería veían la partida de bautismo de un
// hermano con un enlace reenviado. Y Albacería y Tesorería, que llevan
// inventario, tienda y apadrinamientos, se quedaban sin poder subir su foto.

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
import { SIN_DB } from './fixtures/sin-db.js';

const ROLES = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR, Role.TESORERIA, Role.ALBACERIA, Role.REDES] as const;

let server: Server;
let baseUrl: string;
let dbDisponible = false;
const usuarios = new Map<Role, number>();

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
  dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
  if (dbDisponible) for (const rol of ROLES) usuarios.set(rol, (await crearUsuarioPrueba(rol)).id);
});

after(async () => {
  server.close();
  for (const id of usuarios.values()) await borrarUsuarioPrueba(id);
  await db.$disconnect();
});

const cookie = (rol: Role) => ({ Cookie: `${COOKIE_CMS}=${generateToken(usuarios.get(rol)!, rol)}` });

describe('documentos privados', () => {
  test('solo los abre quien gestiona el censo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const ruta = `${baseUrl}/api/upload/private/${'a'.repeat(32)}.webp`;
    for (const rol of [Role.TESORERIA, Role.ALBACERIA, Role.REDES]) {
      assert.equal((await fetch(ruta, { headers: cookie(rol) })).status, 403, rol);
    }
    // El censo pasa la puerta: el fichero no existe y da 404, no 403.
    for (const rol of [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR]) {
      assert.equal((await fetch(ruta, { headers: cookie(rol) })).status, 404, rol);
    }
  });

  test('subir a la carpeta privada, igual', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    for (const rol of [Role.TESORERIA, Role.ALBACERIA, Role.REDES]) {
      const r = await fetch(`${baseUrl}/api/upload/private`, { method: 'POST', headers: cookie(rol), body: new FormData() });
      assert.equal(r.status, 403, rol);
    }
  });
});

describe('fotos públicas', () => {
  test('Albacería y Tesorería pasan la puerta (sin fichero, 400 y no 403)', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    for (const rol of [Role.ALBACERIA, Role.TESORERIA, Role.REDES, Role.HERMANO_MAYOR]) {
      const r = await fetch(`${baseUrl}/api/upload/public`, { method: 'POST', headers: cookie(rol), body: new FormData() });
      assert.notEqual(r.status, 403, rol);
      assert.ok(r.status < 500, `${rol}: ${r.status}`);
    }
  });
});
