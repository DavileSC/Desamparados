// test/ficheros-huerfanos.test.ts
//
// C1: los ficheros subidos que deja de usar el CMS se borran del disco. Antes
// quitar una foto, sustituirla o borrar la noticia solo tocaba la base de datos
// y el archivo seguía publicado en /storage/public para siempre.
//
// El primer import aísla storage/ en una carpeta temporal: estas pruebas crean
// y borran ficheros, y nunca deben tocar los del repositorio.

import { almacenPublico } from './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import {
  borrarSubida,
  buscarHuerfanos,
  buscarRestosDeSubidas,
  contarReferencias,
  nombreDeSubida,
  subidasEnTexto,
  subidasEnUso,
  subidasReferenciadas,
} from '../src/utils/ficheros-publicos.js';
import { completarVariantes } from '../src/utils/variantes-publicas.js';
import sharp from 'sharp';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const hex = () => randomBytes(16).toString('hex');

describe('qué cuenta como fichero subido por el CMS', () => {
  test('solo 32 hex con extensión de foto o PDF en la raíz de /storage/public', () => {
    const nombre = `${hex()}.jpg`;
    assert.equal(nombreDeSubida(`/storage/public/${nombre}`), nombre);
    assert.equal(nombreDeSubida(`/storage/public/${hex()}.PDF`)?.endsWith('.PDF'), true);
    for (const ruta of [
      '/storage/public/documentos/pendiente.pdf', // activo del seed, en subcarpeta
      '/storage/public/portada/01-trono.webp',
      `/storage/public/../${hex()}.jpg`,
      `/storage/public/${hex()}.jpg/../../.env`,
      `/storage/public/${hex()}.html`,
      `/storage/private/${hex()}.pdf`,
      `/images/${hex()}.jpg`,
      `https://fuera.example/storage/public/${hex()}.jpg`, // la ruta exacta, no una URL
      '',
      null,
    ]) {
      assert.equal(nombreDeSubida(ruta), null, `no debería aceptar ${ruta}`);
    }
  });

  test('encuentra las subidas dentro de HTML y de URLs absolutas antiguas', () => {
    const a = `${hex()}.webp`;
    const b = `${hex()}.jpg`;
    const html = `<p>Texto</p><img src="/storage/public/${a}" alt="x"><a href="http://localhost:3001/storage/public/${b}">foto</a>`;
    assert.deepEqual([...subidasEnTexto(html, null, undefined, '/storage/public/portada/01.webp')].sort(), [a, b].sort());
  });

  test('borrarSubida no sale del filtro aunque se lo pidan', async () => {
    const carpeta = await mkdtemp(path.join(os.tmpdir(), 'desamparados-borrar-'));
    try {
      await writeFile(path.join(carpeta, 'secreto.txt'), 'x');
      await mkdir(path.join(carpeta, 'portada'));
      await writeFile(path.join(carpeta, 'portada', '01.webp'), 'x');
      for (const nombre of ['secreto.txt', '../secreto.txt', 'portada/01.webp', `${hex()}.jpg/..`]) {
        assert.equal(await borrarSubida(nombre, carpeta), false, `no debería borrar ${nombre}`);
      }
      assert.ok(existsSync(path.join(carpeta, 'secreto.txt')));
      assert.ok(existsSync(path.join(carpeta, 'portada', '01.webp')));

      const buena = `${hex()}.png`;
      await writeFile(path.join(carpeta, buena), 'x');
      assert.equal(await borrarSubida(buena, carpeta), true);
      assert.ok(!existsSync(path.join(carpeta, buena)));
      assert.equal(await borrarSubida(buena, carpeta), false, 'si ya no está, no es un error');
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });
});

describe('búsqueda de huérfanos del script', () => {
  test('lista solo las subidas sin referencias y con más de las horas pedidas; el resto no lo toca', async () => {
    const carpeta = await mkdtemp(path.join(os.tmpdir(), 'desamparados-huerfanos-'));
    try {
      const enUso = `${hex()}.jpg`;
      const huerfanoViejo = `${hex()}.pdf`;
      const huerfanoReciente = `${hex()}.webp`;
      for (const nombre of [enUso, huerfanoViejo, huerfanoReciente, 'LEEME.txt']) await writeFile(path.join(carpeta, nombre), 'x');
      await mkdir(path.join(carpeta, 'documentos'));
      await writeFile(path.join(carpeta, 'documentos', 'pendiente.pdf'), 'x');
      const haceDosDias = new Date(Date.now() - 48 * 3600_000);
      for (const nombre of [enUso, huerfanoViejo]) await utimes(path.join(carpeta, nombre), haceDosDias, haceDosDias);

      const { huerfanos, ignorados } = await buscarHuerfanos({ referenciados: new Set([enUso.toUpperCase()]), directorio: carpeta, minHoras: 24 });
      assert.deepEqual(huerfanos.map((h) => h.nombre), [huerfanoViejo]);
      assert.deepEqual(ignorados, ['LEEME.txt']);

      const sinMargen = await buscarHuerfanos({ referenciados: new Set([enUso]), directorio: carpeta, minHoras: 0 });
      assert.deepEqual(sinMargen.huerfanos.map((h) => h.nombre).sort(), [huerfanoViejo, huerfanoReciente].sort());
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });
});

// =================================================================
//  Con base de datos: el CMS borra lo que deja de usar
// =================================================================

let server: Server;
let baseUrl: string;
let dbDisponible = false;
let usuarioId = 0;

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
  if (dbDisponible) usuarioId = (await crearUsuarioPrueba(Role.REDES)).id;
});

after(async () => {
  server.close();
  if (usuarioId) await borrarUsuarioPrueba(usuarioId);
  await db.$disconnect();
});

const api = (ruta: string, metodo: string, cuerpo?: unknown) =>
  fetch(`${baseUrl}/api${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Cookie: `${COOKIE_CMS}=${generateToken(usuarioId, Role.REDES)}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

/** Un fichero como los que deja la subida del CMS, en el almacén temporal. */
async function subidaFalsa(ext: 'jpg' | 'webp' | 'pdf') {
  const nombre = `${hex()}.${ext}`;
  await writeFile(path.join(almacenPublico, nombre), 'contenido de prueba');
  return { nombre, ruta: `/storage/public/${nombre}`, existe: () => existsSync(path.join(almacenPublico, nombre)) };
}

const slugUnico = () => `prueba-huerfanos-${Date.now()}-${randomBytes(3).toString('hex')}`;

describe('noticias (C1)', () => {
  test('quitar la foto y guardar la borra del disco', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const foto = await subidaFalsa('jpg');
    const res = await api('/news', 'POST', { titulo: 'Prueba huérfanos', contenido: '<p>x</p>', imagenUrl: foto.ruta, slug: slugUnico(), visible: false });
    assert.equal(res.status, 201, await res.clone().text());
    const { id } = await res.json() as { id: number };
    try {
      assert.ok(foto.existe());
      const quitar = await api(`/news/${id}`, 'PUT', { imagenUrl: '' });
      assert.equal(quitar.status, 200, await quitar.clone().text());
      assert.equal(((await quitar.json()) as { imagenUrl: string | null }).imagenUrl, null, '«Quitar foto» se guarda como sin foto');
      assert.ok(!foto.existe(), 'la foto quitada debe desaparecer de /storage/public');
    } finally {
      await db.noticia.deleteMany({ where: { id } });
    }
  });

  test('sustituir la foto borra la anterior y conserva la nueva; las incrustadas que salen del cuerpo, también', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const vieja = await subidaFalsa('jpg');
    const nueva = await subidaFalsa('webp');
    const incrustada = await subidaFalsa('jpg');
    const res = await api('/news', 'POST', {
      titulo: 'Prueba huérfanos 2', contenido: `<p>x</p><img src="${incrustada.ruta}" alt="y">`, imagenUrl: vieja.ruta, slug: slugUnico(), visible: false,
    });
    assert.equal(res.status, 201, await res.clone().text());
    const { id } = await res.json() as { id: number };
    try {
      const cambio = await api(`/news/${id}`, 'PUT', { imagenUrl: nueva.ruta, contenido: '<p>sin fotos</p>' });
      assert.equal(cambio.status, 200);
      assert.ok(!vieja.existe());
      assert.ok(!incrustada.existe());
      assert.ok(nueva.existe());
    } finally {
      await db.noticia.deleteMany({ where: { id } });
    }
  });

  test('una foto incrustada con URL absoluta propia sobrevive a guardar la noticia (y queda como ruta relativa)', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Contenido de antes: la dirección copiada del navegador. Al guardar cualquier
    // campo, el formulario reenvía el cuerpo, y el saneado quitaba esa <img>... y
    // el fichero se borraba del disco por no tener ya referencias.
    const foto = await subidaFalsa('jpg');
    const contenido = `<p>x</p><img src="http://localhost:3001/storage/public/${foto.nombre}" alt="Titular">`;
    const noticia = await db.noticia.create({ data: { titulo: 'Prueba absoluta', slug: slugUnico(), contenido, visible: false } });
    try {
      const res = await api(`/news/${noticia.id}`, 'PUT', { titulo: 'Prueba absoluta retocada', contenido });
      assert.equal(res.status, 200, await res.clone().text());
      const guardada = await res.json() as { contenido: string };
      assert.match(guardada.contenido, new RegExp(`<img src="/storage/public/${foto.nombre}" alt="Titular"`));
      assert.ok(foto.existe(), 'la foto sigue en uso: no puede borrarse');
    } finally {
      await db.noticia.deleteMany({ where: { id: noticia.id } });
    }
  });

  test('una foto que usa otro registro no se borra hasta que la deja el último', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const compartida = await subidaFalsa('jpg');
    const ids: number[] = [];
    try {
      for (const titulo of ['Prueba compartida A', 'Prueba compartida B']) {
        const res = await api('/news', 'POST', { titulo, contenido: '<p>x</p>', imagenUrl: compartida.ruta, slug: slugUnico(), visible: false });
        assert.equal(res.status, 201);
        ids.push(((await res.json()) as { id: number }).id);
      }
      assert.equal((await api(`/news/${ids[0]}`, 'DELETE')).status, 200);
      assert.ok(compartida.existe(), 'la otra noticia sigue usándola');
      assert.equal((await api(`/news/${ids[1]}`, 'DELETE')).status, 200);
      assert.ok(!compartida.existe(), 'al borrar la última noticia que la usaba, sale del disco');
    } finally {
      await db.noticia.deleteMany({ where: { id: { in: ids } } });
    }
  });
});

describe('publicaciones (C1)', () => {
  test('sustituir el PDF borra el anterior; borrar la publicación borra su portada y su PDF salvo lo que use otro registro', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const pdfViejo = await subidaFalsa('pdf');
    const pdfNuevo = await subidaFalsa('pdf');
    const portada = await subidaFalsa('jpg');
    const res = await api('/publications', 'POST', { titulo: 'Prueba huérfanos', archivoUrl: pdfViejo.ruta, imagenUrl: portada.ruta, categoria: 'boletin', visible: false });
    assert.equal(res.status, 201, await res.clone().text());
    const { id } = await res.json() as { id: number };
    // Una noticia usa la misma portada: debe sobrevivir al borrado de la publicación.
    const noticia = await db.noticia.create({ data: { titulo: 'Prueba', slug: slugUnico(), contenido: '<p>x</p>', imagenUrl: portada.ruta, visible: false } });
    try {
      const cambio = await api(`/publications/${id}`, 'PUT', { archivoUrl: pdfNuevo.ruta });
      assert.equal(cambio.status, 200, await cambio.clone().text());
      assert.ok(!pdfViejo.existe());
      assert.ok(pdfNuevo.existe());

      assert.equal((await api(`/publications/${id}`, 'DELETE')).status, 200);
      assert.ok(!pdfNuevo.existe());
      assert.ok(portada.existe(), 'la noticia sigue usando la portada');
    } finally {
      await db.publicacion.deleteMany({ where: { id } });
      await db.noticia.deleteMany({ where: { id: noticia.id } });
    }
  });
});

describe('ficheros a los que apunta el entorno', () => {
  test('el PDF de NORMATIVA_URL (el que enlazan los correos) cuenta como en uso', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const normativa = await subidaFalsa('pdf');
    const otro = await subidaFalsa('pdf');
    const antes = process.env.NORMATIVA_URL;
    process.env.NORMATIVA_URL = `https://www.desamparados.es/storage/public/${normativa.nombre}`;
    const res = await api('/publications', 'POST', { titulo: 'Normativa', archivoUrl: normativa.ruta, categoria: 'historia', visible: false });
    assert.equal(res.status, 201, await res.clone().text());
    const { id } = await res.json() as { id: number };
    try {
      assert.ok((await subidasReferenciadas()).has(normativa.nombre));
      assert.equal((await api(`/publications/${id}`, 'PUT', { archivoUrl: otro.ruta })).status, 200);
      assert.ok(normativa.existe(), 'los correos siguen enlazándolo: no puede borrarse');
    } finally {
      if (antes === undefined) delete process.env.NORMATIVA_URL;
      else process.env.NORMATIVA_URL = antes;
      await db.publicacion.deleteMany({ where: { id } });
    }
  });
});

describe('fotos del retablo del Inicio del CMS', () => {
  test('la foto de todo el año y las de cada tiempo (dentro de un JSON) cuentan como en uso', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const deTodoElAnio = `${hex()}.webp`;
    const deCuaresma = `${hex()}.webp`;
    const claves = ['inicio_retablo_foto', 'inicio_retablo_tiempos'];
    const antes = await db.configuracion.findMany({ where: { key: { in: claves } } });
    try {
      await db.configuracion.deleteMany({ where: { key: { in: claves } } });
      await db.configuracion.createMany({ data: [
        { key: 'inicio_retablo_foto', value: `/storage/public/${deTodoElAnio}` },
        { key: 'inicio_retablo_tiempos', value: JSON.stringify([{ tiempo: 'cuaresma', foto: `/storage/public/${deCuaresma}`, x: 50, y: 30 }]) },
      ] });
      const referenciadas = await subidasReferenciadas();
      assert.ok(referenciadas.has(deTodoElAnio));
      assert.ok(referenciadas.has(deCuaresma));
      assert.equal(await contarReferencias(deCuaresma), 1);
    } finally {
      await db.configuracion.deleteMany({ where: { key: { in: claves } } });
      if (antes.length) await db.configuracion.createMany({ data: antes.map(({ key, value, descripcion }) => ({ key, value, descripcion })) });
    }
  });
});

describe('fotos incrustadas en el boletín y en las actas', () => {
  // Los dos se escriben con EditorTexto, que deja insertar fotos: la limpieza
  // de huérfanos las borraba de boletines ya enviados y de actas aprobadas.
  test('cuentan como en uso para el script y para el borrado al guardar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const enBoletin = `${hex()}.webp`;
    const enActa = `${hex()}.webp`;
    const comunicado = await db.comunicado.create({ data: { tipo: 'BOLETIN', asunto: 'Prueba de fotos', cuerpo: `<p>Hola</p><img src="/storage/public/${enBoletin}">`, segmento: {} } });
    const cabildo = await db.cabildo.create({ data: { tipo: 'ORDINARIO', fecha: new Date(), lugar: 'Prueba', ordenDelDia: [], acta: `<p>Acta</p><img src="/storage/public/${enActa}">` } });
    try {
      const referenciadas = await subidasReferenciadas();
      assert.ok(referenciadas.has(enBoletin));
      assert.ok(referenciadas.has(enActa));
      assert.deepEqual([...(await subidasEnUso([enBoletin, enActa]))].sort(), [enBoletin, enActa].sort());
    } finally {
      await db.cabildo.delete({ where: { id: cabildo.id } });
      await db.comunicado.delete({ where: { id: comunicado.id } });
    }
  });
});

describe('fotos de la portada (C1)', () => {
  test('la foto que sale de la lista se borra; las del seed y las estáticas no se tocan', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Se guarda la lista de la base de desarrollo para dejarla como estaba. Sus
    // ficheros viven en el storage del repositorio y aquí el almacén es otro:
    // aunque la sustitución los diera por huérfanos, no los encontraría.
    const anterior = (await db.imagenPortada.findMany({ orderBy: { orden: 'asc' } })).map((i) => ({ url: i.url, descripcion: i.descripcion ?? '' }));
    const foto = await subidaFalsa('webp');
    try {
      const poner = await api('/portada/imagenes', 'PUT', { imagenes: [{ url: foto.ruta }, { url: '/storage/public/portada/01-trono.webp' }] });
      assert.equal(poner.status, 200, await poner.clone().text());
      assert.ok(foto.existe());

      const quitar = await api('/portada/imagenes', 'PUT', { imagenes: [{ url: '/images/hero-1920.webp' }] });
      assert.equal(quitar.status, 200);
      assert.ok(!foto.existe(), 'la foto quitada de la portada debe desaparecer del disco');
    } finally {
      await api('/portada/imagenes', 'PUT', { imagenes: anterior });
    }
  });
});

describe('referencias para el script de huérfanos', () => {
  test('cuenta como en uso lo que menciona cualquier tabla del contenido', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const enPagina = `${hex()}.jpg`;
    const enEvento = `${hex()}.pdf`;
    const slug = slugUnico();
    await db.pagina.create({ data: { slug, titulo: 'Prueba', contenido: `<img src="/storage/public/${enPagina}">` } });
    const evento = await db.evento.create({ data: { title: 'Prueba', description: `Cartel: /storage/public/${enEvento}`, startDate: new Date() } });
    try {
      const referenciados = await subidasReferenciadas();
      assert.ok(referenciados.has(enPagina));
      assert.ok(referenciados.has(enEvento));
    } finally {
      await db.pagina.deleteMany({ where: { slug } });
      await db.evento.deleteMany({ where: { id: evento.id } });
    }
  });

  test('una foto que solo menciona ContenidoPagina cuenta como en uso', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);

    // Nombre con la forma exacta de una subida del CMS: 32 hex + extensión.
    const nombre = 'ab12cd34ef56ab78cd90ef12ab34cd56.webp';
    const ruta = `/storage/public/${nombre}`;
    const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });

    try {
      await db.contenidoPagina.upsert({
        where: { slug: 'portada' },
        update: { datos: { sabadoDePasion: { imagenUrl: ruta } } },
        create: { slug: 'portada', datos: { sabadoDePasion: { imagenUrl: ruta } } },
      });

      assert.equal(
        await contarReferencias(nombre), 1,
        'sin esto, guardar la portada borraría del disco la foto que acaba de publicarse',
      );
      assert.ok(
        (await subidasReferenciadas()).has(nombre),
        'sin esto, limpiar:huerfanos --borrar la borraría estando en la web',
      );
    } finally {
      if (antes) await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes.datos as object } });
      else await db.contenidoPagina.deleteMany({ where: { slug: 'portada' } });
    }
  });
});

describe('copias reducidas de las fotos (FR5)', () => {
  test('borrar una foto se lleva sus copias; una copia sola también se puede borrar', async () => {
    const carpeta = await mkdtemp(path.join(os.tmpdir(), 'variantes-'));
    try {
      const base = hex();
      for (const n of [`${base}.webp`, `${base}-640.webp`, `${base}-1280.webp`]) await writeFile(path.join(carpeta, n), 'x');
      assert.equal(await borrarSubida(`${base}.webp`, carpeta), true);
      for (const n of [`${base}.webp`, `${base}-640.webp`, `${base}-1280.webp`]) assert.ok(!existsSync(path.join(carpeta, n)), `${n} debería haberse ido`);

      const suelta = `${hex()}-640.webp`;
      await writeFile(path.join(carpeta, suelta), 'x');
      assert.equal(await borrarSubida(suelta, carpeta), true);
      for (const mala of [`${hex()}-700.webp`, `${hex()}-640.jpg`, `../${hex()}-640.webp`]) {
        assert.equal(await borrarSubida(mala, carpeta), false, `no debería aceptar ${mala}`);
      }
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });

  test('una copia sigue a su foto en la búsqueda de huérfanos, y nombrar una copia cuenta como su foto', async () => {
    const carpeta = await mkdtemp(path.join(os.tmpdir(), 'variantes-'));
    try {
      const enUso = hex();
      const huerfana = hex();
      for (const b of [enUso, huerfana]) {
        for (const n of [`${b}.webp`, `${b}-640.webp`, `${b}-1280.webp`]) await writeFile(path.join(carpeta, n), 'x');
      }
      const { huerfanos, ignorados } = await buscarHuerfanos({ referenciados: new Set([`${enUso}.webp`]), directorio: carpeta, minHoras: 0 });
      assert.deepEqual(huerfanos.map((h) => h.nombre).sort(), [`${huerfana}-1280.webp`, `${huerfana}-640.webp`, `${huerfana}.webp`].sort());
      assert.deepEqual(ignorados, []);
      assert.deepEqual([...subidasEnTexto(`<img srcset="/storage/public/${enUso}-640.webp 640w">`)], [`${enUso}.webp`]);
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });

  test('el script completa las copias que faltan y no toca las que ya están', async () => {
    const carpeta = await mkdtemp(path.join(os.tmpdir(), 'variantes-'));
    try {
      const ancha = hex();
      const completa = hex();
      await writeFile(path.join(carpeta, `${ancha}.webp`), await sharp({ create: { width: 1600, height: 400, channels: 3, background: '#262326' } }).webp().toBuffer());
      await writeFile(path.join(carpeta, `${completa}.webp`), 'no es una foto, pero ya tiene sus copias');
      await writeFile(path.join(carpeta, `${completa}-640.webp`), 'a');
      await writeFile(path.join(carpeta, `${completa}-1280.webp`), 'b');
      await writeFile(path.join(carpeta, 'hero-1920.webp'), 'no es una subida');

      const prueba = await completarVariantes({ directorio: carpeta, aplicar: false });
      assert.deepEqual(prueba.completadas, [`${ancha}.webp`]);
      assert.ok(!existsSync(path.join(carpeta, `${ancha}-640.webp`)), 'en modo prueba no escribe');

      const hecho = await completarVariantes({ directorio: carpeta });
      assert.deepEqual(hecho.completadas, [`${ancha}.webp`]);
      assert.equal(hecho.yaEstaban, 1);
      assert.equal((await sharp(path.join(carpeta, `${ancha}-640.webp`)).metadata()).width, 640);
      assert.equal((await sharp(path.join(carpeta, `${ancha}-1280.webp`)).metadata()).width, 1280);
      assert.ok(!existsSync(path.join(carpeta, 'hero-1920-640.webp')));

      const otraVez = await completarVariantes({ directorio: carpeta });
      assert.deepEqual(otraVez.completadas, [], 'idempotente');

      // Las de la portada de la siembra también: van a pantalla completa en la primera visita.
      await mkdir(path.join(carpeta, 'portada'));
      await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#888' } }).webp().toFile(path.join(carpeta, 'portada', '01-virgen-rostro.webp'));
      const conPortada = await completarVariantes({ directorio: carpeta });
      assert.deepEqual(conPortada.completadas, ['portada/01-virgen-rostro.webp']);
      assert.equal((await sharp(path.join(carpeta, 'portada', '01-virgen-rostro-640.webp')).metadata()).width, 640);
      assert.ok(existsSync(path.join(carpeta, 'portada', '01-virgen-rostro-1280.webp')));
      assert.deepEqual((await completarVariantes({ directorio: carpeta })).completadas, [], 'las copias no se toman por fotos');
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });
});

describe('comprobación en lote de las que siguen en uso (FR6)', () => {
  test('preguntar por todas a la vez da lo mismo que el recorrido completo del script', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const enNoticia = `${hex()}.webp`;
    const enEvento = `${hex()}.pdf`;
    const enPagina = `${hex()}.jpg`;
    const enGaleriaEnser = `${hex()}.webp`;
    const enProducto = `${hex()}.webp`;
    // Guardada con la extensión en mayúsculas y preguntada en minúsculas: la
    // comparación no distingue, como siempre.
    const mayusculas = `${hex()}.JPG`;
    const libres = [`${hex()}.webp`, `${hex()}.pdf`];
    const slug = slugUnico();
    const noticia = await db.noticia.create({ data: { titulo: 'Lote', slug, contenido: `<img src="/storage/public/${enNoticia}"><img src="/storage/public/${mayusculas}">`, visible: false } });
    const evento = await db.evento.create({ data: { title: 'Lote', fotoCartel: `/storage/public/${enEvento}`, startDate: new Date() } });
    await db.pagina.create({ data: { slug, titulo: 'Lote', contenido: `<a href="http://localhost:3001/storage/public/${enPagina}">x</a>` } });
    const enser = await db.enser.create({ data: { nombre: 'Lote', fotos: [{ url: `/storage/public/${enGaleriaEnser}`, pie: '' }] } });
    const producto = await db.producto.create({ data: { nombre: 'Lote', precio: 1, fotos: [{ url: `/storage/public/${enProducto}`, pie: '' }] } });
    try {
      const candidatos = [enNoticia, enEvento, enPagina, enGaleriaEnser, enProducto, mayusculas.toLowerCase(), ...libres];
      const enLote = await subidasEnUso(candidatos);
      const referenciadas = new Set([...(await subidasReferenciadas())].map((n) => n.toLowerCase()));
      assert.deepEqual(
        [...enLote].sort(),
        candidatos.map((n) => n.toLowerCase()).filter((n) => referenciadas.has(n)).sort(),
        'el lote y el recorrido completo tienen que coincidir',
      );
      assert.deepEqual([...enLote].sort(), [enNoticia, enEvento, enPagina, enGaleriaEnser, enProducto, mayusculas.toLowerCase()].sort());
      for (const libre of libres) assert.equal(await contarReferencias(libre), 0);
      assert.equal(await contarReferencias(enEvento), 1);
    } finally {
      await db.noticia.deleteMany({ where: { id: noticia.id } });
      await db.evento.deleteMany({ where: { id: evento.id } });
      await db.pagina.deleteMany({ where: { slug } });
      await db.enser.deleteMany({ where: { id: enser.id } });
      await db.producto.deleteMany({ where: { id: producto.id } });
    }
  });

  test('sin candidatos no consulta nada y devuelve un conjunto vacío', async () => {
    assert.equal((await subidasEnUso([])).size, 0);
  });
});

describe('huérfanos con el reloj del disco por delante', () => {
  // El mtime que devuelve el sistema de ficheros puede quedar unos milisegundos
  // por delante del reloj de Node (en NTFS pasa). Entonces «ahora - mtime» sale
  // negativo y el fichero se descartaba por «reciente» aunque se hubiera pedido
  // sin margen: con --horas=0 el script se dejaba subidas sin listar. Esto lo
  // reproduce de forma fija pasando un `ahora` anterior al fichero.
  test('un fichero con la fecha por delante del reloj cuenta como huérfano si no se pide margen', async () => {
    const carpeta = await mkdtemp(path.join(os.tmpdir(), 'desamparados-reloj-'));
    try {
      const huerfano = `${hex()}.webp`;
      await writeFile(path.join(carpeta, huerfano), 'x');

      const { huerfanos } = await buscarHuerfanos({
        referenciados: new Set(),
        directorio: carpeta,
        minHoras: 0,
        ahora: new Date(Date.now() - 5_000),
      });

      assert.deepEqual(huerfanos.map((h) => h.nombre), [huerfano]);
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });
});

describe('restos de una subida que no terminó', () => {
  test('lo viejo de storage/subiendo y los .tmp del renombrado, nada más', async () => {
    const raiz = await mkdtemp(path.join(os.tmpdir(), 'restos-'));
    const subiendo = path.join(raiz, 'subiendo');
    const publico = path.join(raiz, 'public');
    await mkdir(subiendo);
    await mkdir(publico);
    const viejo = new Date(Date.now() - 48 * 3600_000);
    const escribir = async (ruta: string, antiguo = true) => {
      await writeFile(ruta, 'x');
      if (antiguo) await utimes(ruta, viejo, viejo);
    };
    const n = hex();
    await escribir(path.join(subiendo, `${n}.jpg`));
    await escribir(path.join(subiendo, `${hex()}.png`), false); // alguien subiendo ahora mismo
    await escribir(path.join(publico, `.${n}.webp.tmp`));
    await escribir(path.join(publico, `.${n}-640.webp.tmp`));
    await escribir(path.join(publico, `${n}.webp`)); // la foto ya publicada no es un resto
    await escribir(path.join(publico, '.gitkeep'));
    try {
      const restos = await buscarRestosDeSubidas({ subiendo, publico, minHoras: 24 });
      assert.deepEqual(
        restos.map((r) => path.relative(raiz, r.ruta).split(path.sep).join('/')).sort(),
        [`public/.${n}-640.webp.tmp`, `public/.${n}.webp.tmp`, `subiendo/${n}.jpg`].sort(),
      );
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });
});
