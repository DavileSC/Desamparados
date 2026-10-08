// test/noticias-cms.test.ts
//
// El listado de noticias del CMS: apartados (publicadas, borradores,
// incompletas), búsqueda por palabras, borradores primero y el resumen con lo
// que sale en la portada. El esquema y los `where` se prueban sin base de
// datos; la consulta, contra MariaDB.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomInt } from 'node:crypto';
import db from '../src/config/db.js';
import { archivoCmsQuerySchema } from '../src/schemas/noticia.schema.js';
import { NoticiaService, condicionEstadoNoticia } from '../src/services/noticia.service.js';
import { SIN_DB } from './fixtures/sin-db.js';


const valida = (query: Record<string, string>) =>
  !(archivoCmsQuerySchema.onDeepUndeclaredKey('delete')({ query, body: {}, params: {} }) as { summary?: string }).summary;

describe('la consulta del listado de noticias del CMS', () => {
  test('acepta los tres apartados y rechaza cualquier otro', () => {
    for (const estado of ['publicadas', 'borradores', 'incompletas']) assert.ok(valida({ estado }));
    assert.ok(!valida({ estado: 'borradas' }));
  });

  test('la búsqueda tiene tope y la página ha de ser un número', () => {
    assert.ok(valida({ q: 'besamanos', page: '2', limit: '25' }));
    assert.ok(!valida({ q: 'x'.repeat(101) }));
    assert.ok(!valida({ page: '0' }));
  });
});

describe('condicionEstadoNoticia', () => {
  test('sin apartado no filtra', () => {
    assert.deepEqual(condicionEstadoNoticia(undefined), {});
  });

  test('publicadas y borradores se separan por visible', () => {
    assert.deepEqual(condicionEstadoNoticia('publicadas'), { visible: true });
    assert.deepEqual(condicionEstadoNoticia('borradores'), { visible: false });
  });

  test('incompleta es sin foto o sin extracto, contando la cadena vacía', () => {
    assert.deepEqual(condicionEstadoNoticia('incompletas'), {
      OR: [{ imagenUrl: null }, { imagenUrl: '' }, { extracto: null }, { extracto: '' }],
    });
  });
});

describe('getAdminArchive contra la base de datos', () => {
  let dbDisponible = false;
  const marca = `Znot${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`;
  const ids: number[] = [];

  before(async () => {
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
    if (!dbDisponible) return;
    // Fechas lejanas: así estas son las más recientes y las que salen en la portada.
    const noticia = (titulo: string, datos: object) => db.noticia.create({
      data: { titulo: `${marca} ${titulo}`, slug: `${marca.toLowerCase()}-${titulo.toLowerCase()}`, contenido: '<p>Texto</p>', ...datos },
    });
    ids.push(
      (await noticia('Completa', { visible: true, fecha: new Date('2099-03-02'), extracto: 'Resumen', imagenUrl: '/storage/public/a.jpg' })).id,
      (await noticia('Sinfoto', { visible: true, fecha: new Date('2099-03-01'), extracto: 'Resumen' })).id,
      (await noticia('Borrador', { visible: false, fecha: new Date('2099-01-01'), extracto: '' })).id,
    );
  });

  after(async () => {
    if (dbDisponible) await db.noticia.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  const titulos = (lista: { titulo: string }[]) => lista.map((n) => n.titulo.replace(`${marca} `, ''));

  test('sin apartado, los borradores van primero y luego lo publicado por fecha', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { data } = await NoticiaService.archivoDelCms({ q: marca });
    assert.deepEqual(titulos(data), ['Borrador', 'Completa', 'Sinfoto']);
  });

  test('cada apartado trae lo suyo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const de = async (estado: 'publicadas' | 'borradores' | 'incompletas') => titulos((await NoticiaService.archivoDelCms({ q: marca, estado })).data);
    assert.deepEqual(await de('publicadas'), ['Completa', 'Sinfoto']);
    assert.deepEqual(await de('borradores'), ['Borrador']);
    assert.deepEqual(await de('incompletas'), ['Borrador', 'Sinfoto']);
  });

  test('la búsqueda mira también el extracto', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { data } = await NoticiaService.archivoDelCms({ q: `${marca} resumen` });
    assert.deepEqual(titulos(data), ['Completa', 'Sinfoto']);
  });

  test('el resumen dice qué sale en la portada, y los borradores no cuentan', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { resumen } = await NoticiaService.archivoDelCms({ q: marca });
    assert.deepEqual(resumen.portada.ids.slice(0, 2), [ids[0], ids[1]]);
    assert.ok(!resumen.portada.ids.includes(ids[2]));
    assert.equal(resumen.portada.ids.length <= resumen.portada.limite, true);
    assert.deepEqual(resumen.ultimaPublicacion, new Date('2099-03-02'));
  });

  test('las cifras son del archivo entero, no de la búsqueda', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const conBusqueda = await NoticiaService.archivoDelCms({ q: marca });
    const sinBusqueda = await NoticiaService.archivoDelCms({});
    assert.deepEqual(conBusqueda.resumen, sinBusqueda.resumen);
    assert.ok(sinBusqueda.resumen.borradores >= 1);
  });
});
