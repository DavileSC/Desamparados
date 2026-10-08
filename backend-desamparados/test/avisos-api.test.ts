// Los avisos de la junta y la foto del retablo del Inicio del CMS, contra MariaDB.
// Sin base de datos, los casos que la necesitan se omiten con el motivo a la vista.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { fechaLimite, puedeDarPorHecho } from '../src/domain/avisos.js';
import { ModulosService } from '../src/services/modulos.service.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;
const usuarios: number[] = [];
const avisos: number[] = [];
const eventos: number[] = [];
let retabloAntes: { key: string; value: string; descripcion: string | null }[] = [];

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (dbDisponible) retabloAntes = await db.configuracion.findMany({ where: { key: { startsWith: 'inicio_retablo_' } } });
});

after(async () => {
  if (dbDisponible) {
    await db.avisoJunta.deleteMany({ where: { id: { in: avisos } } });
    await db.evento.deleteMany({ where: { id: { in: eventos } } });
    // La foto del retablo, como estaba antes de las pruebas.
    await db.configuracion.deleteMany({ where: { key: { startsWith: 'inicio_retablo_' } } });
    if (retabloAntes.length) await db.configuracion.createMany({ data: retabloAntes.map(({ key, value, descripcion }) => ({ key, value, descripcion })) });
    for (const id of usuarios) await borrarUsuarioPrueba(id);
  }
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

async function cargo(role: Role) {
  const u = await crearUsuarioPrueba(role);
  usuarios.push(u.id);
  return { id: u.id, cookie: `${COOKIE_CMS}=${generateToken(u.id, role, false, 'cms')}` };
}

const pedir = (ruta: string, cookie: string, method = 'GET', cuerpo?: unknown) =>
  fetch(`${baseUrl}/api/panel${ruta}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
  });

describe('las reglas de los avisos', () => {
  test('lo dan por hecho quien lo recibe, quien lo creó, el Hermano Mayor y Administración', () => {
    const paraTesoreria = { para: Role.TESORERIA, creadoPorId: 7 };
    assert.equal(puedeDarPorHecho(paraTesoreria, { id: 1, role: 'TESORERIA' }), true);
    assert.equal(puedeDarPorHecho(paraTesoreria, { id: 7, role: 'SECRETARIA' }), true, 'quien lo creó');
    assert.equal(puedeDarPorHecho(paraTesoreria, { id: 2, role: 'HERMANO_MAYOR' }), true);
    assert.equal(puedeDarPorHecho(paraTesoreria, { id: 3, role: 'ADMIN' }), true);
    assert.equal(puedeDarPorHecho(paraTesoreria, { id: 4, role: 'REDES' }), false);
    assert.equal(puedeDarPorHecho({ para: null, creadoPorId: 7 }, { id: 4, role: 'REDES' }), true, 'para toda la junta');
  });

  test('la fecha límite tiene que existir', () => {
    assert.equal(fechaLimite('2026-11-20')?.toISOString(), '2026-11-20T00:00:00.000Z');
    assert.equal(fechaLimite('2027-02-31'), null);
    assert.equal(fechaLimite('20/11/2026'), null);
  });
});

describe('los avisos por la API', () => {
  test('se crean, salen en el panel y desaparecen al darlos por hecho', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const secretaria = await cargo(Role.SECRETARIA);

    const creado = await pedir('/avisos', secretaria.cookie, 'POST', { texto: '  ZZ Preparar   el cabildo ', para: 'TESORERIA', hasta: '2026-11-20', urgente: true });
    assert.equal(creado.status, 201);
    const aviso = await creado.json();
    avisos.push(aviso.id);
    assert.deepEqual(
      { texto: aviso.texto, para: aviso.para, hasta: aviso.hasta, urgente: aviso.urgente, creadorRol: aviso.creadorRol, creadoPorId: aviso.creadoPorId },
      { texto: 'ZZ Preparar el cabildo', para: 'TESORERIA', hasta: '2026-11-20', urgente: true, creadorRol: 'SECRETARIA', creadoPorId: secretaria.id },
    );

    const panel = await (await pedir('', secretaria.cookie)).json();
    assert.ok(panel.avisos.some((a: { id: number }) => a.id === aviso.id), 'el aviso sale en el panel');

    const hecho = await pedir(`/avisos/${aviso.id}/hecho`, secretaria.cookie, 'POST');
    assert.equal(hecho.status, 204);
    const despues = await (await pedir('', secretaria.cookie)).json();
    assert.ok(!despues.avisos.some((a: { id: number }) => a.id === aviso.id), 'hecho, ya no sale');
    const fila = await db.avisoJunta.findUnique({ where: { id: aviso.id } });
    assert.equal(fila?.hechoPorId, secretaria.id);
    const auditoria = await db.auditLog.findFirst({ where: { action: 'AVISO_HECHO', entityId: String(aviso.id) } });
    assert.ok(auditoria, 'queda en la auditoría');
  });

  test('otro cargo no puede darlo por hecho', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const secretaria = await cargo(Role.SECRETARIA);
    const redes = await cargo(Role.REDES);
    const aviso = await (await pedir('/avisos', secretaria.cookie, 'POST', { texto: 'ZZ Cuadrar la caja', para: 'TESORERIA' })).json();
    avisos.push(aviso.id);
    const respuesta = await pedir(`/avisos/${aviso.id}/hecho`, redes.cookie, 'POST');
    assert.equal(respuesta.status, 403);
    assert.equal((await db.avisoJunta.findUnique({ where: { id: aviso.id } }))?.hechoAt, null);
  });

  test('sin texto, con etiquetas, con un cargo que no es de la junta o con una fecha imposible, no', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const secretaria = await cargo(Role.SECRETARIA);
    for (const cuerpo of [
      { texto: '   ', para: null },
      { texto: '<b>Hola</b>', para: null },
      { texto: 'ZZ Algo', para: 'USER' },
      { texto: 'x'.repeat(161), para: null },
      { texto: 'ZZ Algo', para: null, hasta: '2027-02-31' },
    ]) {
      const respuesta = await pedir('/avisos', secretaria.cookie, 'POST', cuerpo);
      assert.equal(respuesta.status, 400, JSON.stringify(cuerpo));
    }
  });
});

describe('la foto del retablo', () => {
  test('el Hermano Mayor la cambia con su punto; el panel la trae; vacía, vuelve la de siempre', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const hm = await cargo(Role.HERMANO_MAYOR);
    const guardado = await pedir('/retablo', hm.cookie, 'PUT', { foto: '/storage/public/0123456789abcdef0123456789abcdef.webp', x: 47.4, y: 56 });
    assert.equal(guardado.status, 200);
    const { foto, x, y } = await guardado.json();
    assert.deepEqual({ foto, x, y }, { foto: '/storage/public/0123456789abcdef0123456789abcdef.webp', x: 47, y: 56 });
    const panel = await (await pedir('', hm.cookie)).json();
    assert.deepEqual({ ...panel.retablo, cuenta: undefined }, { foto: '/storage/public/0123456789abcdef0123456789abcdef.webp', x: 47, y: 56, cuenta: undefined });

    const quitada = await (await pedir('/retablo', hm.cookie, 'PUT', { foto: '', x: 50, y: 30 })).json();
    assert.equal(quitada.foto, null);
  });

  test('una foto de fuera o un punto fuera de la foto, no; y el resto de la junta no la cambia', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const hm = await cargo(Role.HERMANO_MAYOR);
    assert.equal((await pedir('/retablo', hm.cookie, 'PUT', { foto: 'https://otra-web.com/foto.jpg', x: 50, y: 50 })).status, 400);
    assert.equal((await pedir('/retablo', hm.cookie, 'PUT', { foto: null, x: 120, y: 50 })).status, 400);
    const redes = await cargo(Role.REDES);
    assert.equal((await pedir('/retablo', redes.cookie, 'PUT', { foto: null, x: 50, y: 50 })).status, 403);
  });
});

describe('quién lee y ajusta el retablo (SA5)', () => {
  test('sin sesión, 401; el resto de la junta ni lo lee ni lo guarda; Administración y el Hermano Mayor, sí', async (t) => {
    assert.equal((await fetch(`${baseUrl}/api/panel/retablo`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/panel/retablo`, { method: 'PUT' })).status, 401);
    if (!dbDisponible) return t.skip(SIN_DB);
    for (const rol of [Role.SECRETARIA, Role.TESORERIA, Role.REDES, Role.ALBACERIA, Role.USER]) {
      const otro = await cargo(rol);
      assert.equal((await pedir('/retablo', otro.cookie)).status, 403, `${rol} no lee los ajustes`);
      assert.equal((await pedir('/retablo', otro.cookie, 'PUT', { foto: null, x: 50, y: 50 })).status, 403, `${rol} no los guarda`);
    }
    for (const rol of [Role.ADMIN, Role.HERMANO_MAYOR]) {
      const quien = await cargo(rol);
      const leido = await pedir('/retablo', quien.cookie);
      assert.equal(leido.status, 200, rol);
      const ajustes = await leido.json() as { x: number; y: number; opciones: unknown };
      assert.ok(ajustes.opciones, 'con las opciones para el formulario');
      assert.equal((await pedir('/retablo', quien.cookie, 'PUT', { foto: null, x: ajustes.x, y: ajustes.y })).status, 200, rol);
    }
  });
});

describe('los tiempos y la cuenta atrás del retablo', () => {
  const FOTO_CUARESMA = '/storage/public/11111111111111111111111111111111.webp';
  const FOTO_TODO_EL_ANIO = '/storage/public/22222222222222222222222222222222.webp';
  // Un mes a mano que siempre incluye hoy: así la foto de hoy es la suya sea cuando sea.
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const mm = hoy.slice(5, 7);
  const ESTE_MES = { tiempo: 'a-mano', nombre: 'Este mes', desde: `${mm}-01`, hasta: `${mm}-28`, foto: FOTO_CUARESMA, x: 40, y: 20 };

  test('se guardan con la foto de todo el año, y el Inicio recibe la foto que toca hoy', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    if (Number(hoy.slice(8, 10)) > 28) return t.skip('los días 29 a 31 caen fuera del mes de prueba');
    const hm = await cargo(Role.HERMANO_MAYOR);
    const guardado = await pedir('/retablo', hm.cookie, 'PUT', {
      foto: FOTO_TODO_EL_ANIO, x: 50, y: 30, tiempos: [{ tiempo: 'cuaresma', foto: FOTO_CUARESMA, x: 50, y: 30 }, ESTE_MES], cuenta: { tipo: 'ninguna' },
    });
    assert.equal(guardado.status, 200);
    const ajustes = await guardado.json();
    assert.equal(ajustes.tiempos.length, 2);
    assert.deepEqual(ajustes.cuenta, { tipo: 'ninguna' });
    assert.ok('opciones' in ajustes);

    const panel = await (await pedir('', hm.cookie)).json();
    assert.deepEqual(panel.retablo, { foto: FOTO_CUARESMA, x: 40, y: 20, cuenta: null });

    // Un cliente que solo manda la foto no borra los tiempos ni la cuenta.
    await pedir('/retablo', hm.cookie, 'PUT', { foto: FOTO_TODO_EL_ANIO, x: 60, y: 30 });
    const leido = await (await pedir('/retablo', hm.cookie)).json();
    assert.equal(leido.tiempos.length, 2);
    assert.deepEqual(leido.cuenta, { tipo: 'ninguna' });
  });

  test('la cuenta atrás hasta un acto de la Agenda lleva su nombre y su día', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const hm = await cargo(Role.HERMANO_MAYOR);
    const acto = await db.evento.create({ data: { title: 'Triduo de prueba', startDate: new Date(Date.now() + 20 * 86400000) } });
    eventos.push(acto.id);
    await pedir('/retablo', hm.cookie, 'PUT', { foto: null, x: 50, y: 30, tiempos: [], cuenta: { tipo: 'acto', eventoId: acto.id } });
    const panel = await (await pedir('', hm.cookie)).json();
    ModulosService.olvidar();
    if (await ModulosService.activo('agenda')) {
      assert.equal(panel.retablo.cuenta.nombre, 'Triduo de prueba');
      assert.equal(panel.retablo.cuenta.articulo, null);
      assert.match(panel.retablo.cuenta.fecha, /^\d{4}-\d{2}-\d{2}$/);
    } else {
      assert.equal(panel.retablo.cuenta, null);
    }
  });

  test('un tiempo sin foto, uno calculado repetido o un día que no existe, no', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const hm = await cargo(Role.HERMANO_MAYOR);
    const con = (tiempos: unknown[]) => pedir('/retablo', hm.cookie, 'PUT', { foto: null, x: 50, y: 30, tiempos });
    assert.equal((await con([{ tiempo: 'navidad', foto: '', x: 50, y: 30 }])).status, 400);
    assert.equal((await con([{ tiempo: 'navidad', foto: FOTO_CUARESMA, x: 50, y: 30 }, { tiempo: 'navidad', foto: FOTO_CUARESMA, x: 50, y: 30 }])).status, 400);
    assert.equal((await con([{ ...ESTE_MES, hasta: '02-30' }])).status, 400);
    assert.equal((await con([{ tiempo: 'navidad', foto: 'https://otra-web.com/foto.jpg', x: 50, y: 30 }])).status, 400);
  });
});
