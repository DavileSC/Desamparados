// Primero: aísla `storage/` en una carpeta temporal antes de que se cargue
// upload.middleware.ts (ver el fixture). Este fichero crea ficheros de prueba.
import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { publicStorageDir } from '../src/middleware/upload.middleware.js';

/**
 * El limitador global se come la sesión entera en cuanto el cupo es corto: el
 * 11-09-2026 un editor se quedó sin poder guardar la portada (429 en el PUT) y
 * sin sesión (429 en /auth/me) tras un rato normal navegando la web y el CMS.
 *
 * Se comprueba por la cabecera `RateLimit-Policy` que pone express-rate-limit
 * en cada respuesta que cuenta: así no hace falta agotar el cupo de verdad.
 */

let server: Server;
let baseUrl: string;
const carpeta = path.join(publicStorageDir, '__test-limitador');
const foto = path.join(carpeta, 'foto.txt');

before(async () => {
  await mkdir(carpeta, { recursive: true });
  await writeFile(foto, 'x');
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(carpeta, { recursive: true, force: true });
  // Las guardas de módulo consultan la base en la primera petición: sin
  // desconectar, el pool de Prisma queda abierto y el runner no avanza al
  // siguiente fichero.
  await db.$disconnect();
});

test('las fotos públicas no gastan el cupo del limitador global', async () => {
  // Pasaban por el limitador, y en producción nginx no manda X-Forwarded-For
  // en /storage/public: todas las visitas compartían la IP 127.0.0.1 y un
  // único cupo, así que las fotos de la web se caían para todo el mundo.
  const res = await fetch(`${baseUrl}/storage/public/__test-limitador/foto.txt`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('ratelimit-policy'), null);
});

test('el cupo global de la API aguanta una sesión de trabajo en el CMS', async () => {
  // Con 100 cada 15 minutos, la portada pública (~6 peticiones por visita) y
  // unas cuantas pantallas del CMS bastaban para bloquear al editor.
  const res = await fetch(`${baseUrl}/api/ruta-que-no-existe`);
  const politica = res.headers.get('ratelimit-policy');
  assert.ok(politica, 'la API sigue pasando por el limitador global');
  const cupo = Number(politica.split(';')[0]);
  assert.ok(cupo >= 1000, `cupo global demasiado corto: ${politica}`);
});
