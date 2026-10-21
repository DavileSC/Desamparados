// La identidad y la marca contra MariaDB: la primera vez se siembran del
// fichero, solo Administración las cambia, y lo guardado llega a los correos,
// a los PDF y a los ficheros que sirve nginx sin reiniciar nada.
import { almacenPublico, carpetaTemporal } from './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import sharp from 'sharp';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { MarcaService } from '../src/services/marca.service.js';
import { identidad, identidadDelFichero } from '../src/domain/datos-entidad.js';
import { FICHEROS_MARCA, IMPRENTA } from '../src/domain/marca.js';
import { BURDEOS } from '../src/services/informes/pdf.js';
import { COLORES } from '../src/services/correos/plantilla.js';
import { comunes } from '../src/services/correos/componer.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const CLAVE = 'corporacion_marca';
let server: Server;
let baseUrl: string;
let dbDisponible = false;
let filaAntes: { value: string; descripcion: string | null } | null = null;
const usuarios: Partial<Record<'ADMIN' | 'SECRETARIA', number>> = {};

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (!dbDisponible) return;
  filaAntes = await db.configuracion.findUnique({ where: { key: CLAVE }, select: { value: true, descripcion: true } });
  for (const rol of ['ADMIN', 'SECRETARIA'] as const) usuarios[rol] = (await crearUsuarioPrueba(Role[rol])).id;
});

after(async () => {
  server.close();
  if (dbDisponible) {
    // Lo que hubiera, como estaba: la base de desarrollo tiene la identidad de
    // verdad, y la API la vuelve a leer al arrancar.
    if (filaAntes) await db.configuracion.update({ where: { key: CLAVE }, data: filaAntes });
    else await db.configuracion.deleteMany({ where: { key: CLAVE } });
    await db.auditLog.deleteMany({ where: { action: ACCIONES_AUDITORIA.MARCA_ACTUALIZAR, userId: { in: Object.values(usuarios) } } });
    for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

async function pedir(ruta: string, { rol, metodo = 'GET', cuerpo, imagen }: { rol?: keyof typeof usuarios; metodo?: string; cuerpo?: unknown; imagen?: Buffer } = {}) {
  let body: BodyInit | undefined;
  if (imagen) {
    body = new FormData();
    body.append('imagen', new Blob([new Uint8Array(imagen)], { type: 'image/png' }), 'imagen.png');
  } else if (cuerpo !== undefined) body = JSON.stringify(cuerpo);
  const res = await fetch(`${baseUrl}/api${ruta}`, {
    method: metodo,
    headers: {
      ...(rol ? { Cookie: `${COOKIE_CMS}=${generateToken(usuarios[rol]!, rol)}` } : {}),
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body,
  });
  const texto = await res.text();
  return { status: res.status, cuerpo: texto ? JSON.parse(texto) : null };
}

const publicado = (fichero: string) => readFileSync(path.join(almacenPublico, fichero), 'utf8');

/** Un escudo de prueba: un óvalo blanco sobre transparente, del tamaño pedido. */
const escudoDePrueba = (ancho: number, alto: number) => sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><ellipse cx="${ancho / 2}" cy="${alto / 2}" rx="${ancho / 2.2}" ry="${alto / 2.2}" fill="#fff"/></svg>`,
)).png().toBuffer();

const NUEVA = {
  identidad: {
    ...identidadDelFichero(),
    nombre: 'Hermandad de la Prueba de Villaprueba',
    nombreCorto: 'La Prueba',
    denominacion: '  ',
    normas: null,
  },
  colores: { colorPrincipal: '#1F3A6B', colorAcento: '' },
};

describe('la identidad y la marca', () => {
  test('la primera vez se siembran del fichero y se escribe lo que lee la web', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.configuracion.deleteMany({ where: { key: CLAVE } });
    await MarcaService.cargar();
    const fila = await db.configuracion.findUnique({ where: { key: CLAVE } });
    assert.ok(fila, 'no se guardó la siembra');
    assert.deepEqual(JSON.parse(fila.value).identidad, identidadDelFichero());
    assert.match(publicado('instalacion/cabecera.html'), new RegExp(`<title>${identidadDelFichero().nombre} \\|`));
    assert.match(publicado('instalacion/instalacion.js'), /^window\.__INSTALACION__=/);
    assert.equal(JSON.parse(publicado('instalacion/manifest.json')).short_name, identidadDelFichero().nombreCorto);
    // Sin imágenes propias, las de partida: nginx solo sirve lo de storage/public.
    assert.ok(existsSync(path.join(almacenPublico, 'marca', 'escudo-sobre-oscuro.png')));
    assert.ok(existsSync(path.join(almacenPublico, 'marca', 'favicon-32.png')));
  });

  test('solo Administración la ve y la cambia', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedir('/cms/corporacion/marca')).status, 401);
    assert.equal((await pedir('/cms/corporacion/marca', { rol: 'SECRETARIA' })).status, 403);
    assert.equal((await pedir('/cms/corporacion/identidad', { rol: 'SECRETARIA', metodo: 'PUT', cuerpo: NUEVA })).status, 403);
    assert.equal((await pedir('/cms/corporacion/marca/escudoSobreOscuro', { rol: 'SECRETARIA', metodo: 'DELETE' })).status, 403);
    const res = await pedir('/cms/corporacion/marca', { rol: 'ADMIN' });
    assert.equal(res.status, 200);
    assert.equal(res.cuerpo.dominio, identidad.dominio);
    assert.equal(res.cuerpo.imagenes.escudoSobreOscuro.propia, false);
    assert.equal(res.cuerpo.imagenes.compartir, null);
    // El contacto sigue siendo de Secretaría.
    assert.equal((await pedir('/cms/corporacion', { rol: 'SECRETARIA' })).status, 200);
  });

  test('guardar cambia los correos, los PDF y la web sin reiniciar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const burdeosAntes = BURDEOS;
    const res = await pedir('/cms/corporacion/identidad', { rol: 'ADMIN', metodo: 'PUT', cuerpo: NUEVA });
    assert.equal(res.status, 200, JSON.stringify(res.cuerpo));
    assert.equal(res.cuerpo.identidad.nombre, 'Hermandad de la Prueba de Villaprueba');
    assert.equal(res.cuerpo.identidad.denominacion, null, 'vacío es pendiente');
    assert.deepEqual(res.cuerpo.colores, { colorPrincipal: '#1f3a6b', colorAcento: null });

    assert.equal(identidad.nombre, 'Hermandad de la Prueba de Villaprueba');
    assert.equal(comunes().grupo, 'Hermandad de la Prueba de Villaprueba');
    assert.notEqual(BURDEOS, burdeosAntes, 'el burdeos de los PDF sigue siendo el de antes');
    assert.equal(BURDEOS, IMPRENTA.burdeos);
    assert.equal(COLORES.burdeos, IMPRENTA.acentoCorreo);
    assert.match(publicado('instalacion/cabecera.html'), /<title>Hermandad de la Prueba de Villaprueba \|/);
    assert.match(publicado('instalacion/instalacion.js'), /"colorPrincipal":"#1f3a6b"/);
    const auditoria = await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.MARCA_ACTUALIZAR, userId: usuarios.ADMIN } });
    assert.ok(auditoria, 'no quedó en la auditoría');
  });

  test('con dos titulares, el membrete los une y la bendición concuerda en plural', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const titulares = ['Nuestro Padre Jesús Cautivo', 'María Santísima de la Trinidad'];
    const res = await pedir('/cms/corporacion/identidad', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { ...NUEVA, identidad: { ...NUEVA.identidad, titulares } } });
    assert.equal(res.status, 200, JSON.stringify(res.cuerpo));
    assert.deepEqual(res.cuerpo.identidad.titulares, titulares);
    assert.equal(res.cuerpo.identidad.titular, undefined, 'titular sale de titulares y no se guarda');
    assert.equal(identidad.titular, 'Nuestro Padre Jesús Cautivo y María Santísima de la Trinidad');
    assert.equal(comunes().bendicion, 'Que Nuestro Padre Jesús Cautivo y María Santísima de la Trinidad le guarden y bendigan.');
    assert.match(publicado('instalacion/instalacion.js'), /"titulares":\["Nuestro Padre Jesús Cautivo","María Santísima de la Trinidad"\]/);
    const sinNinguno = await pedir('/cms/corporacion/identidad', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { ...NUEVA, identidad: { ...NUEVA.identidad, titulares: [] } } });
    assert.equal(sinNinguno.status, 400);
  });

  test('un nombre vacío o un color mal escrito son 400 y no cambian nada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = identidad.nombre;
    const sinNombre = await pedir('/cms/corporacion/identidad', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { ...NUEVA, identidad: { ...NUEVA.identidad, nombre: '  ' } } });
    assert.equal(sinNombre.status, 400);
    const malColor = await pedir('/cms/corporacion/identidad', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { ...NUEVA, colores: { colorPrincipal: 'granate', colorAcento: null } } });
    assert.equal(malColor.status, 400);
    assert.equal(identidad.nombre, antes);
  });

  test('subir el escudo sobre oscuro lo reduce y saca de él los cuatro iconos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const faviconAntes = publicado('instalacion/cabecera.html').match(/favicon-32\.png\?v=(\w+)/)![1];
    const res = await pedir('/cms/corporacion/marca/escudoSobreOscuro', { rol: 'ADMIN', metodo: 'PUT', imagen: await escudoDePrueba(500, 640) });
    assert.equal(res.status, 200, JSON.stringify(res.cuerpo));
    assert.equal(res.cuerpo.imagenes.escudoSobreOscuro.propia, true);
    assert.equal(res.cuerpo.imagenes.escudoSobreOscuro.alto, 300, 'no se redujo al alto de la web');
    for (const icono of ['favicon-32.png', 'apple-touch-icon.png', 'icono-192.png', 'icono-512.png']) {
      assert.ok(existsSync(path.join(carpetaTemporal, 'storage', 'marca', icono)), `falta ${icono}`);
    }
    assert.equal(FICHEROS_MARCA.favicon32.origen, 'instalacion');
    assert.notEqual(publicado('instalacion/cabecera.html').match(/favicon-32\.png\?v=(\w+)/)![1], faviconAntes, 'la cabecera pide el icono viejo');
  });

  test('una foto en WebP para compartir se guarda en JPEG; un texto no es una imagen', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const webp = await sharp({ create: { width: 1400, height: 735, channels: 3, background: '#335577' } }).webp().toBuffer();
    const res = await pedir('/cms/corporacion/marca/compartir', { rol: 'ADMIN', metodo: 'PUT', imagen: webp });
    assert.equal(res.status, 200, JSON.stringify(res.cuerpo));
    assert.equal(res.cuerpo.imagenes.compartir.tipo, 'image/jpeg');
    assert.equal(res.cuerpo.imagenes.compartir.ancho, 1200);
    assert.match(publicado('instalacion/cabecera.html'), /og:image" content="https:\/\/[^"]+\/marca\/compartir\.jpg\?v=/);

    const texto = await pedir('/cms/corporacion/marca/compartir', { rol: 'ADMIN', metodo: 'PUT', imagen: Buffer.from('esto no es una foto') });
    assert.equal(texto.status, 400);
    assert.match(texto.cuerpo.error ?? texto.cuerpo.message, /PNG, un JPEG o un WebP/);
  });

  test('quitar vuelve a la de partida, iconos incluidos, o a ninguna', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const escudo = await pedir('/cms/corporacion/marca/escudoSobreOscuro', { rol: 'ADMIN', metodo: 'DELETE' });
    assert.equal(escudo.status, 200);
    assert.equal(escudo.cuerpo.imagenes.escudoSobreOscuro.propia, false);
    assert.equal(FICHEROS_MARCA.favicon32.origen, 'partida');
    const compartir = await pedir('/cms/corporacion/marca/compartir', { rol: 'ADMIN', metodo: 'DELETE' });
    assert.equal(compartir.cuerpo.imagenes.compartir, null);
    assert.ok(!existsSync(path.join(almacenPublico, 'marca', 'compartir.jpg')), 'se sigue sirviendo la que se quitó');
    assert.equal((await pedir('/cms/corporacion/marca/icono512', { rol: 'ADMIN', metodo: 'DELETE' })).status, 400, 'los iconos no se tocan sueltos');
  });
});
