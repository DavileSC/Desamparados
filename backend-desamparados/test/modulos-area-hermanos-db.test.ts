// Con el módulo «Área de hermanos» apagado nadie entra por /acceso (tampoco
// la junta: el CMS tiene su propio acceso) y una sesión de hermano que ya
// existiera deja de valer. La del CMS sigue igual.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { ModulosService } from '../src/services/modulos.service.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const META = { ip: '127.0.0.1', userAgent: 'prueba-area' };
let dbDisponible = false;
let server: Server;
let baseUrl: string;
const usuarios: number[] = [];

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  if (dbDisponible) {
    await ModulosService.cambiar('area-hermanos', true, {}, undefined, META);
    await ModulosService.cambiar('cuotas-en-linea', true, { conRequisitos: true }, undefined, META);
    await db.auditLog.deleteMany({ where: { userAgent: 'prueba-area' } });
    for (const id of usuarios) await borrarUsuarioPrueba(id);
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

const entrar = (email: string) => fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASSWORD_PRUEBA, contexto: 'hermanos' }),
});
const yo = (cookie: string) => fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } }).then((r) => r.json() as Promise<{ cms: unknown; hermano: unknown }>);

test('apagado, /acceso no da sesión a nadie y las que había dejan de valer; el CMS sigue', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  usuarios.push(hermano.id, admin.id);
  const cookieHermano = `${COOKIE_HERMANO}=${generateToken(hermano.id, Role.USER, false, 'hermanos')}`;
  const cookieCms = `${COOKIE_CMS}=${generateToken(admin.id, Role.ADMIN, false, 'cms')}`;

  assert.equal((await entrar(hermano.email)).status, 200, 'encendido, entra');
  assert.ok((await yo(cookieHermano)).hermano, 'encendido, la sesión vale');

  // cuotas-en-linea requiere el área: hay que apagarlo antes.
  await ModulosService.cambiar('cuotas-en-linea', false, {}, undefined, META);
  const r = await ModulosService.cambiar('area-hermanos', false, {}, undefined, META);
  assert.equal(r.ok, true);

  const rechazo = await entrar(hermano.email);
  assert.equal(rechazo.status, 404);
  assert.match((await rechazo.json() as { message: string }).message, /El área de hermanos no está activada en esta instalación/);
  assert.equal((await entrar(admin.email)).status, 404, 'tampoco la junta: el CMS tiene su acceso');
  assert.equal((await yo(cookieHermano)).hermano, null, 'la sesión de antes ya no vale');
  assert.equal((await fetch(`${baseUrl}/api/hermanos/mis-perfiles`, { headers: { Cookie: cookieHermano } })).status, 401);
  assert.ok((await yo(cookieCms)).cms, 'la del CMS sigue');
  assert.equal((await fetch(`${baseUrl}/api/cms/modulos`, { headers: { Cookie: cookieCms } })).status, 200);
});
