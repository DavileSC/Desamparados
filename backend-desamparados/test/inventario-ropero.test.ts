// test/inventario-ropero.test.ts
//
// P1: quién tiene cada prenda (nombre, apellidos y número de hermano) solo lo
//     ven los gestores del inventario, no cualquier hermano con sesión.
// D15: el estado PRESTADA/DISPONIBLE lo deciden «Asignar» y «Devolver», que
//     guardan también quién la tiene; se presta por número de hermano; las
//     cantidades de los enseres son enteras.
//
// Se sondea el servidor real (docs/notas-del-proyecto.md, sección 4). Todo
// necesita MariaDB: la sesión se revalida contra la base de datos.

import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { randomInt } from 'node:crypto';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let server: Server;
let baseUrl: string;
let dbDisponible = false;
const usuarios: Partial<Record<Role, number>> = {};
let hermanoId = 0;
// Un número de hermano que no choque con los de la base de desarrollo.
const numeroHermano = 900_000_000 + randomInt(0, 99_999_999);
// Uno que seguro que no existe. Por DEBAJO del de prueba, no por encima: ese
// número pasa a ser el máximo del censo mientras dura el fichero, y los tests
// de aprobaciones, que corren a la vez, numeran con `máximo + 1`.
const numeroInexistente = numeroHermano - 1;
const numeroPrenda = `PRUEBA-${Date.now()}`;
let prendaId = 0;

async function sondearDb(): Promise<boolean> {
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const);
  return (await Promise.race([consulta, timeout])) === 'ok';
}

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  dbDisponible = await sondearDb();
  if (!dbDisponible) return;
  for (const rol of [Role.USER, Role.ALBACERIA]) usuarios[rol] = (await crearUsuarioPrueba(rol)).id;
  const hermano = await db.hermano.create({
    data: { nombre: 'Hermano', apellidos: 'De Prueba Ropero', fechaNacimiento: new Date('1990-01-01'), userId: usuarios[Role.USER]!, numeroHermano },
  });
  hermanoId = hermano.id;
});

after(async () => {
  server.close();
  if (prendaId) await db.prenda.deleteMany({ where: { id: prendaId } });
  if (hermanoId) await db.hermano.deleteMany({ where: { id: hermanoId } });
  for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
  await db.$disconnect();
});

// El ropero (prendas, hermanos) vive en /api/ropero; los enseres y el
// dashboard se quedan en /api/inventario (ver backend ropero.routes.ts).
const esRopero = (ruta: string) => ruta.startsWith('/prendas') || ruta.startsWith('/hermanos');
const como = (rol: Role, ruta: string, metodo = 'GET', cuerpo?: unknown) =>
  fetch(`${baseUrl}${esRopero(ruta) ? '/api/ropero' : '/api/inventario'}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Cookie: `${COOKIE_CMS}=${generateToken(usuarios[rol]!, rol)}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

describe('quién ve el ropero (P1)', () => {
  test('sin sesión, el ropero responde 401', async () => {
    assert.equal((await fetch(`${baseUrl}/api/ropero/prendas`)).status, 401);
  });

  test('un hermano raso no ve el ropero ni la ficha de una prenda', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await como(Role.USER, '/prendas')).status, 403);
    assert.equal((await como(Role.USER, '/prendas/1')).status, 403);
    assert.equal((await como(Role.USER, `/hermanos/${numeroHermano}`)).status, 403);
  });

  // Antes abiertos «porque no llevan datos personales», pero cada enser dice
  // dónde se guarda. Los detalles, en test/inventario-acceso.test.ts.
  test('un hermano raso tampoco ve el patrimonio ni el resumen', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await como(Role.USER, '/dashboard')).status, 403);
    assert.equal((await como(Role.USER, '/enseres')).status, 403);
  });

  test('la albacería sí ve el ropero', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await como(Role.ALBACERIA, '/prendas')).status, 200);
  });
});

describe('préstamos del ropero (D15)', () => {
  test('una prenda no se da de alta como prestada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como(Role.ALBACERIA, '/prendas', 'POST', { numero: numeroPrenda, tipo: 'TUNICA', estado: 'PRESTADA' });
    assert.equal(res.status, 400);
  });

  test('se busca al hermano por su número antes de prestar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como(Role.ALBACERIA, `/hermanos/${numeroHermano}`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { numeroHermano, nombre: 'Hermano', apellidos: 'De Prueba Ropero' });

    const nadie = await como(Role.ALBACERIA, `/hermanos/${numeroInexistente}`);
    assert.equal(nadie.status, 404);
    assert.equal((await como(Role.ALBACERIA, '/hermanos/abc')).status, 400);
  });

  test('prestar, editar y devolver: el estado solo lo cambian «Asignar» y «Devolver»', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const alta = await como(Role.ALBACERIA, '/prendas', 'POST', { numero: numeroPrenda, tipo: 'TUNICA', talla: '1.80m' });
    assert.equal(alta.status, 201, await alta.clone().text());
    prendaId = ((await alta.json()) as { id: number }).id;

    // Editando no se presta: quedaría prestada a nadie.
    assert.equal((await como(Role.ALBACERIA, `/prendas/${prendaId}`, 'PUT', { estado: 'PRESTADA' })).status, 400);

    const asignar = await como(Role.ALBACERIA, `/prendas/${prendaId}/asignar`, 'POST', { numeroHermano });
    assert.equal(asignar.status, 200, await asignar.clone().text());
    const prestada = ((await asignar.json()) as { data: { estado: string; hermano: { numeroHermano: number } } }).data;
    assert.equal(prestada.estado, 'PRESTADA');
    assert.equal(prestada.hermano.numeroHermano, numeroHermano);

    // Ya prestada, no se presta otra vez.
    assert.equal((await como(Role.ALBACERIA, `/prendas/${prendaId}/asignar`, 'POST', { numeroHermano })).status, 400);

    // Editar la ficha reenviando el mismo estado sí se puede; cambiarlo no.
    assert.equal((await como(Role.ALBACERIA, `/prendas/${prendaId}`, 'PUT', { estado: 'PRESTADA', observaciones: 'Bajo descosido' })).status, 200);
    assert.equal((await como(Role.ALBACERIA, `/prendas/${prendaId}`, 'PUT', { estado: 'DISPONIBLE' })).status, 400);
    const ficha = await (await como(Role.ALBACERIA, `/prendas/${prendaId}`)).json() as { estado: string; hermano: unknown };
    assert.equal(ficha.estado, 'PRESTADA');
    assert.ok(ficha.hermano, 'sigue anotado quién la tiene');

    // Una túnica devuelta va siempre al lavado: se lavan todas.
    const devolver = await como(Role.ALBACERIA, `/prendas/${prendaId}/devolver`, 'POST', {});
    assert.equal(devolver.status, 200);
    const devuelta = ((await devolver.json()) as { data: { estado: string; hermano: unknown } }).data;
    assert.equal(devuelta.estado, 'LAVADO');
    assert.equal(devuelta.hermano, null);

    // Lo que no está prestado no se devuelve.
    assert.equal((await como(Role.ALBACERIA, `/prendas/${prendaId}/devolver`, 'POST', { rota: true })).status, 400);
    // Del lavado vuelve a disponible editando, que no toca el préstamo.
    assert.equal((await como(Role.ALBACERIA, `/prendas/${prendaId}`, 'PUT', { estado: 'DISPONIBLE' })).status, 200);
  });

  test('prestar a un número que no existe responde 404 y no toca la prenda', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    if (!prendaId) return t.skip('depende de la prenda creada en la prueba anterior');
    const res = await como(Role.ALBACERIA, `/prendas/${prendaId}/asignar`, 'POST', { numeroHermano: numeroInexistente });
    assert.equal(res.status, 404);
    const prenda = await db.prenda.findUnique({ where: { id: prendaId } });
    assert.equal(prenda?.estado, 'DISPONIBLE');
    assert.equal(prenda?.hermanoId, null);
  });

  test('ya no se presta tecleando el id interno del hermano', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    if (!prendaId) return t.skip('depende de la prenda creada en la prueba anterior');
    assert.equal((await como(Role.ALBACERIA, `/prendas/${prendaId}/asignar`, 'POST', { hermanoId })).status, 400);
  });

  test('las cantidades de un enser con decimales se rechazan con 400, no con 500', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await como(Role.ALBACERIA, '/enseres', 'POST', { nombre: 'Prueba', cantidadOptimo: 2.5 })).status, 400);
  });
});

// El esquema aceptaba la foto del enser y el servicio la descartaba sin avisar.
describe('foto de un enser', () => {
  test('se guarda al crear, se conserva si no se envía y se quita con null', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const foto = `/storage/public/${'a'.repeat(32)}.jpg`;
    const creado = await como(Role.ALBACERIA, '/enseres', 'POST', { nombre: `Enser prueba ${Date.now()}`, imagenUrl: foto });
    assert.equal(creado.status, 201, await creado.clone().text());
    const { id } = await creado.json() as { id: number };
    try {
      assert.equal((await db.enser.findUnique({ where: { id } }))?.imagenUrl, foto);

      assert.equal((await como(Role.ALBACERIA, `/enseres/${id}`, 'PUT', { nombre: 'Enser renombrado' })).status, 200);
      assert.equal((await db.enser.findUnique({ where: { id } }))?.imagenUrl, foto, 'sin imagenUrl en el cuerpo, la foto se queda');

      assert.equal((await como(Role.ALBACERIA, `/enseres/${id}`, 'PUT', { imagenUrl: null })).status, 200);
      assert.equal((await db.enser.findUnique({ where: { id } }))?.imagenUrl, null);
    } finally {
      await db.enser.deleteMany({ where: { id } });
    }
  });
});
