// La ficha de patrimonio contra MariaDB: un enser guarda su descripción,
// autor, época, materiales, medidas, conservación, fotos y tasación; lo que no
// llega no se toca y lo vacío se borra; la ficha sale en PDF; y una tasación
// con tres decimales o una foto ajena no pasan.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

test('la ficha de patrimonio se guarda, se corrige y sale en PDF', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const albacea = await crearUsuarioPrueba(Role.ALBACERIA);
  const cab = { Cookie: `${COOKIE_CMS}=${generateToken(albacea.id, Role.ALBACERIA)}`, 'Content-Type': 'application/json' };
  let id: number | null = null;
  try {
    const foto = `/storage/public/${'a'.repeat(32)}.webp`;
    const alta = await fetch(`${baseUrl}/api/inventario/enseres`, {
      method: 'POST', headers: cab,
      body: JSON.stringify({
        nombre: 'Corona de salida', categoria: 'Orfebrería', cantidadOptimo: 1,
        descripcion: 'Corona imperial de plata sobredorada.', autor: 'Taller de Seco Velasco', epoca: '1958',
        materiales: 'Plata sobredorada, pedrería', dimensiones: '42 × 30 cm', conservacion: 'Limpieza en 2019.',
        fotos: [{ url: foto, pie: 'Detalle del canasto' }], valorTasacion: 18500.5, fechaTasacion: '2025-03-01', tasadoPor: 'Joyería Pérez',
      }),
    });
    assert.equal(alta.status, 201);
    const creado = await alta.json();
    id = creado.id;
    assert.equal(creado.autor, 'Taller de Seco Velasco');
    assert.equal(Number(creado.valorTasacion), 18500.5);
    assert.deepEqual(creado.fotos, [{ url: foto, pie: 'Detalle del canasto' }]);

    // Solo lo que llega: el resto se queda; lo vacío se borra.
    const cambio = await fetch(`${baseUrl}/api/inventario/enseres/${id}`, { method: 'PUT', headers: cab, body: JSON.stringify({ epoca: '', valorTasacion: null }) });
    assert.equal(cambio.status, 200);
    const guardado = await db.enser.findUniqueOrThrow({ where: { id: id! } });
    assert.equal(guardado.epoca, null);
    assert.equal(guardado.valorTasacion, null);
    assert.equal(guardado.autor, 'Taller de Seco Velasco');

    // Lo que no vale no entra.
    assert.equal((await fetch(`${baseUrl}/api/inventario/enseres/${id}`, { method: 'PUT', headers: cab, body: JSON.stringify({ valorTasacion: 10.005 }) })).status, 400);
    assert.equal((await fetch(`${baseUrl}/api/inventario/enseres/${id}`, { method: 'PUT', headers: cab, body: JSON.stringify({ fotos: [{ url: 'https://otra.web/foto.jpg', pie: '' }] }) })).status, 400);

    // El PDF sale aunque la foto no esté en el disco.
    const pdf = await fetch(`${baseUrl}/api/inventario/enseres/${id}/ficha`, { headers: cab });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    assert.equal((await fetch(`${baseUrl}/api/inventario/enseres/${id}/ficha`)).status, 401);
  } finally {
    if (id) await db.enser.deleteMany({ where: { id } });
    await borrarUsuarioPrueba(albacea.id);
  }
});
