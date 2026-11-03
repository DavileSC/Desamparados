// Publicar las noticias en Instagram: las reglas sin red ni base (recorte,
// pie, renovación) y, contra MariaDB y con un Instagram de mentira, conectar
// la cuenta, quién puede, publicar una noticia y renovar el token. Nunca sale
// nada a la red: `fijarClienteDePrueba`.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import sharp from 'sharp';
import { Role, type CuentaInstagram } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { publicStorageDir } from '../src/middleware/upload.middleware.js';
import {
  LARGO_MAXIMO_PIE, PROPORCION_MAXIMA, PROPORCION_MINIMA, RENOVAR_CADA,
  pieDeInstagram, problemaDelPie, recorteParaInstagram, tocaRenovar,
} from '../src/domain/instagram.js';
import { ErrorDeInstagram, fijarClienteDePrueba, type ClienteInstagram } from '../src/services/redes/instagram-api.js';
import { InstagramService, carpetaParaInstagram } from '../src/services/redes/instagram.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

describe('recorteParaInstagram', () => {
  test('una foto que cabe se deja entera', () => {
    assert.deepEqual(recorteParaInstagram(1920, 1280), { left: 0, top: 0, width: 1920, height: 1280 });
    assert.deepEqual(recorteParaInstagram(1080, 1350), { left: 0, top: 0, width: 1080, height: 1350 });
  });

  test('una vertical del móvil (9:16) se queda en 4:5, centrada', () => {
    const r = recorteParaInstagram(1080, 1920);
    assert.equal(r.width, 1080);
    assert.equal(r.height, 1350);
    assert.equal(r.top, 285);
    assert.ok(r.width / r.height >= PROPORCION_MINIMA);
  });

  test('una panorámica se queda en 1,91:1, centrada', () => {
    const r = recorteParaInstagram(1920, 600);
    assert.equal(r.height, 600);
    assert.ok(r.width / r.height <= PROPORCION_MAXIMA);
    assert.equal(r.left, Math.floor((1920 - r.width) / 2));
  });
});

describe('el pie de Instagram', () => {
  test('propone título, extracto y el enlace del perfil, sin la dirección', () => {
    const pie = pieDeInstagram({ titulo: ' Besamanos ', extracto: 'El sábado, a las seis.' });
    assert.equal(pie, 'Besamanos\n\nEl sábado, a las seis.\n\nLa noticia completa, en el enlace de nuestro perfil.');
    assert.ok(!pie.includes('http'));
  });

  test('sin extracto, título y enlace', () => {
    assert.equal(pieDeInstagram({ titulo: 'Besamanos', extracto: '  ' }).split('\n\n').length, 2);
  });

  test('dice lo que Instagram rechazaría', () => {
    assert.equal(problemaDelPie('Un pie #bien'), null);
    assert.match(problemaDelPie('   ')!, /vacío/);
    assert.match(problemaDelPie('x'.repeat(LARGO_MAXIMO_PIE + 1))!, /2200/);
    assert.match(problemaDelPie(Array.from({ length: 31 }, (_, i) => `#e${i}`).join(' '))!, /31 etiquetas/);
    assert.match(problemaDelPie(Array.from({ length: 21 }, (_, i) => `@c${i}`).join(' '))!, /21 cuentas/);
  });
});

describe('tocaRenovar', () => {
  test('a la semana sí, antes no', () => {
    const ahora = new Date('2026-11-10T12:00:00Z');
    assert.equal(tocaRenovar(new Date(ahora.getTime() - RENOVAR_CADA), ahora), true);
    assert.equal(tocaRenovar(new Date(ahora.getTime() - RENOVAR_CADA + 60_000), ahora), false);
  });
});

describe('Instagram contra la base de datos', () => {
  const TOKEN = `IGAA${'x'.repeat(120)}`;
  let server: Server;
  let baseUrl: string;
  let dbDisponible = false;
  let cuentaAntes: CuentaInstagram | null = null;
  const usuarios: Partial<Record<'ADMIN' | 'REDES' | 'SECRETARIA', number>> = {};
  const noticias: number[] = [];
  const fotos: string[] = [];
  /** Lo que «Instagram» ha recibido en esta prueba. */
  let publicadas: { cuentaId: string; imagen: string; pie: string; jpeg: Buffer }[] = [];

  const falso = (cambios: Partial<ClienteInstagram> = {}): ClienteInstagram => ({
    quienSoy: async (token) => {
      if (token !== TOKEN) throw new ErrorDeInstagram('Invalid OAuth access token', 190);
      return { cuentaId: '17841400000000000', usuario: 'grupo_de_prueba', tipo: 'BUSINESS' };
    },
    renovar: async () => ({ token: `${TOKEN}renovado`, caducaEn: 5_184_000 }),
    publicarFoto: async (_token, cuentaId, imagen, pie) => {
      // Lo que haría Instagram: descargarse la foto. Aquí, leerla del disco.
      const jpeg = await fs.readFile(path.join(carpetaParaInstagram(), path.basename(imagen)));
      publicadas.push({ cuentaId, imagen, pie, jpeg });
      return { id: '18000000000000001', enlace: 'https://www.instagram.com/p/prueba/' };
    },
    ...cambios,
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
    return { status: res.status, cuerpo: texto ? JSON.parse(texto) : null, texto };
  }

  async function fotoSubida(ancho: number, alto: number) {
    const nombre = `${crypto.randomBytes(16).toString('hex')}.webp`;
    await sharp({ create: { width: ancho, height: alto, channels: 3, background: '#7a1f2b' } }).webp().toFile(path.join(publicStorageDir, nombre));
    fotos.push(nombre);
    return `/storage/public/${nombre}`;
  }

  async function noticia(datos: { visible?: boolean; imagenUrl?: string | null } = {}) {
    const n = await db.noticia.create({
      data: {
        slug: `prueba-instagram-${crypto.randomBytes(6).toString('hex')}`, titulo: 'Besamanos de prueba',
        extracto: 'El sábado.', contenido: '<p>Texto</p>', visible: datos.visible ?? true, imagenUrl: datos.imagenUrl ?? null,
      },
    });
    noticias.push(n.id);
    return n.id;
  }

  before(async () => {
    const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
    dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
    if (!dbDisponible) return;
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    cuentaAntes = await db.cuentaInstagram.findUnique({ where: { id: 1 } });
    for (const rol of ['ADMIN', 'REDES', 'SECRETARIA'] as const) usuarios[rol] = (await crearUsuarioPrueba(Role[rol])).id;
  });

  beforeEach(async () => {
    if (!dbDisponible) return;
    publicadas = [];
    fijarClienteDePrueba(falso());
    await db.cuentaInstagram.deleteMany({ where: { id: 1 } });
  });

  after(async () => {
    fijarClienteDePrueba();
    if (dbDisponible) {
      server.close();
      // Como estaba: la base de desarrollo puede tener la cuenta de verdad conectada.
      await db.cuentaInstagram.deleteMany({ where: { id: 1 } });
      if (cuentaAntes) await db.cuentaInstagram.create({ data: cuentaAntes });
      await db.noticia.deleteMany({ where: { id: { in: noticias } } });
      await db.auditLog.deleteMany({ where: { userId: { in: Object.values(usuarios) } } });
      for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
      for (const nombre of fotos) await fs.unlink(path.join(publicStorageDir, nombre)).catch(() => {});
    }
    await db.$disconnect();
  });

  test('sin sesión no se ve nada, y Secretaría tampoco entra', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedir('/api/instagram')).status, 401);
    assert.equal((await pedir('/api/instagram', { rol: 'SECRETARIA' })).status, 403);
    assert.equal((await pedir('/api/instagram', { rol: 'REDES' })).status, 200);
  });

  test('conectar guarda la cuenta con el token cifrado, y el CMS nunca lo ve', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await pedir('/api/instagram', { rol: 'REDES', metodo: 'PUT', cuerpo: { token: TOKEN } });
    assert.equal(res.status, 200);
    assert.equal(res.cuerpo.conectada, true);
    assert.equal(res.cuerpo.usuario, 'grupo_de_prueba');
    assert.ok(!res.texto.includes(TOKEN));
    const fila = await db.cuentaInstagram.findUniqueOrThrow({ where: { id: 1 } });
    assert.ok(fila.token.startsWith('v1:'));
    assert.ok(!fila.token.includes(TOKEN));
    assert.ok(!(await pedir('/api/instagram', { rol: 'REDES' })).texto.includes('v1:'));
  });

  test('un token que Instagram no reconoce, o de una cuenta personal, no se guarda', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const malo = await pedir('/api/instagram', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { token: `IGAA${'y'.repeat(120)}` } });
    assert.equal(malo.status, 400);
    assert.match(malo.cuerpo.error, /no reconoce/);
    fijarClienteDePrueba(falso({ quienSoy: async () => ({ cuentaId: '1', usuario: 'personal', tipo: 'PERSONAL' }) }));
    const personal = await pedir('/api/instagram', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { token: TOKEN } });
    assert.equal(personal.status, 400);
    assert.match(personal.cuerpo.error, /cuenta personal/);
    assert.equal(await db.cuentaInstagram.count(), 0);
    assert.equal((await pedir('/api/instagram', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { token: 'https://algo con espacios' } })).status, 400);
  });

  test('publica la noticia en JPEG, apunta el enlace y borra la copia', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await InstagramService.conectar(TOKEN, usuarios.REDES);
    const id = await noticia({ imagenUrl: await fotoSubida(1080, 1920) });
    const res = await pedir(`/api/instagram/noticias/${id}`, { rol: 'REDES', metodo: 'POST', cuerpo: { pie: 'Besamanos #Málaga' } });
    assert.equal(res.status, 200, res.texto);
    assert.equal(res.cuerpo.instagramEnlace, 'https://www.instagram.com/p/prueba/');
    assert.equal(publicadas.length, 1);
    assert.equal(publicadas[0].cuentaId, '17841400000000000');
    assert.equal(publicadas[0].pie, 'Besamanos #Málaga');
    assert.match(publicadas[0].imagen, /\/storage\/public\/instagram\/[a-f0-9]{32}\.jpg$/);
    const meta = await sharp(publicadas[0].jpeg).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width! / meta.height!, 4 / 5);
    await assert.rejects(fs.access(path.join(carpetaParaInstagram(), path.basename(publicadas[0].imagen))));
    const guardada = await db.noticia.findUniqueOrThrow({ where: { id } });
    assert.equal(guardada.instagramId, '18000000000000001');
    assert.ok(guardada.instagramEl);
  });

  test('una ya publicada no se manda otra vez salvo que se pida', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await InstagramService.conectar(TOKEN, usuarios.REDES);
    const id = await noticia({ imagenUrl: await fotoSubida(1200, 800) });
    assert.equal((await pedir(`/api/instagram/noticias/${id}`, { rol: 'ADMIN', metodo: 'POST', cuerpo: { pie: 'Uno' } })).status, 200);
    const otra = await pedir(`/api/instagram/noticias/${id}`, { rol: 'ADMIN', metodo: 'POST', cuerpo: { pie: 'Dos' } });
    assert.equal(otra.status, 409);
    assert.equal(otra.cuerpo.yaPublicada, true);
    assert.equal((await pedir(`/api/instagram/noticias/${id}`, { rol: 'ADMIN', metodo: 'POST', cuerpo: { pie: 'Dos', otraVez: true } })).status, 200);
    assert.equal(publicadas.length, 2);
  });

  test('ni borradores, ni sin foto, ni sin cuenta, ni con un pie que Instagram rechazaría', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const conFoto = await noticia({ imagenUrl: await fotoSubida(800, 600) });
    const sinCuenta = await pedir(`/api/instagram/noticias/${conFoto}`, { rol: 'ADMIN', metodo: 'POST', cuerpo: { pie: 'Pie' } });
    assert.equal(sinCuenta.status, 409);
    assert.match(sinCuenta.cuerpo.error, /ninguna cuenta/);

    await InstagramService.conectar(TOKEN, usuarios.ADMIN);
    const borrador = await noticia({ visible: false, imagenUrl: await fotoSubida(800, 600) });
    assert.match((await pedir(`/api/instagram/noticias/${borrador}`, { rol: 'ADMIN', metodo: 'POST', cuerpo: { pie: 'Pie' } })).cuerpo.error, /Publícala antes/);
    const sinFoto = await noticia();
    assert.match((await pedir(`/api/instagram/noticias/${sinFoto}`, { rol: 'ADMIN', metodo: 'POST', cuerpo: { pie: 'Pie' } })).cuerpo.error, /sin foto/);
    const deLaWeb = await noticia({ imagenUrl: '/images/hero-1920.webp' });
    assert.match((await pedir(`/api/instagram/noticias/${deLaWeb}`, { rol: 'ADMIN', metodo: 'POST', cuerpo: { pie: 'Pie' } })).cuerpo.error, /subida desde el CMS/);
    assert.equal((await pedir(`/api/instagram/noticias/${conFoto}`, { rol: 'ADMIN', metodo: 'POST', cuerpo: { pie: '  ' } })).status, 400);
    assert.equal(publicadas.length, 0);
  });

  test('si el token ha caducado, lo dice y no apunta nada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await InstagramService.conectar(TOKEN, usuarios.ADMIN);
    fijarClienteDePrueba(falso({ publicarFoto: async () => { throw new ErrorDeInstagram('Error validating access token', 190); } }));
    const id = await noticia({ imagenUrl: await fotoSubida(800, 600) });
    const res = await pedir(`/api/instagram/noticias/${id}`, { rol: 'ADMIN', metodo: 'POST', cuerpo: { pie: 'Pie' } });
    assert.equal(res.status, 409);
    assert.match(res.cuerpo.error, /vuelve a conectar/);
    assert.equal((await db.noticia.findUniqueOrThrow({ where: { id } })).instagramId, null);
    assert.deepEqual(await fs.readdir(carpetaParaInstagram()).catch(() => []), []);
  });

  test('renueva el token a la semana y apunta el fallo si no puede', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await InstagramService.conectar(TOKEN, usuarios.ADMIN);
    const conectada = await db.cuentaInstagram.findUniqueOrThrow({ where: { id: 1 } });

    await InstagramService.renovarSiToca(new Date(conectada.renovadoEl.getTime() + 60_000));
    assert.equal((await db.cuentaInstagram.findUniqueOrThrow({ where: { id: 1 } })).token, conectada.token);

    const enUnaSemana = new Date(conectada.renovadoEl.getTime() + RENOVAR_CADA);
    await InstagramService.renovarSiToca(enUnaSemana);
    const renovada = await db.cuentaInstagram.findUniqueOrThrow({ where: { id: 1 } });
    assert.notEqual(renovada.token, conectada.token);
    assert.equal(renovada.renovadoEl.getTime(), enUnaSemana.getTime());
    assert.equal(renovada.caducaEl.getTime(), enUnaSemana.getTime() + 5_184_000_000);

    fijarClienteDePrueba(falso({ renovar: async () => { throw new ErrorDeInstagram('Session has expired', 190); } }));
    await InstagramService.renovarSiToca(new Date(enUnaSemana.getTime() + RENOVAR_CADA));
    assert.match((await InstagramService.estado()).errorAlRenovar!, /volver a conectar/);
  });

  test('desconectar quita la cuenta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await InstagramService.conectar(TOKEN, usuarios.ADMIN);
    const res = await pedir('/api/instagram', { rol: 'ADMIN', metodo: 'DELETE' });
    assert.equal(res.status, 200);
    assert.equal(res.cuerpo.conectada, false);
    assert.equal(await db.cuentaInstagram.count(), 0);
  });
});
