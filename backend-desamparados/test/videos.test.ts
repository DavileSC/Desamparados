// test/videos.test.ts
//
// Los vídeos propios del hero y de las galerías: el servidor no los recomprime
// (no hay CPU para eso en el VPS), así que lo que se prueba es que solo entra
// lo que ya viene listo para la web: MP4 en H.264, dentro de su tope de peso,
// de duración y de tamaño de imagen.
//
// Los MP4 se fabrican aquí byte a byte, con las cajas justas que lee
// `domain/mp4.ts`: así las pruebas no dependen de tener ffmpeg ni de ficheros
// de vídeo en el repositorio.
//
// El primer import aísla storage/ en una carpeta temporal.

import { almacenPublico } from './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Role } from '@prisma/client';
import { type } from 'arktype';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { duracionEnPalabras, leerMp4, problemaDelVideo, topesDeVideo } from '../src/domain/mp4.js';
import { medioGaleriaSchema, problemaDelMedio } from '../src/schemas/medios.schema.js';
import { esquemaDeSlug } from '../src/schemas/contenido.schema.js';
import { porDefecto } from '../src/domain/contenido.js';
import { subidasEnTexto, nombreDeSubida } from '../src/utils/ficheros-publicos.js';
import { ContenidoService } from '../src/services/contenido.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

// ---------------------------------------------------------------------------
// Un MP4 de juguete
// ---------------------------------------------------------------------------

function caja(tipo: string, ...contenido: Buffer[]): Buffer {
  const cuerpo = Buffer.concat(contenido);
  const cabecera = Buffer.alloc(8);
  cabecera.writeUInt32BE(8 + cuerpo.length, 0);
  cabecera.write(tipo, 4, 'latin1');
  return Buffer.concat([cabecera, cuerpo]);
}

const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };

function pista(tipo: 'vide' | 'soun', formato: string, ancho = 0, alto = 0): Buffer {
  const entrada = tipo === 'vide'
    ? caja(formato, Buffer.alloc(24), u16(ancho), u16(alto), Buffer.alloc(50))
    : caja(formato, Buffer.alloc(28));
  const hdlr = caja('hdlr', Buffer.alloc(4), Buffer.alloc(4), Buffer.from(tipo, 'latin1'), Buffer.alloc(13));
  const stsd = caja('stsd', Buffer.alloc(4), u32(1), entrada);
  return caja('trak', caja('tkhd', Buffer.alloc(84)), caja('mdia', caja('mdhd', Buffer.alloc(24)), hdlr, caja('minf', caja('stbl', stsd))));
}

interface OpcionesMp4 {
  segundos?: number;
  ancho?: number;
  alto?: number;
  codec?: string;
  audio?: string | null;
  /** Relleno de `mdat`, para llegar a un peso. */
  bytes?: number;
  /** `moov` al final, como graban muchos móviles. */
  indiceAlFinal?: boolean;
}

function mp4({ segundos = 10, ancho = 1280, alto = 720, codec = 'avc1', audio = 'mp4a', bytes = 1024, indiceAlFinal = false }: OpcionesMp4 = {}): Buffer {
  const ftyp = caja('ftyp', Buffer.from('isom', 'latin1'), u32(0x200), Buffer.from('isomiso2avc1mp41', 'latin1'));
  const escala = 1000;
  const mvhd = caja('mvhd', Buffer.alloc(4), u32(0), u32(0), u32(escala), u32(Math.round(segundos * escala)), Buffer.alloc(80));
  const moov = caja('moov', mvhd, pista('vide', codec, ancho, alto), ...(audio ? [pista('soun', audio)] : []));
  const mdat = caja('mdat', Buffer.alloc(bytes, 7));
  return Buffer.concat(indiceAlFinal ? [ftyp, mdat, moov] : [ftyp, moov, mdat]);
}

// ---------------------------------------------------------------------------
// El lector
// ---------------------------------------------------------------------------

describe('leer un MP4 por sus cabeceras', () => {
  test('saca la duración, el códec y el tamaño de la imagen', () => {
    const info = leerMp4(mp4({ segundos: 12.5, ancho: 1920, alto: 1080 }));
    assert.ok(info);
    assert.equal(info.duracion, 12.5);
    assert.deepEqual(info.pistas, [
      { tipo: 'vide', formato: 'avc1', ancho: 1920, alto: 1080 },
      { tipo: 'soun', formato: 'mp4a' },
    ]);
    assert.equal(info.empiezaEnSeguida, true);
  });

  test('lee también el MP4 con el índice al final, y lo dice', () => {
    const info = leerMp4(mp4({ indiceAlFinal: true }));
    assert.ok(info);
    assert.equal(info.empiezaEnSeguida, false);
  });

  test('un fichero que no es MP4, vacío o recortado da null y no lanza', () => {
    const bueno = mp4();
    assert.equal(leerMp4(Buffer.alloc(0)), null);
    assert.equal(leerMp4(Buffer.from('<html>hola</html>')), null);
    for (const corte of [10, 40, 120, bueno.length - 1100]) {
      assert.doesNotThrow(() => leerMp4(bueno.subarray(0, corte)));
    }
    assert.equal(leerMp4(bueno.subarray(0, 40)), null);
  });

  test('una caja que dice medir más que el fichero no hace leer fuera', () => {
    const roto = mp4();
    roto.writeUInt32BE(0x7fffffff, 32); // el tamaño de moov
    assert.equal(leerMp4(roto), null);
  });
});

describe('qué vídeo se acepta', () => {
  test('un 720p de 10 s en H.264 con AAC vale en los dos sitios', () => {
    assert.equal(problemaDelVideo(leerMp4(mp4()), 'hero'), null);
    assert.equal(problemaDelVideo(leerMp4(mp4()), 'galeria'), null);
  });

  test('sin sonido también vale', () => {
    assert.equal(problemaDelVideo(leerMp4(mp4({ audio: null })), 'hero'), null);
  });

  test('H.265 (el de los iPhone) no: no se ve en todos los navegadores', () => {
    assert.match(problemaDelVideo(leerMp4(mp4({ codec: 'hvc1' })), 'galeria') ?? '', /H\.264.*hvc1/);
  });

  test('el sonido tiene que ser AAC', () => {
    assert.match(problemaDelVideo(leerMp4(mp4({ audio: 'Opus' })), 'galeria') ?? '', /AAC/);
  });

  test('la duración máxima es 30 s en el hero y 2 minutos en la galería, con medio segundo de margen', () => {
    assert.equal(topesDeVideo('hero').maxSegundos, 30);
    assert.equal(topesDeVideo('galeria').maxSegundos, 120);
    assert.equal(problemaDelVideo(leerMp4(mp4({ segundos: 30.3 })), 'hero'), null);
    assert.match(problemaDelVideo(leerMp4(mp4({ segundos: 45 })), 'hero') ?? '', /dura 45 segundos.*máximo son 30 segundos/);
    // Un minuto y pico en 7–10 MB: el caso de la mayoría de clips del Grupo.
    assert.equal(problemaDelVideo(leerMp4(mp4({ segundos: 75 })), 'galeria'), null);
    assert.equal(problemaDelVideo(leerMp4(mp4({ segundos: 120.4 })), 'galeria'), null);
    assert.match(problemaDelVideo(leerMp4(mp4({ segundos: 135 })), 'galeria') ?? '', /dura 2 min 15 s.*máximo son 2 minutos.*YouTube/);
  });

  test('la duración se dice como se habla', () => {
    assert.equal(duracionEnPalabras(45), '45 segundos');
    assert.equal(duracionEnPalabras(60), '1 minuto');
    assert.equal(duracionEnPalabras(90.2), '1 min 30 s');
    assert.equal(duracionEnPalabras(120), '2 minutos');
  });

  test('hasta 1080p, en horizontal o en vertical; 4K no', () => {
    assert.equal(problemaDelVideo(leerMp4(mp4({ ancho: 1080, alto: 1920 })), 'galeria'), null);
    assert.match(problemaDelVideo(leerMp4(mp4({ ancho: 3840, alto: 2160 })), 'galeria') ?? '', /3840×2160/);
    assert.match(problemaDelVideo(leerMp4(mp4({ ancho: 1440, alto: 1440 })), 'galeria') ?? '', /1920×1080/);
  });

  test('los topes de peso son 5 MB en el hero y 15 MB en la galería', () => {
    assert.equal(topesDeVideo('hero').maxBytes, 5 * 1024 * 1024);
    assert.equal(topesDeVideo('galeria').maxBytes, 15 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// Dónde se puede poner
// ---------------------------------------------------------------------------

const VIDEO = '/storage/public/0123456789abcdef0123456789abcdef.mp4';
const PORTADA = '/storage/public/0123456789abcdef0123456789abcdef.webp';

describe('vídeos propios en galerías y en el hero', () => {
  test('una galería admite un vídeo subido, con su portada y su descripción', () => {
    const medio = { tipo: 'video' as const, url: VIDEO, portada: PORTADA, alt: 'La salida', pie: '' };
    assert.ok(!(medioGaleriaSchema(medio) instanceof type.errors));
    assert.equal(problemaDelMedio(medio), null);
    assert.equal(problemaDelMedio({ ...medio, portada: '' })?.campo, 'portada');
  });

  test('un MP4 de fuera o de otra carpeta no es un vídeo propio', () => {
    for (const url of ['https://otro.sitio/video.mp4', '/storage/public/sub/0123456789abcdef0123456789abcdef.mp4', '/storage/public/video.mp4']) {
      assert.equal(problemaDelMedio({ tipo: 'video', url, portada: PORTADA, alt: 'x' })?.campo, 'url', url);
    }
  });

  test('el hero acepta un vídeo propio o nada, y nada más', () => {
    const esquema = esquemaDeSlug('portada');
    const portada = porDefecto('portada') as { hero: Record<string, string> };
    assert.equal(portada.hero.video, '');
    assert.ok(!(esquema(portada) instanceof type.errors));
    assert.ok(!(esquema({ ...portada, hero: { ...portada.hero, video: VIDEO } }) instanceof type.errors));
    assert.ok(esquema({ ...portada, hero: { ...portada.hero, video: 'https://youtu.be/abcdefghijk' } }) instanceof type.errors);
    assert.ok(esquema({ ...portada, hero: { ...portada.hero, video: PORTADA } }) instanceof type.errors);
  });

  test('los vídeos cuentan para el limpiador de ficheros sin uso', () => {
    assert.equal(nombreDeSubida(VIDEO), '0123456789abcdef0123456789abcdef.mp4');
    assert.deepEqual([...subidasEnTexto(JSON.stringify({ hero: { video: VIDEO } }))], ['0123456789abcdef0123456789abcdef.mp4']);
  });
});

// ---------------------------------------------------------------------------
// Subida de extremo a extremo
// ---------------------------------------------------------------------------

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

const entornoAntivirus = { CLAMAV_HOST: process.env.CLAMAV_HOST, CLAMAV_REQUIRED: process.env.CLAMAV_REQUIRED };

before(async () => {
  delete process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_REQUIRED;
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  dbDisponible = await sondearDb();
  if (dbDisponible) usuarioId = (await crearUsuarioPrueba(Role.REDES)).id;
});

after(async () => {
  for (const [clave, valor] of Object.entries(entornoAntivirus)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
  server.close();
  if (usuarioId) await borrarUsuarioPrueba(usuarioId);
  await db.$disconnect();
});

function subirVideo(contenido: Buffer, uso: string, nombre = 'procesion.mp4', tipo = 'video/mp4') {
  const formulario = new FormData();
  formulario.append('file', new Blob([new Uint8Array(contenido)], { type: tipo }), nombre);
  return fetch(`${baseUrl}/api/upload/video/${uso}`, {
    method: 'POST',
    headers: { Cookie: `${COOKIE_CMS}=${generateToken(usuarioId, Role.REDES)}` },
    body: formulario,
  });
}

const ficheros = async () => (await readdir(almacenPublico, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name).sort();
const errorDe = async (res: Response) => ((await res.json()) as { error: string }).error;

describe('subir un vídeo', () => {
  test('un MP4 bueno se guarda tal cual, sin recomprimir, con nombre aleatorio', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const video = mp4();
    const res = await subirVideo(video, 'galeria');
    assert.equal(res.status, 201, await res.clone().text());
    const { data } = await res.json() as { data: { filename: string } };
    assert.match(data.filename, /^[a-f0-9]{32}\.mp4$/);
    assert.ok((await ficheros()).includes(data.filename));
  });

  test('lo que no es un MP4 de verdad no pasa, aunque se llame .mp4, y no queda en disco', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = await ficheros();
    assert.equal((await subirVideo(Buffer.from('<html>no soy un vídeo</html>'), 'galeria')).status, 400);
    // Un .mov (el de los iPhone) ni siquiera entra por la extensión.
    assert.equal((await subirVideo(mp4(), 'galeria', 'procesion.mov', 'video/quicktime')).status, 400);
    assert.deepEqual(await ficheros(), antes);
  });

  test('un vídeo en H.265 o demasiado largo se rechaza diciendo qué cambiar, y no queda en disco', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = await ficheros();
    const h265 = await subirVideo(mp4({ codec: 'hvc1' }), 'galeria');
    assert.equal(h265.status, 400);
    assert.match(await errorDe(h265), /HandBrake/);
    const largo = await subirVideo(mp4({ segundos: 45 }), 'hero');
    assert.equal(largo.status, 400);
    assert.match(await errorDe(largo), /30 segundos/);
    assert.deepEqual(await ficheros(), antes);
  });

  test('el tope de peso es el de su uso: 6 MB vale para la galería y no para el hero', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = await ficheros();
    const seisMegas = mp4({ bytes: 6 * 1024 * 1024 });
    const hero = await subirVideo(seisMegas, 'hero');
    assert.equal(hero.status, 413);
    assert.match(await errorDe(hero), /5 MB/);
    assert.deepEqual(await ficheros(), antes);
    assert.equal((await subirVideo(seisMegas, 'galeria')).status, 201);
  });

  test('más de 15 MB lo corta la subida antes de leerlo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = await ficheros();
    assert.equal((await subirVideo(mp4({ bytes: 16 * 1024 * 1024 }), 'galeria')).status, 413);
    assert.deepEqual(await ficheros(), antes);
  });

  test('un destino que no existe da 404 y no deja nada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = await ficheros();
    assert.equal((await subirVideo(mp4(), 'noticias')).status, 404);
    assert.deepEqual(await ficheros(), antes);
  });

  test('sin sesión del CMS no se sube', async () => {
    const formulario = new FormData();
    formulario.append('file', new Blob([new Uint8Array(mp4())], { type: 'video/mp4' }), 'v.mp4');
    const res = await fetch(`${baseUrl}/api/upload/video/galeria`, { method: 'POST', body: formulario });
    assert.equal(res.status, 401);
  });
});

describe('el vídeo del hero al guardar la portada', () => {
  const portadaCon = (video: string) => {
    const portada = porDefecto('portada') as { hero: Record<string, string> };
    return { ...portada, hero: { ...portada.hero, video } };
  };

  test('uno que ya no está en disco, o que pesa más de 5 MB, no se guarda', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(ContenidoService.guardar('portada', portadaCon(VIDEO)), /ya no está/);
    const pesado = 'fedcba9876543210fedcba9876543210.mp4';
    await writeFile(path.join(almacenPublico, pesado), Buffer.alloc(5 * 1024 * 1024 + 1));
    await assert.rejects(ContenidoService.guardar('portada', portadaCon(`/storage/public/${pesado}`)), /5 MB/);
  });
});
