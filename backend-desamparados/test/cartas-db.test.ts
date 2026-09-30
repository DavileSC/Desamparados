// Las cartas y circulares, de punta a punta (octubre de 2026): a quién van
// (la búsqueda del censo, nunca a un difunto, con la dirección del titular
// para quien no la tiene), el PDF de prueba y el de todas, y guardarlas.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { CartasService } from '../src/services/cartas/cartas.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

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
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

const paginas = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

test('las cartas: a quién, el PDF de prueba y el de todas, y guardarlas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
  const albacea = await crearUsuarioPrueba(Role.ALBACERIA);
  const cuenta = await crearUsuarioPrueba(Role.USER);
  const marca = `Cartas${Date.now().toString(36)}`;
  const base = { userId: cuenta.id, fechaNacimiento: new Date(Date.UTC(1980, 0, 1)) };
  const padre = await db.hermano.create({ data: { ...base, nombre: 'Luis', apellidos: `${marca} Alba`, esTitular: true, activo: true, direccion: 'C. Larios, 1', codigoPostal: '29005', poblacion: 'Málaga' } });
  const hija = await db.hermano.create({ data: { ...base, nombre: 'Marta', apellidos: `${marca} Alba`, esTitular: false, parentesco: 'HIJO', activo: true, fechaNacimiento: new Date(Date.UTC(2015, 0, 1)) } });
  const difunto = await db.hermano.create({ data: { ...base, nombre: 'Pedro', apellidos: `${marca} Alba`, esTitular: false, activo: false, fechaBaja: new Date(), motivoBaja: 'FALLECIMIENTO' } });
  const como = (userId: number, rol: Role, ruta: string, init: { method?: string; json?: unknown } = {}) => fetch(`${baseUrl}/api/cartas${ruta}`, {
    method: init.method ?? 'GET',
    headers: { Cookie: `${COOKIE_CMS}=${generateToken(userId, rol)}`, ...(init.json !== undefined && { 'Content-Type': 'application/json' }) },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  const texto = { asunto: 'Convocatoria', cuerpo: '{{saludo}} {{nombre}}:\n\nLe convocamos.', firmaCargo: 'El Secretario', firmaNombre: null };
  const cartas: number[] = [];
  try {
    // A quién: la búsqueda, nunca el difunto; a la hija, la dirección del padre.
    const todos = await CartasService.destinatarios(`q=${marca}`);
    assert.deepEqual(todos.map((d) => d.nombre), ['Luis', 'Marta']);
    assert.equal(todos[1].direccion, 'C. Larios, 1', 'la hija, con la dirección del titular');
    assert.deepEqual((await CartasService.destinatarios(`q=${marca}&estado=baja`)).map((d) => d.nombre), [], 'ni pidiendo las bajas sale el difunto');

    const recuento = await como(secretaria.id, Role.SECRETARIA, `/destinatarios?consulta=${encodeURIComponent(`q=${marca}`)}`);
    assert.deepEqual(await recuento.json(), { total: 2, demasiados: false, sinDireccion: 0 });

    // El PDF: la prueba, una hoja; todas, una por hermano, y queda en la auditoría.
    const prueba = await como(secretaria.id, Role.SECRETARIA, '/pdf', { method: 'POST', json: { ...texto, consulta: `q=${marca}`, prueba: true } });
    assert.equal(prueba.status, 200);
    assert.equal(prueba.headers.get('content-type'), 'application/pdf');
    assert.equal(paginas(Buffer.from(await prueba.arrayBuffer())), 1);
    const todas = await como(secretaria.id, Role.SECRETARIA, '/pdf', { method: 'POST', json: { ...texto, consulta: `q=${marca}` } });
    assert.equal(paginas(Buffer.from(await todas.arrayBuffer())), 2);
    assert.equal(await db.auditLog.count({ where: { userId: secretaria.id, action: 'CARTAS_GENERAR' } }), 1, 'la prueba no cuenta; las de verdad, sí');
    assert.equal((await como(secretaria.id, Role.SECRETARIA, '/pdf', { method: 'POST', json: { ...texto, consulta: 'q=NadieSeLlamaAsi123' } })).status, 404);

    // Solo quien gestiona el censo.
    assert.equal((await como(albacea.id, Role.ALBACERIA, '/')).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/cartas`)).status, 401);

    // Guardarla, cambiarla y borrarla; la consulta se queda con los filtros del censo.
    const creada = await (await como(secretaria.id, Role.SECRETARIA, '/', { method: 'POST', json: { ...texto, nombre: `ZZ ${marca}`, consulta: 'estado=activo&ficha=3' } })).json() as { id: number; consulta: string };
    cartas.push(creada.id);
    assert.equal(creada.consulta, 'estado=activo');
    const cambiada = await (await como(secretaria.id, Role.SECRETARIA, `/${creada.id}`, { method: 'PUT', json: { ...texto, asunto: 'Otra', nombre: `ZZ ${marca}`, consulta: '' } })).json() as { asunto: string };
    assert.equal(cambiada.asunto, 'Otra');
    assert.equal((await como(secretaria.id, Role.SECRETARIA, `/${creada.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await como(secretaria.id, Role.SECRETARIA, `/${creada.id}`, { method: 'DELETE' })).status, 404);
  } finally {
    await db.carta.deleteMany({ where: { id: { in: cartas } } });
    await db.auditLog.deleteMany({ where: { userId: secretaria.id } });
    await db.hermano.deleteMany({ where: { id: { in: [padre.id, hija.id, difunto.id] } } });
    for (const u of [secretaria, albacea, cuenta]) await borrarUsuarioPrueba(u.id);
  }
});
