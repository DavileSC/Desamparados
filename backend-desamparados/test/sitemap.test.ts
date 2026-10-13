// test/sitemap.test.ts
//
// WP13 (auditoría 07-10-2026): el sitemap lo sirve la API en /sitemap.xml. Las
// páginas fijas salen de shared/rutas-publicas.json (lo genera la web desde su
// router, y su prueba vigila que esté al día), recortadas por los módulos
// encendidos AHORA; y cada noticia publicada va con su fecha de cambio.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { identidad } from '../src/domain/datos-entidad.js';
import { ModulosService } from '../src/services/modulos.service.js';
import rutasPublicas from '../../shared/rutas-publicas.json' with { type: 'json' };
import { SIN_DB } from './fixtures/sin-db.js';
import { encenderModulos } from './fixtures/modulos.js';

let server: Server;
let baseUrl: string;
let dbDisponible = false;
let noticiasEncendido = true;
const sufijo = randomBytes(4).toString('hex');
const DOMINIO = `https://${identidad.dominio}`;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (dbDisponible) noticiasEncendido = (await db.modulo.findUnique({ where: { clave: 'noticias' } }))?.activo ?? true;
});

after(async () => {
  if (dbDisponible) {
    await db.noticia.deleteMany({ where: { slug: { endsWith: sufijo } } });
    await db.modulo.updateMany({ where: { clave: 'noticias' }, data: { activo: noticiasEncendido } });
    await ModulosService.cargar();
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

const urls = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

test('la lista compartida trae la portada, la noticia con parámetro y nada privado', () => {
  const rutas = rutasPublicas.rutas.map((r) => r.ruta);
  assert.ok(rutas.includes('/'));
  assert.ok(rutas.includes('/contacto'));
  assert.ok(rutas.includes('/noticias/:slug'), 'sin ella el sitemap no sabría dónde viven las noticias');
  for (const ruta of rutas) assert.ok(!/^\/(cms|area-hermano|acceso|reset-password)/.test(ruta), ruta);
});

test('GET /sitemap.xml: las páginas fijas y las noticias publicadas con su fecha; ni borradores ni rutas con parámetro', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await db.modulo.updateMany({ where: { clave: 'noticias' }, data: { activo: true } });
  await ModulosService.cargar();
  const publicada = await db.noticia.create({ data: { titulo: 'Sitemap', slug: `sitemap-publicada-${sufijo}`, contenido: '<p>x</p>', visible: true } });
  await db.noticia.create({ data: { titulo: 'Sitemap', slug: `sitemap-borrador-${sufijo}`, contenido: '<p>x</p>', visible: false } });

  const res = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^application\/xml/);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=3600');
  const xml = await res.text();
  assert.ok(xml.startsWith('<?xml'));
  const lista = urls(xml);
  assert.ok(lista.includes(`${DOMINIO}/`));
  assert.ok(lista.includes(`${DOMINIO}/contacto`));
  assert.ok(lista.includes(`${DOMINIO}/noticias`));
  assert.ok(lista.every((u) => !u.includes(':slug') && !u.includes(':token') && !u.includes(':id')), 'ninguna ruta con parámetro sin rellenar');
  assert.ok(xml.includes(`<url><loc>${DOMINIO}/noticias/sitemap-publicada-${sufijo}</loc><lastmod>${publicada.updatedAt.toISOString()}</lastmod></url>`));
  assert.ok(!xml.includes(`sitemap-borrador-${sufijo}`), 'un borrador no se anuncia');
});

test('con Noticias apagado desde el CMS, ni el listado ni las noticias se anuncian', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await db.noticia.create({ data: { titulo: 'Sitemap', slug: `sitemap-apagado-${sufijo}`, contenido: '<p>x</p>', visible: true } });
  await db.modulo.updateMany({ where: { clave: 'noticias' }, data: { activo: false } });
  await ModulosService.cargar();
  try {
    const lista = urls(await (await fetch(`${baseUrl}/sitemap.xml`)).text());
    assert.ok(!lista.some((u) => u.startsWith(`${DOMINIO}/noticias`)));
    assert.ok(lista.includes(`${DOMINIO}/contacto`), 'el núcleo sigue');
  } finally {
    await db.modulo.updateMany({ where: { clave: 'noticias' }, data: { activo: true } });
    await ModulosService.cargar();
  }
});

// WP13 (auditoría 13-10-2026): las fichas de producto se indexan y no se anunciaban.
test('con la tienda de la web encendida, cada producto a la venta va con su fecha; el retirado o con la tienda apagada, no', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const restaurar = await encenderModulos(['tienda', 'pago-en-linea', 'tienda-web']);
  const aLaVenta = await db.producto.create({ data: { nombre: `Sitemap ${sufijo}`, precio: '5' } });
  const retirado = await db.producto.create({ data: { nombre: `Sitemap retirado ${sufijo}`, precio: '5', activo: false } });
  try {
    const xml = await (await fetch(`${baseUrl}/sitemap.xml`)).text();
    assert.ok(xml.includes(`<url><loc>${DOMINIO}/tienda/producto/${aLaVenta.id}</loc><lastmod>${aLaVenta.updatedAt.toISOString()}</lastmod></url>`));
    assert.ok(!urls(xml).includes(`${DOMINIO}/tienda/producto/${retirado.id}`), 'el retirado no se anuncia');

    await db.modulo.updateMany({ where: { clave: 'tienda-web' }, data: { activo: false } });
    await ModulosService.cargar();
    assert.ok(!urls(await (await fetch(`${baseUrl}/sitemap.xml`)).text()).some((u) => u.includes('/tienda/producto/')));
  } finally {
    await db.producto.deleteMany({ where: { id: { in: [aLaVenta.id, retirado.id] } } });
    await restaurar();
    await ModulosService.cargar();
  }
});
