// test/destacada-portada.test.ts
//
// La destacada de la portada: la noticia o publicación que se fija a mano va
// primera y las plazas que quedan se siguen llenando por fecha. Las reglas
// (una sola, publicada, y se suelta al pasar a borrador) se prueban sin base de
// datos sobre `marcaDestacada`; el orden y la exclusividad, contra MariaDB.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomInt } from 'node:crypto';
import db from '../src/config/db.js';
import { fechaMasReciente, marcaDestacada } from '../src/domain/destacada-portada.js';
import { HttpError } from '../src/utils/error.handle.js';
import { NewsService } from '../src/services/news.service.js';
import { PublicationService } from '../src/services/publication.service.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

describe('marcaDestacada', () => {
  const publicada = { visible: true };
  const borrador = { visible: false };

  test('lo que no toca la marca la deja como está', () => {
    assert.deepEqual(marcaDestacada({ titulo: 'Otra cosa' } as never, publicada), { fijada: undefined, soltarLasDemas: false });
  });

  test('destacar una publicada suelta las demás', () => {
    assert.deepEqual(marcaDestacada({ fijada: true }, publicada), { fijada: true, soltarLasDemas: true });
  });

  test('dejar de destacarla no toca a las demás: no hay ninguna que soltar', () => {
    assert.deepEqual(marcaDestacada({ fijada: false }, publicada), { fijada: false, soltarLasDemas: false });
  });

  test('un borrador no se destaca: no se vería en la web', () => {
    assert.throws(() => marcaDestacada({ fijada: true }, borrador), HttpError);
  });

  test('pero sí se destaca al publicarla en el mismo guardado', () => {
    assert.deepEqual(marcaDestacada({ fijada: true, visible: true }, borrador), { fijada: true, soltarLasDemas: true });
  });

  test('pasarla a borrador la suelta, aunque el formulario mande fijada', () => {
    assert.deepEqual(marcaDestacada({ visible: false }, publicada), { fijada: false, soltarLasDemas: false });
    assert.deepEqual(marcaDestacada({ fijada: true, visible: false }, publicada), { fijada: false, soltarLasDemas: false });
  });
});

describe('fechaMasReciente', () => {
  test('sin nada en la portada no hay última publicación', () => {
    assert.equal(fechaMasReciente([]), null);
  });

  test('es la mayor, no la primera: la destacada puede ser vieja', () => {
    const fechas = [{ fecha: new Date('2020-01-01') }, { fecha: new Date('2026-09-01') }, { fecha: new Date('2026-03-01') }];
    assert.deepEqual(fechaMasReciente(fechas), new Date('2026-09-01'));
  });
});

// =================================================================
//  Con base de datos
// =================================================================

describe('destacar contra la base de datos', () => {
  let dbDisponible = false;
  const marca = `Zdes${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`;
  // Vieja, media y nueva: la portada las da del revés mientras no haya destacada.
  const noticias: number[] = [];
  const publicaciones: number[] = [];

  before(async () => {
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
    if (!dbDisponible) return;
    // Fechas lejanas: así estas tres son las que ocupan la portada entera y lo
    // que haya en la base de desarrollo no se mezcla con lo que se comprueba.
    const noticia = (titulo: string, fecha: string, visible = true) => db.noticia.create({
      data: { titulo: `${marca} ${titulo}`, slug: `${marca.toLowerCase()}-${titulo.toLowerCase()}`, contenido: '<p>Texto</p>', fecha: new Date(fecha), visible },
    });
    noticias.push(
      (await noticia('Nueva', '2099-03-03')).id,
      (await noticia('Media', '2099-03-02')).id,
      (await noticia('Vieja', '2099-03-01')).id,
      (await noticia('Borrador', '2099-03-04', false)).id,
    );
    const publicacion = (titulo: string, fecha: string) => db.publicacion.create({
      data: { titulo: `${marca} ${titulo}`, archivoUrl: '/storage/public/a.pdf', categoria: 'boletin', fecha: new Date(fecha), visible: true },
    });
    publicaciones.push(
      (await publicacion('Nueva', '2099-03-03')).id,
      (await publicacion('Media', '2099-03-02')).id,
      (await publicacion('Vieja', '2099-03-01')).id,
    );
  });

  after(async () => {
    if (dbDisponible) {
      await db.noticia.deleteMany({ where: { id: { in: noticias } } });
      await db.publicacion.deleteMany({ where: { id: { in: publicaciones } } });
    }
    await db.$disconnect();
  });

  const [nueva, media, vieja, borrador] = [0, 1, 2, 3].map((i) => () => noticias[i]);

  test('sin destacada, la portada va por fecha', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const ids = (await NewsService.getLatest()).map((n) => n.id);
    assert.deepEqual(ids, [nueva(), media(), vieja()]);
  });

  test('la destacada encabeza aunque sea la más vieja, y el resto sigue por fecha', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await NewsService.update(vieja(), { fijada: true });
    const ids = (await NewsService.getLatest()).map((n) => n.id);
    assert.deepEqual(ids, [vieja(), nueva(), media()]);
  });

  test('el resumen del CMS dice cuál es la destacada y coincide con lo que sale', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { resumen, data } = await NewsService.getAdminArchive({ q: marca });
    assert.equal(resumen.portada.fijada, vieja());
    assert.deepEqual(resumen.portada.ids, (await NewsService.getLatest()).map((n) => n.id));
    // Y sube en el listado, o la raya del corte caería en mitad de la página.
    assert.deepEqual(data.filter((n) => n.visible).map((n) => n.id), [vieja(), nueva(), media()]);
  });

  test('la última publicación sigue siendo la más reciente, no la destacada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { resumen } = await NewsService.getAdminArchive({ q: marca });
    assert.deepEqual(resumen.ultimaPublicacion, new Date('2099-03-03'));
  });

  test('destacar otra suelta la anterior: nunca hay dos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await NewsService.update(media(), { fijada: true });
    const fijadas = await db.noticia.findMany({ where: { fijada: true }, select: { id: true } });
    assert.deepEqual(fijadas.map((n) => n.id), [media()]);
  });

  test('pasarla a borrador la suelta: no puede volver sola a la portada al republicarla', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await NewsService.update(media(), { visible: false });
    assert.equal((await db.noticia.findUnique({ where: { id: media() } }))?.fijada, false);
    await NewsService.update(media(), { visible: true });
    assert.equal((await db.noticia.findUnique({ where: { id: media() } }))?.fijada, false);
  });

  test('un borrador no se puede destacar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(() => NewsService.update(borrador(), { fijada: true }), HttpError);
    assert.equal((await db.noticia.findUnique({ where: { id: borrador() } }))?.fijada, false);
  });

  test('en Publicaciones funciona igual', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const [nuevaP, mediaP, viejaP] = publicaciones;
    await PublicationService.update(viejaP, { fijada: true });
    assert.deepEqual((await PublicationService.getLatest()).map((p) => p.id), [viejaP, nuevaP, mediaP]);

    await PublicationService.update(mediaP, { fijada: true });
    const fijadas = await db.publicacion.findMany({ where: { fijada: true }, select: { id: true } });
    assert.deepEqual(fijadas.map((p) => p.id), [mediaP]);

    const { resumen } = await PublicationService.getAdmin({ q: marca });
    assert.equal(resumen.portada.fijada, mediaP);
    assert.deepEqual(resumen.ultimaPublicacion, new Date('2099-03-03'));
  });
});
