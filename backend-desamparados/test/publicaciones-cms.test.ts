// test/publicaciones-cms.test.ts
//
// El listado de publicaciones del CMS: apartados (publicadas, borradores,
// incompletas), tipo, búsqueda por palabras, borradores primero y el resumen
// con lo que sale en la portada. El esquema y los `where` se prueban sin base
// de datos; la consulta, contra MariaDB.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomInt } from 'node:crypto';
import db from '../src/config/db.js';
import { publicacionesCmsQuerySchema, PDF_DE_RELLENO } from '../src/schemas/publicacion.schema.js';
import { PublicacionService, condicionEstadoPublicacion, PUBLICACIONES_EN_PORTADA } from '../src/services/publicacion.service.js';
import { SIN_DB } from './fixtures/sin-db.js';


const valida = (query: Record<string, string>) =>
  !(publicacionesCmsQuerySchema.onDeepUndeclaredKey('delete')({ query, body: {}, params: {} }) as { summary?: string }).summary;

describe('la consulta del listado de publicaciones del CMS', () => {
  test('acepta los tres apartados y rechaza cualquier otro', () => {
    for (const estado of ['publicadas', 'borradores', 'incompletas']) assert.ok(valida({ estado }));
    assert.ok(!valida({ estado: 'borradas' }));
  });

  test('el tipo ha de ser uno de los cuatro', () => {
    for (const categoria of ['boletin', 'dossier', 'anuario', 'historia']) assert.ok(valida({ categoria }));
    assert.ok(!valida({ categoria: 'revista' }));
  });

  test('la búsqueda tiene tope y la página ha de ser un número', () => {
    assert.ok(valida({ q: 'boletín', page: '2', limit: '25' }));
    assert.ok(!valida({ q: 'x'.repeat(101) }));
    assert.ok(!valida({ page: 'dos' }));
  });
});

describe('condicionEstadoPublicacion', () => {
  test('sin apartado no filtra', () => {
    assert.deepEqual(condicionEstadoPublicacion(undefined), {});
  });

  test('publicadas y borradores se separan por visible', () => {
    assert.deepEqual(condicionEstadoPublicacion('publicadas'), { visible: true });
    assert.deepEqual(condicionEstadoPublicacion('borradores'), { visible: false });
  });

  test('incompleta es sin portada, sin descripción o con el PDF de relleno, contando la cadena vacía', () => {
    assert.deepEqual(condicionEstadoPublicacion('incompletas'), {
      OR: [{ imagenUrl: null }, { imagenUrl: '' }, { descripcion: null }, { descripcion: '' }, { archivoUrl: PDF_DE_RELLENO }],
    });
  });
});

describe('PublicacionService.listadoDelCms contra la base de datos', () => {
  let dbDisponible = false;
  const marca = `Zpub${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`;
  const ids: number[] = [];

  before(async () => {
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
    if (!dbDisponible) return;
    // Fechas lejanas: así estas son las más recientes y las que salen en la portada.
    const publicacion = (titulo: string, datos: object) => db.publicacion.create({
      data: { titulo: `${marca} ${titulo}`, archivoUrl: '/storage/public/0123456789abcdef0123456789abcdef.pdf', categoria: 'boletin', ...datos },
    });
    ids.push(
      (await publicacion('Completa', { visible: true, fecha: new Date('2099-03-02'), descripcion: 'Número de cuaresma', imagenUrl: '/storage/public/a.jpg' })).id,
      (await publicacion('Sinportada', { visible: true, fecha: new Date('2099-03-01'), descripcion: 'Número de pascua', categoria: 'anuario' })).id,
      (await publicacion('Borrador', { visible: false, fecha: new Date('2099-01-01'), descripcion: '' })).id,
    );
  });

  after(async () => {
    if (dbDisponible) await db.publicacion.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  const titulos = (lista: { titulo: string }[]) => lista.map((p) => p.titulo.replace(`${marca} `, ''));

  test('sin apartado, los borradores van primero y luego lo publicado por fecha', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { data } = await PublicacionService.listadoDelCms({ q: marca });
    assert.deepEqual(titulos(data), ['Borrador', 'Completa', 'Sinportada']);
  });

  test('cada apartado trae lo suyo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const de = async (estado: 'publicadas' | 'borradores' | 'incompletas') => titulos((await PublicacionService.listadoDelCms({ q: marca, estado })).data);
    assert.deepEqual(await de('publicadas'), ['Completa', 'Sinportada']);
    assert.deepEqual(await de('borradores'), ['Borrador']);
    assert.deepEqual(await de('incompletas'), ['Borrador', 'Sinportada']);
  });

  test('el tipo filtra la página y también las cifras', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const anuarios = await PublicacionService.listadoDelCms({ q: marca, categoria: 'anuario' });
    assert.deepEqual(titulos(anuarios.data), ['Sinportada']);
    const todas = await PublicacionService.listadoDelCms({});
    assert.ok(anuarios.resumen.publicadas < todas.resumen.publicadas);
  });

  test('la búsqueda mira también la descripción', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { data } = await PublicacionService.listadoDelCms({ q: `${marca} cuaresma` });
    assert.deepEqual(titulos(data), ['Completa']);
  });

  test('el resumen dice qué sale en la portada, lo mismo que getLatest, y los borradores no cuentan', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { resumen } = await PublicacionService.listadoDelCms({ q: marca });
    assert.deepEqual(resumen.portada.ids.slice(0, 2), [ids[0], ids[1]]);
    assert.ok(!resumen.portada.ids.includes(ids[2]));
    assert.equal(resumen.portada.limite, PUBLICACIONES_EN_PORTADA);
    assert.deepEqual(resumen.portada.ids, (await PublicacionService.deLaPortada()).map((p) => p.id));
    assert.deepEqual(resumen.ultimaPublicacion, new Date('2099-03-02'));
  });

  test('las cifras no dependen de la búsqueda', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const conBusqueda = await PublicacionService.listadoDelCms({ q: marca });
    const sinBusqueda = await PublicacionService.listadoDelCms({});
    assert.deepEqual(conBusqueda.resumen, sinBusqueda.resumen);
    assert.ok(sinBusqueda.resumen.borradores >= 1);
  });
});
