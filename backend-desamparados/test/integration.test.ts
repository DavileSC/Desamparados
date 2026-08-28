import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import app from '../src/app.js';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import db from '../src/config/db.js';
import { generateToken, generatePending2FAToken } from '../src/utils/jwt.handle.js';
import { COOKIE_SESION } from '../src/utils/cookies.js';

let server: Server;
let baseUrl: string;

/**
 * Los tests que consultan la base de datos solo tienen sentido con MariaDB
 * levantada. Sin ella el servidor devuelve 500 tras el timeout de conexión y
 * el fallo no dice nada sobre el código, así que se sondea una vez y esos
 * casos se marcan como omitidos con el motivo a la vista, en vez de fallar.
 */
let dbDisponible = false;
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

async function sondearDb(): Promise<boolean> {
  // Con un timeout corto: el driver reintenta durante ~20 s antes de rendirse
  // y eso convertia cada ejecución sin base de datos en una espera inútil.
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  return Promise.race([consulta, timeout]);
}

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  dbDisponible = await sondearDb();
  if (!dbDisponible) {
    console.log(`ℹ  Sin conexión a la base de datos: se omiten los tests que la necesitan.`);
  }
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await db.$disconnect();
});

test('healthcheck responde con estado ok', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  const body = await response.json() as { status?: string; uptime?: number };
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptime, 'number');
});

test('las publicaciones públicas no requieren autenticación', { skip: () => (dbDisponible ? false : SIN_DB) }, async () => {
  const response = await fetch(`${baseUrl}/api/publications`);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(await response.json()));
});

test('las noticias destacadas no requieren autenticación', { skip: () => (dbDisponible ? false : SIN_DB) }, async () => {
  const response = await fetch(`${baseUrl}/api/news/latest`);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(await response.json()));
});

test('el CMS rechaza peticiones sin token', async () => {
  const response = await fetch(`${baseUrl}/api/publications/admin`);
  assert.equal(response.status, 401);
  const body = await response.json() as { error?: string };
  assert.equal(body.error, 'NO_TOKEN_PROVIDED');
});

test('el archivo de noticias del CMS rechaza peticiones sin token', async () => {
  // Regresión: esta ruta se declaró antes del use(authenticateToken) para que
  // "admin" no se leyera como slug, y con ello dejó de pasar por el filtro.
  // Expone los borradores (visible: false) a cualquiera.
  const response = await fetch(`${baseUrl}/api/news/admin/archive`);
  assert.equal(response.status, 401);
  const body = await response.json() as { error?: string };
  assert.equal(body.error, 'NO_TOKEN_PROVIDED');
});

test('los documentos privados rechazan peticiones sin token', async () => {
  const response = await fetch(`${baseUrl}/api/upload/private/${'a'.repeat(32)}.pdf`);
  assert.equal(response.status, 401);
});

test('contacto rechaza un cuerpo inválido antes de intentar enviar correo', async () => {
  const response = await fetch(`${baseUrl}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje: 'corto' }),
  });
  assert.equal(response.status, 400);
  const body = await response.json() as { message?: string };
  assert.equal(body.message, 'Error de validación');
});


// ==========================================
//  SESION EN COOKIE httpOnly
// ==========================================
// Ninguno de estos necesita base de datos: el middleware corta antes de llegar.

test('sin cookie, una ruta privada responde 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/mis-datos`);
  assert.equal(res.status, 401);
});

test('la cabecera Authorization ya no autentica', async () => {
  const res = await fetch(`${baseUrl}/api/auth/mis-datos`, {
    headers: { Authorization: `Bearer ${generateToken(1, 'ADMIN')}` }
  });
  assert.equal(res.status, 401);
});

// El caso critico: el testigo del 2FA identifica a un usuario, pero no puede
// servir de sesion. Falla antes de tocar la base de datos, asi que no la necesita.
test('el testigo de 2FA no sirve como cookie de sesion', async () => {
  const res = await fetch(`${baseUrl}/api/auth/mis-datos`, {
    headers: { Cookie: `${COOKIE_SESION}=${generatePending2FAToken(1)}` }
  });
  assert.equal(res.status, 401);
});

// Sin la cookie del primer factor no se entra, aunque el codigo fuera correcto.
// Este es el fallo que se cierra: antes bastaba con mandar { userId, token2fa }.
test('el 2FA sin el testigo del primer factor responde 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token2fa: '123456' })
  });
  assert.equal(res.status, 401);
});

test('el 2FA ya no acepta un userId en el cuerpo', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 1, token2fa: '123456' })
  });
  // 401 por falta de testigo, nunca 200: el userId del cuerpo se ignora
  assert.equal(res.status, 401);
});

test('/me sin cookie responde 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(res.status, 401);
});

test('logout responde 204 y borra las cookies aunque no hubiera sesion', async () => {
  const res = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
  assert.equal(res.status, 204);

  const borrados = res.headers.getSetCookie();
  // El borrado tiene que repetir el Path exacto o el navegador lo ignora
  assert.ok(borrados.some((c) => c.includes('desamparados_session=') && c.includes('Path=/api')));
  assert.ok(borrados.some((c) => c.includes('desamparados_2fa=') && c.includes('Path=/api/auth')));
});
