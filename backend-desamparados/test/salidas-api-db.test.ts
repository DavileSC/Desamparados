// test/salidas-api-db.test.ts
//
// La API de las salidas contra MariaDB: Secretaría da de alta, edita y fija
// la fecha a mano de una salida; un hermano raso no puede escribir; el slug
// repetido es 409; una PASCUA sin días desde la Pascua es 400; desactivar
// quita la salida de la web pública pero no del CMS.

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
import { PASION } from './fixtures/salidas.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
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
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

// El rol del token no decide nada por sí mismo (`validateSessionAgainstDb` lo
// repone con el de la base), pero `generateToken` lo exige: se pasa el mismo
// con el que se creó el usuario de prueba.
const cookieDe = (userId: number, role: Role) => ({ Cookie: `${COOKIE_CMS}=${generateToken(userId, role)}`, 'Content-Type': 'application/json' });

/** Los datos mínimos de un alta, con el slug de prueba de cada test. */
const datosDeAlta = (slug: string, extra: Record<string, unknown> = {}) => ({
  nombre: 'Traslado',
  slug,
  orden: 9,
  activa: true,
  conRopa: false,
  cobro: 'CUOTA',
  importeCuota: 0,
  fecha: 'PASCUA',
  diasDesdePascua: -10,
  horaSalida: null,
  lugar: null,
  puestos: [{ nombre: 'Acompañante', tunica: false, tocado: null, alturaHombro: false }],
  indicaciones: null,
  ...extra,
});

test('Secretaría da de alta una salida y sale en /api/salidas con su fecha del año', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const slug = `prueba-salida-${Date.now()}`;
  try {
    const alta = await fetch(`${baseUrl}/api/cms/salidas`, {
      method: 'POST',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify(datosDeAlta(slug)),
    });
    assert.equal(alta.status, 201);

    const lista = await (await fetch(`${baseUrl}/api/salidas`, { headers: cookieDe(staff.id, Role.SECRETARIA) })).json();
    const nueva = lista.find((s: { slug: string }) => s.slug === slug);
    assert.ok(nueva);
    assert.match(nueva.fechaDelAnio, /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    await db.salida.deleteMany({ where: { slug } });
    await borrarUsuarioPrueba(staff.id);
  }
});

test('un hermano no puede dar de alta salidas', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const usuario = await crearUsuarioPrueba(Role.USER);
  const slug = `prueba-salida-${Date.now()}`;
  try {
    const res = await fetch(`${baseUrl}/api/cms/salidas`, {
      method: 'POST',
      headers: cookieDe(usuario.id, Role.USER),
      body: JSON.stringify(datosDeAlta(slug)),
    });
    assert.equal(res.status, 403);
  } finally {
    await db.salida.deleteMany({ where: { slug } });
    await borrarUsuarioPrueba(usuario.id);
  }
});

test('el slug repetido da 409', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    const res = await fetch(`${baseUrl}/api/cms/salidas`, {
      method: 'POST',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify(datosDeAlta(PASION)),
    });
    assert.equal(res.status, 409);
    const cuerpo = await res.json();
    assert.match(cuerpo.error, /Ya hay una salida con ese nombre corto\./);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('con PASCUA y sin días desde la Pascua, 400', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const slug = `prueba-salida-${Date.now()}`;
  try {
    const res = await fetch(`${baseUrl}/api/cms/salidas`, {
      method: 'POST',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify(datosDeAlta(slug, { diasDesdePascua: null })),
    });
    assert.equal(res.status, 400);
  } finally {
    await db.salida.deleteMany({ where: { slug } });
    await borrarUsuarioPrueba(staff.id);
  }
});

// Lo que Secretaría escribe en el catálogo tiene que pasar luego por las
// reglas de la solicitud (un puesto de más de 80, o con «<», daría 400 a todo
// hermano que lo pidiera) y por las de `Evento.location` (191 como mucho).
for (const [caso, extra] of [
  ['un puesto de 81 caracteres', { puestos: [{ nombre: 'x'.repeat(81), tunica: false, tocado: null, alturaHombro: false }] }],
  ['un «<» en el nombre', { nombre: 'Traslado <b>' }],
  ['un lugar de 161 caracteres', { lugar: 'x'.repeat(161) }],
  ['21 puestos', { puestos: Array.from({ length: 21 }, (_, i) => ({ nombre: `Puesto ${i}`, tunica: false, tocado: null, alturaHombro: false })) }],
] as const) {
  test(`al dar de alta, ${caso} da 400`, async (t) => {
    if (!dbDisponible) { t.skip(SIN_DB); return; }
    const staff = await crearUsuarioPrueba(Role.SECRETARIA);
    const slug = `prueba-salida-${Date.now()}`;
    try {
      const res = await fetch(`${baseUrl}/api/cms/salidas`, {
        method: 'POST',
        headers: cookieDe(staff.id, Role.SECRETARIA),
        body: JSON.stringify(datosDeAlta(slug, extra)),
      });
      assert.equal(res.status, 400);
    } finally {
      await db.salida.deleteMany({ where: { slug } });
      await borrarUsuarioPrueba(staff.id);
    }
  });
}

test('al fijar la fecha, un lugar de 161 caracteres da 400', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const slug = `prueba-salida-${Date.now()}`;
  try {
    const alta = await fetch(`${baseUrl}/api/cms/salidas`, {
      method: 'POST',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify(datosDeAlta(slug, { fecha: 'MANUAL', diasDesdePascua: null })),
    });
    assert.equal(alta.status, 201);
    const { id } = await alta.json();
    const res = await fetch(`${baseUrl}/api/cms/salidas/${id}/fecha`, {
      method: 'PUT',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify({ inicio: '2099-10-17T18:00:00.000Z', lugar: 'x'.repeat(161) }),
    });
    assert.equal(res.status, 400);
    const fila = await db.salida.findUniqueOrThrow({ where: { id } });
    assert.equal(fila.eventoId, null, 'no se crea el acto');
  } finally {
    await db.salida.deleteMany({ where: { slug } });
    await borrarUsuarioPrueba(staff.id);
  }
});

test('desactivar una salida la quita de /api/salidas, pero no de /api/cms/salidas', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const slug = `prueba-salida-${Date.now()}`;
  try {
    const alta = await fetch(`${baseUrl}/api/cms/salidas`, {
      method: 'POST',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify(datosDeAlta(slug)),
    });
    assert.equal(alta.status, 201);
    const { id } = await alta.json();

    const edicion = await fetch(`${baseUrl}/api/cms/salidas/${id}`, {
      method: 'PUT',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify({ activa: false }),
    });
    assert.equal(edicion.status, 200);

    const web = await (await fetch(`${baseUrl}/api/salidas`, { headers: cookieDe(staff.id, Role.SECRETARIA) })).json();
    assert.ok(!web.some((s: { slug: string }) => s.slug === slug));

    const cms = await (await fetch(`${baseUrl}/api/cms/salidas`, { headers: cookieDe(staff.id, Role.SECRETARIA) })).json();
    assert.ok(cms.some((s: { slug: string }) => s.slug === slug));
  } finally {
    await db.salida.deleteMany({ where: { slug } });
    await borrarUsuarioPrueba(staff.id);
  }
});

test('desactivar una salida con el plazo abierto lo deja cerrado', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const slug = `prueba-salida-${Date.now()}`;
  try {
    const alta = await fetch(`${baseUrl}/api/cms/salidas`, {
      method: 'POST',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify(datosDeAlta(slug)),
    });
    assert.equal(alta.status, 201);
    const { id } = await alta.json();
    // Abierto a mano: abrirlo por la API pediría días de reparto.
    await db.salida.update({ where: { id }, data: { plazoAbierto: true, plazoCambiadoEl: new Date(Date.now() - 60_000) } });
    const desde = new Date();

    const edicion = await fetch(`${baseUrl}/api/cms/salidas/${id}`, {
      method: 'PUT',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify({ activa: false }),
    });
    assert.equal(edicion.status, 200);

    const fila = await db.salida.findUniqueOrThrow({ where: { id } });
    assert.equal(fila.activa, false);
    assert.equal(fila.plazoAbierto, false, 'desactivarla cierra el plazo');
    assert.ok(fila.plazoCambiadoEl && fila.plazoCambiadoEl >= new Date(desde.getTime() - 1000), 'el cierre queda fechado');
  } finally {
    await db.salida.deleteMany({ where: { slug } });
    await borrarUsuarioPrueba(staff.id);
  }
});

test('fijar la fecha de una salida a mano crea su acto en la Agenda', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const slug = `prueba-salida-${Date.now()}`;
  let eventoId: number | null = null;
  try {
    const alta = await fetch(`${baseUrl}/api/cms/salidas`, {
      method: 'POST',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify(datosDeAlta(slug, { fecha: 'MANUAL', diasDesdePascua: null })),
    });
    assert.equal(alta.status, 201);
    const { id, nombre } = await alta.json();

    const fechada = await fetch(`${baseUrl}/api/cms/salidas/${id}/fecha`, {
      method: 'PUT',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify({ inicio: '2099-10-17T18:00:00.000Z', lugar: 'Templo' }),
    });
    assert.equal(fechada.status, 200);
    // La respuesta trae el acto ya enlazado: el CMS lo necesita para rellenar
    // la fecha, la hora y el lugar ya fijados al volver a abrir la ficha.
    const cuerpo = await fechada.json();
    assert.equal(cuerpo.acto?.lugar, 'Templo');
    assert.ok(cuerpo.acto?.inicio);

    const fila = await db.salida.findUniqueOrThrow({ where: { id } });
    assert.ok(fila.eventoId);
    eventoId = fila.eventoId;
    const evento = await db.evento.findUniqueOrThrow({ where: { id: fila.eventoId! } });
    assert.equal(evento.title, nombre);
    assert.equal(evento.location, 'Templo');
  } finally {
    await db.salida.deleteMany({ where: { slug } });
    if (eventoId) await db.evento.deleteMany({ where: { id: eventoId } });
    await borrarUsuarioPrueba(staff.id);
  }
});

test('fijar la fecha de otro año crea un acto nuevo y deja el viejo en la Agenda', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const slug = `prueba-salida-${Date.now()}`;
  const eventos: number[] = [];
  try {
    const alta = await fetch(`${baseUrl}/api/cms/salidas`, {
      method: 'POST',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify(datosDeAlta(slug, { fecha: 'MANUAL', diasDesdePascua: null })),
    });
    assert.equal(alta.status, 201);
    const { id } = await alta.json();
    const fijar = (inicio: string) => fetch(`${baseUrl}/api/cms/salidas/${id}/fecha`, {
      method: 'PUT',
      headers: cookieDe(staff.id, Role.SECRETARIA),
      body: JSON.stringify({ inicio, lugar: 'Templo' }),
    });

    assert.equal((await fijar('2098-10-17T18:00:00.000Z')).status, 200);
    const de2098 = (await db.salida.findUniqueOrThrow({ where: { id } })).eventoId!;
    eventos.push(de2098);
    // El mismo año: se mueve el acto, no se crea otro.
    assert.equal((await fijar('2098-10-24T18:00:00.000Z')).status, 200);
    assert.equal((await db.salida.findUniqueOrThrow({ where: { id } })).eventoId, de2098);

    assert.equal((await fijar('2099-10-16T18:00:00.000Z')).status, 200);
    const de2099 = (await db.salida.findUniqueOrThrow({ where: { id } })).eventoId!;
    eventos.push(de2099);
    assert.notEqual(de2099, de2098, 'otro año, otro acto');
    const viejo = await db.evento.findUniqueOrThrow({ where: { id: de2098 } });
    assert.equal(viejo.startDate.toISOString(), '2098-10-24T18:00:00.000Z', 'el de 2098 se queda como estaba');
    const nuevo = await db.evento.findUniqueOrThrow({ where: { id: de2099 } });
    assert.equal(nuevo.startDate.toISOString(), '2099-10-16T18:00:00.000Z');
  } finally {
    await db.salida.deleteMany({ where: { slug } });
    if (eventos.length) await db.evento.deleteMany({ where: { id: { in: eventos } } });
    await borrarUsuarioPrueba(staff.id);
  }
});
