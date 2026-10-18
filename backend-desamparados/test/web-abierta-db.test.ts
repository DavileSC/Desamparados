// Abrir y cerrar la web contra MariaDB: sin fila está abierta, se lee sin
// sesión, solo la abren el Hermano Mayor y Administración, queda en la
// auditoría y, cerrada, el sitemap no anuncia nada.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { WebAbiertaService } from '../src/services/web-abierta.service.js';
import { depurarEstado, esDiaValido, TOPE_MENSAJE_PROXIMAMENTE, WEB_ABIERTA } from '../src/domain/web-abierta.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const CLAVE = 'estado_de_la_web';
let server: Server;
let baseUrl: string;
let dbDisponible = false;
let filaAntes: { value: string; descripcion: string | null } | null = null;
const usuarios: Partial<Record<'ADMIN' | 'HERMANO_MAYOR' | 'REDES', number>> = {};

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (!dbDisponible) return;
  filaAntes = await db.configuracion.findUnique({ where: { key: CLAVE }, select: { value: true, descripcion: true } });
  for (const rol of ['ADMIN', 'HERMANO_MAYOR', 'REDES'] as const) usuarios[rol] = (await crearUsuarioPrueba(Role[rol])).id;
});

after(async () => {
  server.close();
  if (dbDisponible) {
    // Como estaba: la base de desarrollo puede tener la web cerrada a propósito.
    if (filaAntes) await db.configuracion.update({ where: { key: CLAVE }, data: filaAntes });
    else await db.configuracion.deleteMany({ where: { key: CLAVE } });
    WebAbiertaService.olvidar();
    await db.auditLog.deleteMany({
      where: { action: { in: [ACCIONES_AUDITORIA.WEB_ABRIR, ACCIONES_AUDITORIA.WEB_CERRAR] }, userId: { in: Object.values(usuarios) } },
    });
    for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

async function pedir(ruta: string, { rol, metodo = 'GET', cuerpo }: { rol?: keyof typeof usuarios; metodo?: string; cuerpo?: unknown } = {}) {
  const res = await fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: {
      ...(rol ? { Cookie: `${COOKIE_CMS}=${generateToken(usuarios[rol]!, rol)}` } : {}),
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  const json = res.headers.get('content-type')?.includes('json');
  return { status: res.status, cache: res.headers.get('cache-control'), cuerpo: texto && json ? JSON.parse(texto) : texto };
}

const guardar = (rol: keyof typeof usuarios, estado: unknown) => pedir('/api/cms/web', { rol, metodo: 'PUT', cuerpo: estado });

describe('depurarEstado', () => {
  test('solo cierra con `abierta: false` escrito así, y tira lo que no vale', () => {
    assert.deepEqual(depurarEstado(null), WEB_ABIERTA);
    assert.deepEqual(depurarEstado(['abierta']), WEB_ABIERTA);
    assert.deepEqual(depurarEstado({ abierta: 'no' }), WEB_ABIERTA);
    assert.deepEqual(
      depurarEstado({ abierta: false, mensaje: '  Muy pronto  ', fecha: '2027-03-20' }),
      { abierta: false, mensaje: 'Muy pronto', fecha: '2027-03-20' },
    );
    assert.deepEqual(
      depurarEstado({ abierta: false, mensaje: 'x'.repeat(TOPE_MENSAJE_PROXIMAMENTE + 1), fecha: '2027-02-30' }),
      { abierta: false, mensaje: null, fecha: null },
    );
  });

  test('un día que no existe no es una fecha', () => {
    assert.equal(esDiaValido('2028-02-29'), true);
    assert.equal(esDiaValido('2027-02-29'), false);
    assert.equal(esDiaValido('2027-3-20'), false);
  });
});

describe('abrir y cerrar la web', () => {
  test('sin fila, abierta: se lee sin sesión y con la caché del contenido', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.configuracion.deleteMany({ where: { key: CLAVE } });
    WebAbiertaService.olvidar();
    const res = await pedir('/api/web');
    assert.equal(res.status, 200);
    assert.deepEqual(res.cuerpo, WEB_ABIERTA);
    assert.equal(res.cache, 'public, no-cache');
  });

  test('el Hermano Mayor la cierra: la lectura pública lo dice, queda en la auditoría y el sitemap se vacía', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await guardar('HERMANO_MAYOR', { abierta: false, mensaje: '  Nos vemos el Sábado de Pasión ', fecha: '2027-03-20' });
    assert.equal(res.status, 200);
    const cerrada = { abierta: false, mensaje: 'Nos vemos el Sábado de Pasión', fecha: '2027-03-20' };
    assert.deepEqual(res.cuerpo, cerrada);
    assert.deepEqual((await pedir('/api/web')).cuerpo, cerrada);

    // Lo guardado, no solo lo que hay en memoria.
    WebAbiertaService.olvidar();
    assert.deepEqual((await pedir('/api/web')).cuerpo, cerrada);

    const registro = await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.WEB_CERRAR, userId: usuarios.HERMANO_MAYOR }, orderBy: { id: 'desc' } });
    assert.ok(registro, 'cerrar la web queda en la auditoría');

    const sitemap = await pedir('/sitemap.xml');
    assert.equal(sitemap.status, 200);
    assert.doesNotMatch(String(sitemap.cuerpo), /<url>/);
  });

  test('Administración la abre y el sitemap vuelve a anunciar la web', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await guardar('ADMIN', { abierta: true, mensaje: '', fecha: null });
    assert.equal(res.status, 200);
    assert.deepEqual(res.cuerpo, WEB_ABIERTA);
    assert.ok(await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.WEB_ABRIR, userId: usuarios.ADMIN } }));
    assert.match(String((await pedir('/sitemap.xml')).cuerpo), /<url>/);
  });

  test('sin sesión es un 401 y otro cargo del CMS, un 403', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const estado = { abierta: false, mensaje: null, fecha: null };
    assert.equal((await pedir('/api/cms/web', { metodo: 'PUT', cuerpo: estado })).status, 401);
    assert.equal((await guardar('REDES', estado)).status, 403);
    assert.equal((await pedir('/api/web')).cuerpo.abierta, true);
  });

  test('un día que no existe, un texto largo o con etiquetas son un 400 que dice el campo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const fecha = await guardar('ADMIN', { abierta: false, mensaje: null, fecha: '2027-02-30' });
    assert.equal(fecha.status, 400);
    assert.deepEqual(fecha.cuerpo.errors.map((e: { field: string }) => e.field), ['fecha']);
    assert.equal((await guardar('ADMIN', { abierta: false, mensaje: 'x'.repeat(TOPE_MENSAJE_PROXIMAMENTE + 1), fecha: null })).status, 400);
    assert.equal((await guardar('ADMIN', { abierta: false, mensaje: '<script>', fecha: null })).status, 400);
    assert.equal((await guardar('ADMIN', { abierta: 'no', mensaje: null, fecha: null })).status, 400);
    assert.equal((await pedir('/api/web')).cuerpo.abierta, true, 'nada de eso la ha cerrado');
  });
});
