import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import app from '../src/app.js';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import db from '../src/config/db.js';

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
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

test('las publicaciones públicas no requieren autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/publications`);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(await response.json()));
});

test('las noticias destacadas no requieren autenticación', async () => {
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
