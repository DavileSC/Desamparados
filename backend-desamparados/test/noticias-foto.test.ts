// test/noticias-foto.test.ts
//
// Lo que pide el archivo de noticias rediseñado (24-11-2026): extracto de
// hasta 300 caracteres, un punto de encuadre por foto y ninguna noticia
// publicada sin foto. El esquema se prueba sin base de datos; la regla de la
// foto, contra MariaDB.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomInt } from 'node:crypto';
import db from '../src/config/db.js';
import { actualizarNoticiaSchema, crearNoticiaSchema, EXTRACTO_MAXIMO } from '../src/schemas/noticia.schema.js';
import { NoticiaService, SIN_FOTO_NO_SE_PUBLICA } from '../src/services/noticia.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { SIN_DB } from './fixtures/sin-db.js';

const pasa = (esquema: typeof crearNoticiaSchema | typeof actualizarNoticiaSchema, body: Record<string, unknown>) =>
  !(esquema.onDeepUndeclaredKey('delete')({ body, query: {}, params: {} }) as { summary?: string }).summary;

const base = { titulo: 'Triduo', contenido: '<p>Texto</p>' };

describe('el esquema de la noticia', () => {
  test('el extracto llega hasta 300 caracteres y no pasa de ahí', () => {
    assert.equal(EXTRACTO_MAXIMO, 300);
    assert.ok(pasa(crearNoticiaSchema, { ...base, extracto: 'a'.repeat(300) }));
    assert.ok(!pasa(crearNoticiaSchema, { ...base, extracto: 'a'.repeat(301) }));
    assert.ok(!pasa(actualizarNoticiaSchema, { extracto: 'a'.repeat(301) }));
  });

  test('el encuadre es un entero de 0 a 100 en cada eje, o null para el centro', () => {
    assert.ok(pasa(actualizarNoticiaSchema, { encuadreX: 0, encuadreY: 100 }));
    assert.ok(pasa(actualizarNoticiaSchema, { encuadreX: null, encuadreY: null }));
    assert.ok(!pasa(actualizarNoticiaSchema, { encuadreX: 101 }));
    assert.ok(!pasa(actualizarNoticiaSchema, { encuadreY: -1 }));
    assert.ok(!pasa(crearNoticiaSchema, { ...base, encuadreX: 40.5 }));
  });
});

describe('la foto al publicar', () => {
  let dbDisponible = false;
  const marca = `Zfot${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`;
  const ids: number[] = [];
  let n = 0;
  const slug = () => `${marca.toLowerCase()}-${++n}`;

  before(async () => {
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
  });

  after(async () => {
    if (dbDisponible) await db.noticia.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  const sinFoto = (error: unknown) => error instanceof HttpError && error.status === 400 && error.message === SIN_FOTO_NO_SE_PUBLICA;

  test('no se crea publicada sin foto, pero sí en borrador', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(() => NoticiaService.crear({ ...base, slug: slug() }), sinFoto);
    await assert.rejects(() => NoticiaService.crear({ ...base, slug: slug(), visible: true, imagenUrl: '' }), sinFoto);
    const borrador = await NoticiaService.crear({ ...base, slug: slug(), visible: false });
    ids.push(borrador.id);
    assert.equal(borrador.imagenUrl, null);
  });

  test('un borrador sin foto no se publica; con foto, sí, y guarda su encuadre', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const borrador = await NoticiaService.crear({ ...base, slug: slug(), visible: false });
    ids.push(borrador.id);
    await assert.rejects(() => NoticiaService.actualizar(borrador.id, { visible: true }), sinFoto);
    const publicada = await NoticiaService.actualizar(borrador.id, { visible: true, imagenUrl: '/storage/public/a.jpg', encuadreX: 30, encuadreY: 20 });
    assert.equal(publicada.visible, true);
    assert.deepEqual([publicada.encuadreX, publicada.encuadreY], [30, 20]);
  });

  test('a una publicada no se le quita la foto, salvo pasándola a borrador', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const noticia = await NoticiaService.crear({ ...base, slug: slug(), imagenUrl: '/storage/public/a.jpg' });
    ids.push(noticia.id);
    await assert.rejects(() => NoticiaService.actualizar(noticia.id, { imagenUrl: '' }), sinFoto);
    const borrador = await NoticiaService.actualizar(noticia.id, { imagenUrl: '', visible: false });
    assert.equal(borrador.imagenUrl, null);
  });

  test('una publicada de antes, sin foto, se puede seguir corrigiendo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antigua = await db.noticia.create({ data: { ...base, titulo: `${marca} antigua`, slug: slug(), visible: true } });
    ids.push(antigua.id);
    const corregida = await NoticiaService.actualizar(antigua.id, { titulo: `${marca} corregida`, extracto: 'Ahora con resumen' });
    assert.equal(corregida.titulo, `${marca} corregida`);
    assert.equal(corregida.visible, true);
  });
});
