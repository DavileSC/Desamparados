// El historial de versiones y las secciones guardadas del constructor de
// páginas, por la API y contra MariaDB.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { porDefecto } from '../src/domain/contenido.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const SLUG = 'caridad';
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

const cookieCms = (id: number, role: Role) => `${COOKIE_CMS}=${generateToken(id, role, false, 'cms')}`;

async function pedir(ruta: string, cookie: string, opciones: { method?: string; body?: unknown } = {}) {
  return fetch(`${baseUrl}${ruta}`, {
    method: opciones.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
  });
}

test('cada guardado deja una versión con su autor, y la primera guarda también lo de antes', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const redes = await crearUsuarioPrueba(Role.REDES);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: SLUG } });
  const versionesAntes = await db.versionContenido.findMany({ where: { slug: SLUG } });
  await db.versionContenido.deleteMany({ where: { slug: SLUG } });
  try {
    const cookie = cookieCms(redes.id, Role.REDES);
    const documento = porDefecto(SLUG) as { cabecera: { titulo: string }; bloques: unknown[] };
    documento.bloques = [{ tipo: 'texto', titulo: '', html: '<p>Primera</p>', presentacion: { fondo: 'papel' } }];
    assert.equal((await pedir(`/api/contenido/${SLUG}`, cookie, { method: 'PUT', body: { datos: documento } })).status, 200);
    documento.bloques = [{ tipo: 'cita', titulo: '', texto: 'Segunda', autor: '', fuente: '' }];
    assert.equal((await pedir(`/api/contenido/${SLUG}`, cookie, { method: 'PUT', body: { datos: documento } })).status, 200);

    const respuesta = await pedir(`/api/contenido/${SLUG}/versiones`, cookie);
    assert.equal(respuesta.status, 200);
    const versiones = await respuesta.json() as { id: number; autor: string; actual: boolean; bloques: number }[];
    // La de antes de empezar el historial, y las dos guardadas.
    assert.equal(versiones.length, antes ? 3 : 2);
    assert.equal(versiones[0].actual, true);
    assert.equal(versiones[0].autor, 'Prueba Automatica');

    // La penúltima es la primera que se guardó: trae su presentación intacta.
    const primera = await (await pedir(`/api/contenido/${SLUG}/versiones/${versiones[1].id}`, cookie)).json() as { bloques: { presentacion?: { fondo?: string } }[] };
    assert.equal(primera.bloques[0].presentacion?.fondo, 'papel');
  } finally {
    if (antes) await db.contenidoPagina.update({ where: { slug: SLUG }, data: { datos: antes.datos as object } });
    await db.versionContenido.deleteMany({ where: { slug: SLUG } });
    for (const v of versionesAntes) await db.versionContenido.create({ data: { slug: v.slug, datos: v.datos as object, autorId: v.autorId, autorNombre: v.autorNombre, createdAt: v.createdAt } });
    await borrarUsuarioPrueba(redes.id);
  }
});

test('el historial es solo del CMS y una versión de otra página no se sirve', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  assert.equal((await fetch(`${baseUrl}/api/contenido/${SLUG}/versiones`)).status, 401);
  const tesoreria = await crearUsuarioPrueba(Role.TESORERIA);
  const redes = await crearUsuarioPrueba(Role.REDES);
  const ajena = await db.versionContenido.create({ data: { slug: 'cultos', datos: porDefecto('cultos') as object } });
  try {
    assert.equal((await pedir(`/api/contenido/${SLUG}/versiones`, cookieCms(tesoreria.id, Role.TESORERIA))).status, 403);
    assert.equal((await pedir(`/api/contenido/${SLUG}/versiones/${ajena.id}`, cookieCms(redes.id, Role.REDES))).status, 404);
  } finally {
    await db.versionContenido.delete({ where: { id: ajena.id } });
    await borrarUsuarioPrueba(tesoreria.id);
    await borrarUsuarioPrueba(redes.id);
  }
});

test('una sección se guarda validada y saneada, se lista y se borra', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const redes = await crearUsuarioPrueba(Role.REDES);
  const cookie = cookieCms(redes.id, Role.REDES);
  let id: number | null = null;
  try {
    const mala = await pedir('/api/secciones', cookie, { method: 'POST', body: { nombre: 'Rota', bloques: [{ tipo: 'texto', titulo: '', html: '<p>x</p>', presentacion: { fondo: 'fucsia' } }] } });
    assert.equal(mala.status, 400);

    const creada = await pedir('/api/secciones', cookie, {
      method: 'POST',
      body: { nombre: 'Horario de cultos', bloques: [{ tipo: 'texto', titulo: '', html: '<p>Hola</p><script>alert(1)</script>' }] },
    });
    assert.equal(creada.status, 201);
    const seccion = await creada.json() as { id: number; bloques: { html: string }[]; autor: string };
    id = seccion.id;
    assert.ok(!seccion.bloques[0].html.includes('<script'), 'se sanea como en una página');
    assert.equal(seccion.autor, 'Prueba Automatica');

    const lista = await (await pedir('/api/secciones', cookie)).json() as { id: number }[];
    assert.ok(lista.some((s) => s.id === id));

    assert.equal((await pedir(`/api/secciones/${id}`, cookie, { method: 'DELETE' })).status, 204);
    assert.equal(await db.seccionGuardada.count({ where: { id } }), 0);
    id = null;
  } finally {
    if (id !== null) await db.seccionGuardada.delete({ where: { id } });
    await borrarUsuarioPrueba(redes.id);
  }
});

test('las secciones no se abren sin sesión del CMS', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  assert.equal((await fetch(`${baseUrl}/api/secciones`)).status, 401);
});
