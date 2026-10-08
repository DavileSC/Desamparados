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
import { SIN_DB } from './fixtures/sin-db.js';

let server: Server;
let baseUrl: string;
let dbDisponible = false;
const usuarios: Partial<Record<Role, number>> = {};
let hermanoId = 0;
// Un número de hermano que no choque con los de la base de desarrollo.
const numeroHermano = 900_000_000 + randomInt(0, 99_999_999);
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
const esRopero = (ruta: string) => ['/prendas', '/hermanos', '/recuento', '/cingulos'].some((r) => ruta.startsWith(r));
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
    assert.equal((await como(Role.USER, '/hermanos?q=prueba')).status, 403);
    assert.equal((await como(Role.USER, '/recuento')).status, 403);
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

  test('se busca al hermano por su nombre y apellidos antes de prestar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como(Role.ALBACERIA, `/hermanos?q=${encodeURIComponent('hermano prueba ropero')}`);
    assert.equal(res.status, 200);
    const encontrados = await res.json() as { id: number; numeroHermano: number; gestor: string | null; prendas: unknown[] }[];
    const suyo = encontrados.find((h) => h.id === hermanoId);
    assert.ok(suyo, 'las palabras valen en cualquier orden y repartidas entre nombre y apellidos');
    assert.equal(suyo.numeroHermano, numeroHermano, 'con su número, para distinguir a dos que se llaman igual');
    assert.ok(suyo.gestor, 'su cuenta la lleva otro: se dice quién');
    assert.deepEqual(suyo.prendas, []);

    // Una letra sola no busca: saldría medio censo.
    assert.deepEqual(await (await como(Role.ALBACERIA, '/hermanos?q=a')).json(), []);
  });

  test('prestar, editar y devolver: el estado solo lo cambian «Asignar» y «Devolver»', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const alta = await como(Role.ALBACERIA, '/prendas', 'POST', { numero: numeroPrenda, tipo: 'TUNICA', talla: '1.80m' });
    assert.equal(alta.status, 201, await alta.clone().text());
    prendaId = ((await alta.json()) as { id: number }).id;

    // Editando no se presta: quedaría prestada a nadie.
    assert.equal((await como(Role.ALBACERIA, `/prendas/${prendaId}`, 'PUT', { estado: 'PRESTADA' })).status, 400);

    const asignar = await como(Role.ALBACERIA, `/prendas/${prendaId}/asignar`, 'POST', { hermanoId });
    assert.equal(asignar.status, 200, await asignar.clone().text());
    const prestada = ((await asignar.json()) as { data: { estado: string; hermano: { numeroHermano: number } } }).data;
    assert.equal(prestada.estado, 'PRESTADA');
    assert.equal(prestada.hermano.numeroHermano, numeroHermano);

    // Ya prestada, no se presta otra vez.
    assert.equal((await como(Role.ALBACERIA, `/prendas/${prendaId}/asignar`, 'POST', { hermanoId })).status, 400);

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

  // Cada una con su prenda: antes dependían de la que creaba la prueba de
  // arriba y, si esa fallaba, se omitían en vez de fallar (SA4).
  test('prestar a un hermano que no existe responde 404 y no toca la prenda', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const propia = await db.prenda.create({ data: { numero: `${numeroPrenda}-404`, tipo: 'TUNICA', estado: 'DISPONIBLE' } });
    try {
      const res = await como(Role.ALBACERIA, `/prendas/${propia.id}/asignar`, 'POST', { hermanoId: 2_000_000_000 });
      assert.equal(res.status, 404);
      const prenda = await db.prenda.findUnique({ where: { id: propia.id } });
      assert.equal(prenda?.estado, 'DISPONIBLE');
      assert.equal(prenda?.hermanoId, null);
    } finally {
      await db.prenda.deleteMany({ where: { id: propia.id } });
    }
  });

  test('ya no se presta tecleando el número de hermano', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const propia = await db.prenda.create({ data: { numero: `${numeroPrenda}-NUM`, tipo: 'TUNICA', estado: 'DISPONIBLE' } });
    try {
      assert.equal((await como(Role.ALBACERIA, `/prendas/${propia.id}/asignar`, 'POST', { numeroHermano })).status, 400);
      assert.equal((await db.prenda.findUnique({ where: { id: propia.id } }))?.estado, 'DISPONIBLE');
    } finally {
      await db.prenda.deleteMany({ where: { id: propia.id } });
    }
  });

  // NG9 (auditoría 07-10-2026): se borraba una prenda que seguía en casa de un
  // hermano y con ella el único rastro de quién la tenía.
  test('una prenda prestada no se borra: se ofrece darla de baja', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const otra = await db.prenda.create({ data: { numero: `${numeroPrenda}-B`, tipo: 'TUNICA', estado: 'PRESTADA', hermanoId, fechaAsignacion: new Date() } });
    try {
      const res = await como(Role.ALBACERIA, `/prendas/${otra.id}`, 'DELETE');
      assert.equal(res.status, 409);
      assert.match(((await res.json()) as { error: string }).error, /baja/i);
      assert.ok(await db.prenda.findUnique({ where: { id: otra.id } }), 'sigue en el ropero');

      await db.prenda.update({ where: { id: otra.id }, data: { estado: 'DISPONIBLE', hermanoId: null } });
      assert.equal((await como(Role.ALBACERIA, `/prendas/${otra.id}`, 'DELETE')).status, 200);
    } finally {
      await db.prenda.deleteMany({ where: { id: otra.id } });
    }
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

describe('recuento del ropero', () => {
  test('cuenta las prendas de cada tipo por estado, y suman el total del tipo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const numero = `REC-${Date.now()}`;
    const p = await db.prenda.create({ data: { numero, tipo: 'FARAONA', estado: 'TALLER' } });
    try {
      const res = await como(Role.ALBACERIA, '/recuento');
      assert.equal(res.status, 200);
      const grupos = await res.json() as { tipo: string; total: number; estados: Record<string, number> }[];
      const faraonas = grupos.find((g) => g.tipo === 'FARAONA');
      assert.ok(faraonas && (faraonas.estados.TALLER ?? 0) >= 1);
      for (const g of grupos) assert.equal(Object.values(g.estados).reduce((a, b) => a + b, 0), g.total, g.tipo);
    } finally {
      await db.prenda.delete({ where: { id: p.id } });
    }
  });
});

// SA5: las dos acciones del ropero que no tenían prueba HTTP.
describe('lavado y cíngulos (SA5)', () => {
  test('sin sesión y sin cargo de patrimonio no se tocan', async (t) => {
    assert.equal((await fetch(`${baseUrl}/api/ropero/prendas/lavadas`, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/ropero/cingulos`, { method: 'PUT' })).status, 401);
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await como(Role.USER, '/prendas/lavadas', 'POST', { ids: [1] })).status, 403);
    assert.equal((await como(Role.USER, '/cingulos', 'PUT', { total: 10 })).status, 403);
  });

  test('marcar lavadas devuelve a disponible solo las del lavado que se nombran', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Siempre con ids: sin ellos se marcan TODAS las del lavado, también las
    // de la base de desarrollo.
    const [lavada, otraLavada, enTaller] = await Promise.all([
      db.prenda.create({ data: { numero: `${numeroPrenda}-L1`, tipo: 'TUNICA', estado: 'LAVADO' } }),
      db.prenda.create({ data: { numero: `${numeroPrenda}-L2`, tipo: 'TUNICA', estado: 'LAVADO' } }),
      db.prenda.create({ data: { numero: `${numeroPrenda}-T1`, tipo: 'TUNICA', estado: 'TALLER' } }),
    ]);
    try {
      const res = await como(Role.ALBACERIA, '/prendas/lavadas', 'POST', { ids: [lavada.id, enTaller.id] });
      assert.equal(res.status, 200, await res.clone().text());
      assert.deepEqual(await res.json(), { ids: [lavada.id], lavadas: 1 }, 'la del taller no estaba en el lavado');
      const estados = Object.fromEntries((await db.prenda.findMany({ where: { id: { in: [lavada.id, otraLavada.id, enTaller.id] } } })).map((p) => [p.id, p.estado]));
      assert.equal(estados[lavada.id], 'DISPONIBLE');
      assert.equal(estados[otraLavada.id], 'LAVADO', 'la que no se nombra sigue en el lavado');
      assert.equal(estados[enTaller.id], 'TALLER');

      assert.equal((await como(Role.ALBACERIA, '/prendas/lavadas', 'POST', { ids: [0] })).status, 400);
    } finally {
      await db.prenda.deleteMany({ where: { id: { in: [lavada.id, otraLavada.id, enTaller.id] } } });
    }
  });

  test('el total de cíngulos se cambia, se valida y no baja de los prestados', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = await db.configuracion.findUnique({ where: { key: 'cingulos_total' } });
    try {
      const recuento = await (await como(Role.ALBACERIA, '/cingulos')).json() as { total: number; prestados: number };
      const nuevo = recuento.prestados + 3;
      const res = await como(Role.ALBACERIA, '/cingulos', 'PUT', { total: nuevo });
      assert.equal(res.status, 200, await res.clone().text());
      const despues = await res.json() as { total: number; enElRopero: number; prestados: number };
      assert.equal(despues.total, nuevo);
      assert.equal(despues.enElRopero, 3);

      for (const total of [-1, 5001, 2.5, 'diez']) {
        assert.equal((await como(Role.ALBACERIA, '/cingulos', 'PUT', { total })).status, 400, String(total));
      }
      if (recuento.prestados > 0) {
        assert.equal((await como(Role.ALBACERIA, '/cingulos', 'PUT', { total: recuento.prestados - 1 })).status, 409);
      }
    } finally {
      if (antes) await db.configuracion.update({ where: { key: 'cingulos_total' }, data: { value: antes.value } });
      else await db.configuracion.deleteMany({ where: { key: 'cingulos_total' } });
    }
  });
});
