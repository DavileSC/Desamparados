// Publicar las noticias en X: la firma OAuth y la cuenta del texto, sin red
// ni base, y, contra MariaDB y con una X de mentira, conectar la cuenta,
// quién puede, publicar una noticia con foto o sin ella y los fallos de las
// claves. Nunca sale nada a la red: `fijarClienteDePrueba`.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import sharp from 'sharp';
import { Role, type CuentaX } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { publicStorageDir } from '../src/middleware/upload.middleware.js';
import { LADO_FOTO_X, LARGO_MAXIMO_X, largoEnX, problemaDelTextoX, textoParaX } from '../src/domain/x.js';
import { ErrorDeX, firmaOAuth, fijarClienteDePrueba, type ClavesX, type ClienteX } from '../src/services/redes/x-api.js';
import { XService } from '../src/services/redes/x.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

describe('firmaOAuth', () => {
  test('da la firma del ejemplo de la documentación de X', () => {
    // «Creating a signature», developer.x.com: mismas claves, nonce y hora.
    const cabecera = firmaOAuth('POST', 'https://api.twitter.com/1.1/statuses/update.json', {
      apiKey: 'xvz1evFS4wEEPTGEFPHBog',
      apiSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
      accessToken: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
      accessSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
    }, { include_entities: 'true', status: 'Hello Ladies + Gentlemen, a signed OAuth request!' }, {
      nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg', momento: 1318622958,
    });
    assert.match(cabecera, /^OAuth /);
    assert.ok(cabecera.includes('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"'), cabecera);
  });
});

describe('el texto de X', () => {
  test('propone título y dirección', () => {
    assert.equal(textoParaX({ titulo: ' Besamanos ', direccion: 'https://ejemplo.es/noticias/b' }), 'Besamanos\n\nhttps://ejemplo.es/noticias/b');
  });

  test('cuenta los enlaces como 23 y los emojis como 2', () => {
    assert.equal(largoEnX('Hola'), 4);
    assert.equal(largoEnX(`Mira https://ejemplo.es/${'a'.repeat(100)}`), 5 + 23);
    assert.equal(largoEnX('Misa 🙏'), 7);
    assert.equal(largoEnX('Misa 👍🏽'), 7);
    assert.equal(largoEnX('Málaga ñ'), 8);
  });

  test('dice lo que X rechazaría', () => {
    assert.equal(problemaDelTextoX('Un texto'), null);
    assert.match(problemaDelTextoX('  ')!, /vacío/);
    assert.match(problemaDelTextoX('x'.repeat(LARGO_MAXIMO_X + 1))!, /281/);
    // Un enlace larguísimo no pasa el tope: cuenta 23.
    assert.equal(problemaDelTextoX(`Hola https://ejemplo.es/${'a'.repeat(400)}`), null);
  });
});

describe('X contra la base de datos', () => {
  const CLAVES: ClavesX = {
    apiKey: 'aaaaaaaaaaaaaaaaaaaaaaaaa',
    apiSecret: 'b'.repeat(50),
    accessToken: `1234567890-${'c'.repeat(40)}`,
    accessSecret: 'd'.repeat(45),
  };
  let server: Server;
  let baseUrl: string;
  let dbDisponible = false;
  let cuentaAntes: CuentaX | null = null;
  const usuarios: Partial<Record<'ADMIN' | 'REDES' | 'SECRETARIA', number>> = {};
  const noticias: number[] = [];
  const fotos: string[] = [];
  /** Lo que «X» ha recibido en esta prueba. */
  let fotosSubidas: Buffer[] = [];
  let posts: { texto: string; fotoId: string | null }[] = [];

  const falso = (cambios: Partial<ClienteX> = {}): ClienteX => ({
    quienSoy: async (claves) => {
      if (claves.accessSecret !== CLAVES.accessSecret) throw new ErrorDeX('Unauthorized', 401);
      return { cuentaId: '1234567890', usuario: 'grupo_de_prueba' };
    },
    subirFoto: async (_claves, jpeg) => {
      fotosSubidas.push(jpeg);
      return `foto-${fotosSubidas.length}`;
    },
    publicar: async (_claves, texto, fotoId) => {
      posts.push({ texto, fotoId });
      return { id: `19000000000000000${posts.length}` };
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
        slug: `prueba-x-${crypto.randomBytes(6).toString('hex')}`, titulo: 'Besamanos de prueba',
        extracto: 'El sábado.', contenido: '<p>Texto</p>', visible: datos.visible ?? true, imagenUrl: datos.imagenUrl ?? null,
      },
    });
    noticias.push(n.id);
    return n.id;
  }

  const publicar = (id: number, cuerpo: object, rol: keyof typeof usuarios = 'ADMIN') =>
    pedir(`/api/x/noticias/${id}`, { rol, metodo: 'POST', cuerpo: { texto: 'Besamanos https://ejemplo.es/b', conFoto: false, ...cuerpo } });

  before(async () => {
    const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
    dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
    if (!dbDisponible) return;
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    cuentaAntes = await db.cuentaX.findUnique({ where: { id: 1 } });
    for (const rol of ['ADMIN', 'REDES', 'SECRETARIA'] as const) usuarios[rol] = (await crearUsuarioPrueba(Role[rol])).id;
  });

  beforeEach(async () => {
    if (!dbDisponible) return;
    fotosSubidas = [];
    posts = [];
    fijarClienteDePrueba(falso());
    await db.cuentaX.deleteMany({ where: { id: 1 } });
  });

  after(async () => {
    fijarClienteDePrueba();
    if (dbDisponible) {
      server.close();
      // Como estaba: la base de desarrollo puede tener la cuenta de verdad conectada.
      await db.cuentaX.deleteMany({ where: { id: 1 } });
      if (cuentaAntes) await db.cuentaX.create({ data: cuentaAntes });
      await db.noticia.deleteMany({ where: { id: { in: noticias } } });
      await db.auditLog.deleteMany({ where: { userId: { in: Object.values(usuarios) } } });
      for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
      for (const nombre of fotos) await fs.unlink(path.join(publicStorageDir, nombre)).catch(() => {});
    }
    await db.$disconnect();
  });

  test('sin sesión no se ve nada, y Secretaría tampoco entra', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedir('/api/x')).status, 401);
    assert.equal((await pedir('/api/x', { rol: 'SECRETARIA' })).status, 403);
    assert.equal((await pedir('/api/x', { rol: 'REDES' })).status, 200);
  });

  test('conectar guarda las claves cifradas, y el CMS nunca las ve', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await pedir('/api/x', { rol: 'REDES', metodo: 'PUT', cuerpo: { ...CLAVES, apiKey: `  ${CLAVES.apiKey}  ` } });
    assert.equal(res.status, 200, res.texto);
    assert.equal(res.cuerpo.conectada, true);
    assert.equal(res.cuerpo.usuario, 'grupo_de_prueba');
    for (const clave of Object.values(CLAVES)) assert.ok(!res.texto.includes(clave));
    const fila = await db.cuentaX.findUniqueOrThrow({ where: { id: 1 } });
    assert.ok(fila.claves.startsWith('v1:'));
    assert.ok(!fila.claves.includes(CLAVES.accessSecret));
    assert.ok(!(await pedir('/api/x', { rol: 'REDES' })).texto.includes('v1:'));
  });

  test('unas claves que X no reconoce, o mal pegadas, no se guardan', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const malas = await pedir('/api/x', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { ...CLAVES, accessSecret: 'e'.repeat(45) } });
    assert.equal(malas.status, 400);
    assert.match(malas.cuerpo.error, /no reconoce/);
    // El Access Token Secret en el sitio del Access Token: no lleva el id delante.
    assert.equal((await pedir('/api/x', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { ...CLAVES, accessToken: CLAVES.accessSecret } })).status, 400);
    assert.equal((await pedir('/api/x', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { ...CLAVES, apiKey: 'una clave con espacios' } })).status, 400);
    assert.equal(await db.cuentaX.count(), 0);
  });

  test('publica con la foto en JPEG y apunta el enlace del post', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await XService.conectar(CLAVES, usuarios.REDES);
    const id = await noticia({ imagenUrl: await fotoSubida(3000, 2000) });
    const res = await publicar(id, { conFoto: true }, 'REDES');
    assert.equal(res.status, 200, res.texto);
    assert.equal(res.cuerpo.xEnlace, 'https://x.com/grupo_de_prueba/status/190000000000000001');
    assert.deepEqual(posts, [{ texto: 'Besamanos https://ejemplo.es/b', fotoId: 'foto-1' }]);
    const meta = await sharp(fotosSubidas[0]).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, LADO_FOTO_X);
    assert.equal(meta.height, Math.round(LADO_FOTO_X * 2 / 3));
    const guardada = await db.noticia.findUniqueOrThrow({ where: { id } });
    assert.equal(guardada.xId, '190000000000000001');
    assert.ok(guardada.xEl);
  });

  test('sin foto, publica solo el texto; con una foto que no se puede mandar, lo dice', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await XService.conectar(CLAVES, usuarios.ADMIN);
    const sinFoto = await noticia();
    assert.equal((await publicar(sinFoto, { conFoto: false })).status, 200);
    assert.deepEqual(posts.map((p) => p.fotoId), [null]);
    assert.equal(fotosSubidas.length, 0);
    assert.match((await publicar(await noticia(), { conFoto: true })).cuerpo.error, /no tiene foto/);
    assert.match((await publicar(await noticia({ imagenUrl: '/images/hero-1920.webp' }), { conFoto: true })).cuerpo.error, /de las que trae la web/);
    assert.equal(posts.length, 1);
  });

  test('una ya publicada no se manda otra vez salvo que se pida', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await XService.conectar(CLAVES, usuarios.REDES);
    const id = await noticia();
    assert.equal((await publicar(id, {})).status, 200);
    const otra = await publicar(id, { texto: 'Otra vez' });
    assert.equal(otra.status, 409);
    assert.equal(otra.cuerpo.yaPublicada, true);
    assert.equal((await publicar(id, { texto: 'Otra vez', otraVez: true })).status, 200);
    assert.equal(posts.length, 2);
  });

  test('ni borradores, ni sin cuenta, ni un texto que X rechazaría', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const id = await noticia();
    const sinCuenta = await publicar(id, {});
    assert.equal(sinCuenta.status, 409);
    assert.match(sinCuenta.cuerpo.error, /ninguna cuenta/);

    await XService.conectar(CLAVES, usuarios.ADMIN);
    assert.match((await publicar(await noticia({ visible: false }), {})).cuerpo.error, /Publícala antes/);
    assert.equal((await publicar(id, { texto: '  ' })).status, 400);
    assert.match((await publicar(id, { texto: 'x'.repeat(281) })).cuerpo.error, /280/);
    assert.equal(posts.length, 0);
  });

  test('claves de solo lectura: lo dice, lo apunta en la cuenta y se borra al publicar bien', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await XService.conectar(CLAVES, usuarios.ADMIN);
    fijarClienteDePrueba(falso({
      publicar: async () => { throw new ErrorDeX('You are not permitted to perform this action.', 403, 'https://api.twitter.com/2/problems/oauth1-permissions'); },
    }));
    const id = await noticia();
    const res = await publicar(id, {});
    assert.equal(res.status, 409);
    assert.match(res.cuerpo.error, /solo lectura/);
    assert.match((await XService.estado()).errorDeClaves!, /Read and write/);
    assert.equal((await db.noticia.findUniqueOrThrow({ where: { id } })).xId, null);

    fijarClienteDePrueba(falso());
    assert.equal((await publicar(id, {})).status, 200);
    assert.equal((await XService.estado()).errorDeClaves, null);
  });

  test('los demás fallos de X, dichos para quien publica', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await XService.conectar(CLAVES, usuarios.ADMIN);
    const id = await noticia();
    const con = async (error: ErrorDeX) => {
      fijarClienteDePrueba(falso({ publicar: async () => { throw error; } }));
      return publicar(id, {});
    };
    assert.match((await con(new ErrorDeX('You are not allowed to create a Tweet with duplicate content.', 403))).cuerpo.error, /mismo texto/);
    assert.match((await con(new ErrorDeX('Payment Required', 402))).cuerpo.error, /saldo/);
    assert.equal((await con(new ErrorDeX('Too Many Requests', 429))).status, 429);
    const caidas = await con(new ErrorDeX('Unauthorized', 401));
    assert.match(caidas.cuerpo.error, /vuelve a conectar/);
    assert.match((await XService.estado()).errorDeClaves!, /vuelve a conectar/);
  });

  test('desconectar quita la cuenta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await XService.conectar(CLAVES, usuarios.ADMIN);
    const res = await pedir('/api/x', { rol: 'ADMIN', metodo: 'DELETE' });
    assert.equal(res.status, 200);
    assert.equal(res.cuerpo.conectada, false);
    assert.equal(await db.cuentaX.count(), 0);
  });
});
