// El cortejo en directo contra MariaDB: la web solo ve la posición mientras
// está en marcha y es reciente, nunca quién la manda; mandarla pide sesión de
// la Junta, y el comienzo y el final quedan en la auditoría.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { CADUCA_MS, CortejoDirectoService, itinerarioConMapa } from '../src/services/cortejo-directo.service.js';
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

const cookie = (id: number, rol: Role) => ({ Cookie: `${COOKIE_CMS}=${generateToken(id, rol)}`, 'Content-Type': 'application/json' });

test('la posición se ve mientras está en marcha y es reciente; al terminar, se apaga', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // Hay una sola fila: se guarda la de la base de desarrollo y se deja como estaba.
  const previa = await db.cortejoEnDirecto.findUnique({ where: { id: 1 } });
  const albacea = await crearUsuarioPrueba(Role.ALBACERIA);
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    await db.cortejoEnDirecto.deleteMany({});
    const apagado = await (await fetch(`${baseUrl}/api/cortejo-directo`)).json();
    assert.equal(apagado.enDirecto, false);
    assert.equal('lng' in apagado, false);

    const cuerpo = JSON.stringify({ lng: -4.4461, lat: 36.7282, precision: 12 });
    assert.equal((await fetch(`${baseUrl}/api/cortejo-directo/admin`, { method: 'PUT', body: cuerpo, headers: { 'Content-Type': 'application/json' } })).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/cortejo-directo/admin`, { method: 'PUT', body: cuerpo, headers: cookie(hermano.id, Role.USER) })).status, 403);
    const malo = await fetch(`${baseUrl}/api/cortejo-directo/admin`, { method: 'PUT', body: JSON.stringify({ lng: 500, lat: 36, precision: null }), headers: cookie(albacea.id, Role.ALBACERIA) });
    assert.equal(malo.status, 400);

    const r = await fetch(`${baseUrl}/api/cortejo-directo/admin`, { method: 'PUT', body: cuerpo, headers: cookie(albacea.id, Role.ALBACERIA) });
    assert.equal(r.status, 200);
    const junta = await r.json();
    assert.equal(junta.enMarcha, true);
    assert.equal(junta.autorNombre, albacea.nombre);
    // Una segunda posición no vuelve a apuntar el comienzo.
    await fetch(`${baseUrl}/api/cortejo-directo/admin`, { method: 'PUT', body: JSON.stringify({ lng: -4.4462, lat: 36.7283, precision: null }), headers: cookie(albacea.id, Role.ALBACERIA) });

    const publico = await fetch(`${baseUrl}/api/cortejo-directo`);
    assert.equal(publico.headers.get('cache-control'), 'no-store');
    const p = await publico.json();
    assert.equal(p.enDirecto, true);
    assert.equal(p.lng, -4.4462);
    assert.equal(p.lat, 36.7283);
    assert.equal('autorNombre' in p, false, 'la web no dice quién lleva el móvil');

    // Sin renovarse, deja de estar en directo aunque siga en marcha.
    const luego = new Date(Date.now() + CADUCA_MS + 1000);
    assert.equal((await CortejoDirectoService.publico(luego)).enDirecto, false);
    assert.equal('lng' in (await CortejoDirectoService.publico(luego)), false);
    const vieja = await CortejoDirectoService.paraLaJunta(luego);
    assert.equal(vieja.enMarcha, true);
    assert.equal(vieja.enDirecto, false);

    const fin = await fetch(`${baseUrl}/api/cortejo-directo/admin/terminar`, { method: 'POST', headers: cookie(albacea.id, Role.ALBACERIA) });
    assert.equal((await fin.json()).enMarcha, false);
    assert.equal((await (await fetch(`${baseUrl}/api/cortejo-directo`)).json()).enDirecto, false);

    const acciones = (await db.auditLog.findMany({ where: { userId: albacea.id, entityType: 'cortejoEnDirecto' }, orderBy: { id: 'asc' } })).map((a) => a.action);
    assert.deepEqual(acciones, ['CORTEJO_DIRECTO_EMPEZAR', 'CORTEJO_DIRECTO_TERMINAR']);
  } finally {
    await db.auditLog.deleteMany({ where: { userId: albacea.id } });
    await db.cortejoEnDirecto.deleteMany({});
    if (previa) await db.cortejoEnDirecto.create({ data: previa });
    await borrarUsuarioPrueba(albacea.id);
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('el recorrido del cortejo es el primer itinerario con mapa, también dentro de otro bloque', () => {
  const linea = [[-4.44, 36.72], [-4.45, 36.73]];
  const sinMapa = { tipo: 'itinerario', paradas: [{ lugar: 'Salida' }] };
  const conMapa = { tipo: 'itinerario', paradas: [{ lugar: 'Templo' }], recorrido: { linea } };
  assert.equal(itinerarioConMapa({ bloques: [sinMapa] }), null);
  // Una línea de un solo punto no es un mapa.
  assert.equal(itinerarioConMapa({ bloques: [{ ...conMapa, recorrido: { linea: [linea[0]] } }] }), null);
  assert.deepEqual(itinerarioConMapa({ bloques: [sinMapa, { tipo: 'combinado', hijos: [conMapa] }] }), { paradas: conMapa.paradas, linea, calles: [] });
  // Con calles, van también: la Junta marca a mano por calles.
  const calles = [{ nombre: 'C. Mayor', desde: 0 }, { nombre: 'Cruce de la avenida', desde: 0.5, cruce: true }];
  assert.deepEqual(itinerarioConMapa({ bloques: [{ ...conMapa, recorrido: { linea, calles } }] })?.calles, calles);
});
