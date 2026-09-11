// test/contenido-cms.test.ts
//
// Lo que escribe el CMS en noticias, páginas, publicaciones e inventario:
//  - C3: rutas de fotos y PDF limitadas a las del propio sitio.
//  - C4: el HTML saneado no admite imágenes externas, enlaces `//…` ni
//        `target` sin `rel`.
//  - C7: el extracto es texto plano («Cultos & Misa», no «Cultos &amp; Misa»).
//  - P4: el número de noticias de la portada es un entero de 1 a 20, y un valor
//        guardado inválido no tira la portada.

import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { ArkErrors } from 'arktype';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_SESION } from '../src/utils/cookies.js';
import { readFileSync } from 'node:fs';
import { sanearContenidoCms, extractoPlano, ETIQUETAS_CMS, ATRIBUTOS_CMS } from '../src/utils/sanear-html.js';
import { createNewsSchema, limitConfigSchema, updateNewsSchema } from '../src/schemas/news.schema.js';
import { createPublicationSchema, PDF_DE_RELLENO } from '../src/schemas/publication.schema.js';
import { createEnserSchema, createPrendaSchema } from '../src/schemas/inventario.schema.js';
import { limitePortada } from '../src/services/news.service.js';
import { ARCHIVO_PUBLICACION_PENDIENTE } from '../prisma/seed-contenido.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const esError = (resultado: unknown) => resultado instanceof ArkErrors;
const HEX = '0123456789abcdef0123456789abcdef';

describe('HTML del CMS (C4)', () => {
  test('conserva el formato y las fotos propias', () => {
    const limpio = sanearContenidoCms(`<h2>Triduo</h2><p>Los <strong>cultos</strong></p><img src="/storage/public/${HEX}.jpg" alt="Titular"><img src="/images/hero-1920.webp" alt="Portada">`);
    assert.match(limpio, /<h2>Triduo<\/h2>/);
    assert.match(limpio, new RegExp(`src="/storage/public/${HEX}.jpg"`));
    assert.match(limpio, /src="\/images\/hero-1920.webp"/);
  });

  test('quita las imágenes externas, relativas al protocolo, data: y con rutas raras', () => {
    for (const img of [
      '<img src="https://tracker.example/pixel.gif">',
      '<img src="//tracker.example/pixel.gif">',
      '<img src="data:image/png;base64,AAAA">',
      '<img src="/storage/public/../secreto.jpg">',
      '<img src="/storage/private/x.jpg">',
      '<img alt="sin src">',
    ]) {
      assert.equal(sanearContenidoCms(`<p>a</p>${img}`), '<p>a</p>', `debería quitar ${img}`);
    }
  });

  test('no deja enlaces relativos al protocolo ni javascript:', () => {
    assert.doesNotMatch(sanearContenidoCms('<a href="//otro.example/x">x</a>'), /href/);
    assert.doesNotMatch(sanearContenidoCms('<a href="javascript:alert(1)">x</a>'), /href/);
    assert.match(sanearContenidoCms('<a href="https://ok.example/x">x</a>'), /href="https:\/\/ok.example\/x"/);
    assert.match(sanearContenidoCms('<a href="/noticias/x">x</a>'), /href="\/noticias\/x"/);
  });

  test('un enlace con target lleva siempre rel="noopener noreferrer", aunque el editor ponga otro', () => {
    assert.equal(
      sanearContenidoCms('<a href="https://ok.example" target="_blank">x</a>'),
      '<a href="https://ok.example" target="_blank" rel="noopener noreferrer">x</a>',
    );
    assert.equal(
      sanearContenidoCms('<a href="https://ok.example" target="_top" rel="opener">x</a>'),
      '<a href="https://ok.example" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });
});

describe('URLs absolutas de fotos nuestras en el HTML', () => {
  // Lo que da «Copiar dirección de imagen» y lo que guardaban versiones antiguas
  // del CMS. Antes se quitaba la <img> al guardar y el fichero se borraba del disco.
  test('pasan a ruta relativa, venga del host que venga', () => {
    for (const src of [
      `https://www.desamparados.es/storage/public/${HEX}.jpg`,
      `http://localhost:3001/storage/public/${HEX}.jpg`,
      `//www.desamparados.es/storage/public/${HEX}.jpg?v=2#x`,
      `HTTPS://WWW.DESAMPARADOS.ES/storage/public/${HEX}.jpg`,
    ]) {
      assert.equal(sanearContenidoCms(`<img src="${src}" alt="T">`), `<img src="/storage/public/${HEX}.jpg" alt="T" />`, src);
    }
    assert.equal(sanearContenidoCms('<img src="https://www.desamparados.es/images/hero-1920.webp">'), '<img src="/images/hero-1920.webp" />');
  });

  test('lo que no es una ruta nuestra sigue fuera, también con ../', () => {
    assert.equal(sanearContenidoCms('<p>a</p><img src="https://tracker.example/pixel.gif">'), '<p>a</p>');
    assert.equal(sanearContenidoCms(`<p>a</p><img src="https://www.desamparados.es/storage/public/../private/${HEX}.jpg">`), '<p>a</p>');
    assert.equal(sanearContenidoCms(`<p>a</p><img src="https://www.desamparados.es/storage/private/${HEX}.jpg">`), '<p>a</p>');
  });
});

describe('listas del HTML alineadas con la web (C4)', () => {
  test('conserva las celdas combinadas y los title, como la web', () => {
    const limpio = sanearContenidoCms('<table><tr><th colspan="2" title="Cabecera">A</th></tr><tr><td rowspan="3">B</td></tr></table><p title="nota">x</p><a href="/x" title="Ir">y</a><img src="/images/a.jpg" alt="b" title="c">');
    assert.match(limpio, /<th colspan="2" title="Cabecera">/);
    assert.match(limpio, /<td rowspan="3">/);
    assert.match(limpio, /<p title="nota">/);
    assert.match(limpio, /<a href="\/x" title="Ir">/);
    assert.match(limpio, /title="c"/);
  });

  test('las etiquetas y los atributos son los mismos que en desamparados-web/src/lib/sanitizeHtml.ts', () => {
    // Si alguien cambia una lista y no la otra, el servidor guarda algo que la web
    // pinta distinto. Se lee el fichero de la web en vez de copiarlo aquí.
    const web = readFileSync(new URL('../../desamparados-web/src/lib/sanitizeHtml.ts', import.meta.url), 'utf8');
    const lista = (nombre: string) => {
      const bloque = new RegExp(String.raw`const ${nombre} = \[([\s\S]*?)\]`).exec(web);
      assert.ok(bloque, `no encuentro ${nombre} en sanitizeHtml.ts`);
      return [...bloque[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).sort();
    };
    assert.deepEqual([...ETIQUETAS_CMS].sort(), lista('ETIQUETAS_PERMITIDAS'));
    assert.deepEqual([...new Set(Object.values(ATRIBUTOS_CMS).flat())].sort(), lista('ATRIBUTOS_PERMITIDOS'));
  });
});

describe('extracto como texto plano (C7)', () => {
  test('«Cultos & Misa» se guarda tal cual, sin entidades', () => {
    assert.equal(extractoPlano('Cultos & Misa'), 'Cultos & Misa');
    assert.equal(extractoPlano('Del "Triduo" y l\'Ofrenda'), 'Del "Triduo" y l\'Ofrenda');
  });

  test('los extractos guardados antes con entidades se leen bien', () => {
    assert.equal(extractoPlano('Cultos &amp; Misa'), 'Cultos & Misa');
    assert.equal(extractoPlano('Cultos &#39;24&#39;'), "Cultos '24'");
  });

  test('quita las etiquetas y no deja ángulos que puedan volver a ser HTML', () => {
    assert.equal(extractoPlano('<b>Triduo</b> <script>alert(1)</script>de la Virgen'), 'Triduo de la Virgen');
    assert.equal(extractoPlano('&lt;script&gt;alert(1)&lt;/script&gt;'), 'scriptalert(1)/script');
  });

  test('es idempotente con texto normal: leer lo ya limpio no lo cambia', () => {
    for (const texto of ['Cultos & Misa', 'Besapiés «extraordinario» 2026', 'A & B & C']) {
      assert.equal(extractoPlano(extractoPlano(texto)), extractoPlano(texto));
    }
  });
});

describe('rutas de fotos y PDF (C3)', () => {
  const noticia = (imagenUrl: unknown) => createNewsSchema({ body: { titulo: 'T', contenido: '<p>x</p>', imagenUrl } });
  const publicacion = (archivoUrl: unknown, imagenUrl?: unknown) =>
    createPublicationSchema({ body: { titulo: 'T', archivoUrl, categoria: 'boletin', ...(imagenUrl === undefined ? {} : { imagenUrl }) } });

  test('la foto de una noticia es una ruta propia, o vacía para «sin foto»', () => {
    for (const ok of [`/storage/public/${HEX}.jpg`, '/storage/public/portada/01-trono.webp', '/images/hero.jpg', '', null]) {
      assert.ok(!esError(noticia(ok)), `debería aceptar ${ok}`);
    }
    for (const mal of ['https://tracker.example/x.jpg', '//tracker.example/x.jpg', 'javascript:alert(1)', `/storage/public/${HEX}.pdf`, '/storage/public/../x.jpg']) {
      assert.ok(esError(noticia(mal)), `debería rechazar ${mal}`);
    }
    // Al editar, el esquema solo normaliza: la foto se valida en el servicio
    // contra la ya guardada (ver «noticias contra el servidor», más abajo).
    const editada = updateNewsSchema({ body: { imagenUrl: `https://www.desamparados.es/storage/public/${HEX}.jpg` } }) as { body: { imagenUrl: string } };
    assert.equal(editada.body.imagenUrl, `/storage/public/${HEX}.jpg`);
  });

  test('el PDF de una publicación es una subida del CMS o el de relleno del seed', () => {
    assert.ok(!esError(publicacion(`/storage/public/${HEX}.pdf`)));
    assert.ok(!esError(publicacion(PDF_DE_RELLENO)));
    for (const mal of ['https://fuera.example/boletin.pdf', `/storage/public/${HEX}.jpg`, '/storage/public/../x.pdf', '/storage/public/boletin.pdf', 'boletin.pdf', '']) {
      assert.ok(esError(publicacion(mal)), `debería rechazar ${mal}`);
    }
    assert.ok(esError(publicacion(`/storage/public/${HEX}.pdf`, 'https://tracker.example/portada.jpg')));
  });

  test('el PDF de relleno que admite el esquema es el mismo que siembra el seed', () => {
    // Si se separan, las publicaciones sembradas dejarían de poder guardarse desde el CMS.
    assert.equal(PDF_DE_RELLENO, ARCHIVO_PUBLICACION_PENDIENTE);
  });

  test('al crear, una URL absoluta a una foto o PDF nuestros se guarda como ruta relativa; la extensión puede ir en mayúsculas', () => {
    const creada = noticia(`https://www.desamparados.es/storage/public/${HEX}.JPG`) as { body: { imagenUrl: string } };
    assert.equal(creada.body.imagenUrl, `/storage/public/${HEX}.JPG`);
    const pub = publicacion(`http://localhost:3001/storage/public/${HEX}.PDF`) as { body: { archivoUrl: string } };
    assert.equal(pub.body.archivoUrl, `/storage/public/${HEX}.PDF`);
    assert.ok(esError(publicacion('https://www.desamparados.es/storage/public/../x.pdf')));
  });

  test('las fotos de los enseres siguen la misma regla', () => {
    assert.ok(esError(createEnserSchema({ body: { nombre: 'Ciriales', imagenUrl: 'https://fuera.example/x.jpg' } })));
    assert.ok(!esError(createEnserSchema({ body: { nombre: 'Ciriales', imagenUrl: `/storage/public/${HEX}.webp` } })));
  });
});

describe('inventario: datos que llegaban a Prisma y daban 500 (D15)', () => {
  test('las cantidades de un enser son enteras y no negativas', () => {
    assert.ok(esError(createEnserSchema({ body: { nombre: 'Ciriales', cantidadOptimo: 2.5 } })));
    assert.ok(esError(createEnserSchema({ body: { nombre: 'Ciriales', cantidadBueno: -1 } })));
    assert.ok(!esError(createEnserSchema({ body: { nombre: 'Ciriales', cantidadOptimo: 4, cantidadBueno: 0, cantidadReparar: 1 } })));
  });

  test('una prenda no se da de alta como prestada: eso lo hace «Asignar»', () => {
    assert.ok(esError(createPrendaSchema({ body: { numero: 'TUN-1', tipo: 'TUNICA', estado: 'PRESTADA' } })));
    assert.ok(!esError(createPrendaSchema({ body: { numero: 'TUN-1', tipo: 'TUNICA', estado: 'TALLER' } })));
  });
});

describe('noticias de la portada (P4)', () => {
  test('el esquema solo admite enteros de 1 a 20', () => {
    for (const limit of [2.5, 0, 21, -3, '5']) assert.ok(esError(limitConfigSchema({ body: { limit } })), `debería rechazar ${limit}`);
    for (const limit of [1, 5, 20]) assert.ok(!esError(limitConfigSchema({ body: { limit } })));
  });

  test('un valor guardado inválido cae al de por defecto en vez de llegar a Prisma', () => {
    assert.equal(limitePortada('7'), 7);
    for (const guardado of ['2.5', 'abc', '0', '21', '-1', '', null, undefined]) {
      assert.equal(limitePortada(guardado), 3, `con ${JSON.stringify(guardado)}`);
    }
  });
});

// =================================================================
//  Con base de datos
// =================================================================

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
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

const api = (ruta: string, metodo = 'GET', cuerpo?: unknown) =>
  fetch(`${baseUrl}/api${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Cookie: `${COOKIE_SESION}=${generateToken(usuarioId, Role.REDES)}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

describe('noticias contra el servidor', () => {
  test('POST /news/limit rechaza 2.5 con 400', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await api('/news/limit', 'POST', { limit: 2.5 });
    assert.equal(res.status, 400);
  });

  test('con un límite inválido guardado, la portada sigue respondiendo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const anterior = await db.configuracion.findUnique({ where: { key: 'home_news_limit' } });
    try {
      await db.configuracion.upsert({ where: { key: 'home_news_limit' }, update: { value: '2.5' }, create: { key: 'home_news_limit', value: '2.5' } });
      const res = await fetch(`${baseUrl}/api/news/latest`);
      assert.equal(res.status, 200);
      assert.ok(((await res.json()) as unknown[]).length <= 3);
    } finally {
      if (anterior) await db.configuracion.update({ where: { key: 'home_news_limit' }, data: { value: anterior.value } });
      else await db.configuracion.deleteMany({ where: { key: 'home_news_limit' } });
    }
  });

  test('guarda el extracto sin entidades, sanea el cuerpo y decodifica los extractos antiguos al leer', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const slug = `prueba-contenido-${Date.now()}-${randomBytes(3).toString('hex')}`;
    const res = await api('/news', 'POST', {
      titulo: 'Prueba de contenido', slug, visible: false,
      extracto: 'Cultos & <b>Misa</b>',
      contenido: '<p>x</p><img src="https://tracker.example/p.gif"><a href="https://ok.example" target="_blank">y</a>',
    });
    assert.equal(res.status, 201, await res.clone().text());
    const creada = await res.json() as { id: number; extracto: string; contenido: string };
    try {
      assert.equal(creada.extracto, 'Cultos & Misa');
      assert.doesNotMatch(creada.contenido, /tracker/);
      assert.match(creada.contenido, /rel="noopener noreferrer"/);

      // Un extracto guardado antes del arreglo, con la entidad dentro.
      await db.noticia.update({ where: { id: creada.id }, data: { extracto: 'Cultos &amp; Misa' } });
      const leida = await (await api(`/news/admin/${creada.id}`)).json() as { extracto: string };
      assert.equal(leida.extracto, 'Cultos & Misa');
    } finally {
      await db.noticia.deleteMany({ where: { id: creada.id } });
    }
  });

  test('una noticia con una foto guardada antes de la validación se puede volver a guardar sin tocarla', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const noticia = await db.noticia.create({ data: { titulo: 'Prueba', slug: `prueba-antigua-${Date.now()}`, contenido: '<p>x</p>', imagenUrl: 'https://fuera.example/foto.jpg', visible: false } });
    try {
      // El formulario reenvía la ficha entera, foto incluida.
      const igual = await api(`/news/${noticia.id}`, 'PUT', { titulo: 'Prueba retocada', imagenUrl: 'https://fuera.example/foto.jpg' });
      assert.equal(igual.status, 200, await igual.clone().text());

      const otra = await api(`/news/${noticia.id}`, 'PUT', { imagenUrl: 'https://otra.example/foto.jpg' });
      assert.equal(otra.status, 400);
      assert.match(((await otra.json()) as { error: string }).error, /foto de la noticia.*vuelve a subirla/i);

      const propia = await api(`/news/${noticia.id}`, 'PUT', { imagenUrl: `http://localhost:3001/storage/public/${HEX}.jpg` });
      assert.equal(propia.status, 200);
      assert.equal(((await propia.json()) as { imagenUrl: string }).imagenUrl, `/storage/public/${HEX}.jpg`);
    } finally {
      await db.noticia.deleteMany({ where: { id: noticia.id } });
    }
  });

  test('una publicación con un PDF de antes (URL tecleada) se puede volver a guardar; cambiarlo exige un PDF subido', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const pub = await db.publicacion.create({ data: { titulo: 'Prueba', archivoUrl: 'https://drive.example/boletin.pdf', categoria: 'boletin', visible: false } });
    try {
      const igual = await api(`/publications/${pub.id}`, 'PUT', { titulo: 'Prueba retocada', archivoUrl: 'https://drive.example/boletin.pdf', imagenUrl: '' });
      assert.equal(igual.status, 200, await igual.clone().text());

      const otra = await api(`/publications/${pub.id}`, 'PUT', { archivoUrl: 'https://otra.example/boletin.pdf' });
      assert.equal(otra.status, 400);
      assert.match(((await otra.json()) as { error: string }).error, /PDF de la publicación.*vuelve a subirlo/i);

      const sinPdf = await api(`/publications/${pub.id}`, 'PUT', { archivoUrl: '' });
      assert.equal(sinPdf.status, 400);
      assert.match(((await sinPdf.json()) as { error: string }).error, /falta el pdf/i);

      const mayusculas = await api(`/publications/${pub.id}`, 'PUT', { archivoUrl: `/storage/public/${HEX}.PDF` });
      assert.equal(mayusculas.status, 200);
    } finally {
      await db.publicacion.deleteMany({ where: { id: pub.id } });
    }
  });

  test('una URL externa como foto se rechaza con 400', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await api('/news', 'POST', { titulo: 'Prueba', contenido: '<p>x</p>', imagenUrl: 'https://tracker.example/x.jpg', visible: false });
    assert.equal(res.status, 400);
  });
});
