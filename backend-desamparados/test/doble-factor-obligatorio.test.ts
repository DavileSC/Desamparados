import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { FALTA_DOBLE_FACTOR } from '../src/middleware/checkRole.js';
import { MisDatosService } from '../src/services/mis-datos.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

/**
 * El 2FA es obligatorio para el equipo: una sesión del CMS sin él solo sirve
 * para activarlo. Se decidió al pasar a una cuenta por persona, con la misma
 * contraseña para el área de hermanos y el CMS.
 */

let server: Server;
let baseUrl: string;
let dbDisponible = false;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
});

const cookieCms = (id: number, role: Role) => `${COOKIE_CMS}=${generateToken(id, role, false, 'cms')}`;

async function pedir(ruta: string, cookie: string, metodo = 'GET') {
  return fetch(`${baseUrl}/api${ruta}`, { method: metodo, headers: { Cookie: cookie } });
}

async function codigoDeError(res: Response) {
  return ((await res.json()) as { error?: string }).error;
}

test('sin 2FA, el CMS responde 403 con su código en cualquier ruta del equipo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const admin = await crearUsuarioPrueba(Role.ADMIN, { dobleFactor: false });
  try {
    const res = await pedir('/admin/staff', cookieCms(admin.id, Role.ADMIN));
    assert.equal(res.status, 403);
    assert.equal(await codigoDeError(res), FALTA_DOBLE_FACTOR);
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

test('sin 2FA, sí se puede generar el QR para activarlo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA, { dobleFactor: false });
  try {
    const res = await pedir('/auth/2fa/generate', cookieCms(staff.id, Role.SECRETARIA), 'POST');
    assert.equal(res.status, 200);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('desactivarlo cuenta al instante: la misma sesión deja de abrir el CMS', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  try {
    const cookie = cookieCms(admin.id, Role.ADMIN);
    const antes = await pedir('/admin/staff', cookie);
    assert.notEqual(antes.status, 403, 'con 2FA, el ADMIN entra');

    // Como un rescate de otro ADMIN o un «Cambiar de móvil»: el token no cambia.
    await db.user.update({ where: { id: admin.id }, data: { twoFactorEnabled: false } });
    const despues = await pedir('/admin/staff', cookie);
    assert.equal(despues.status, 403);
    assert.equal(await codigoDeError(despues), FALTA_DOBLE_FACTOR);
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

test('un cargo sin 2FA no puede borrar su cuenta ni desde la sesión del CMS', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.TESORERIA, { dobleFactor: false });
  try {
    await assert.rejects(
      MisDatosService.deleteOwnAccount(staff.id, PASSWORD_PRUEBA, 'cms'),
      (e: unknown) => e instanceof HttpError && e.status === 403,
    );
    const sigue = await db.user.findUnique({ where: { id: staff.id }, select: { active: true } });
    assert.equal(sigue?.active, true);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});
