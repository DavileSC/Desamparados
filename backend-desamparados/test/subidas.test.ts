// test/subidas.test.ts
//
// La subida de archivos del CMS: fotos sin metadatos (C5), topes distintos para
// fotos y PDF (C2) y el antivirus que avisa cuando no está y no confunde «caído»
// con «infectado» (S7).
//
// El primer import aísla storage/ en una carpeta temporal: ninguna prueba deja
// ficheros en el storage del repositorio.

import { almacenPublico } from './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, afterEach, before, describe, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import net from 'node:net';
import type { Server } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { publicStorageDir, MAX_BYTES_IMAGEN, MAX_BYTES_PDF } from '../src/middleware/upload.middleware.js';
import { recodificarSinMetadatos } from '../src/controllers/subida.controller.js';
import { parseClamdResponse, reiniciarAvisoSinAntivirus, scanBufferClamav } from '../src/utils/clamd.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

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

// El entorno del antivirus lo cambian varias pruebas: se deja como estaba.
const entornoAntivirus = { CLAMAV_HOST: process.env.CLAMAV_HOST, CLAMAV_PORT: process.env.CLAMAV_PORT, CLAMAV_REQUIRED: process.env.CLAMAV_REQUIRED };
function restaurarAntivirus() {
  for (const [clave, valor] of Object.entries(entornoAntivirus)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
}

before(async () => {
  restaurarAntivirus();
  delete process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_REQUIRED;
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  dbDisponible = await sondearDb();
  if (dbDisponible) usuarioId = (await crearUsuarioPrueba(Role.REDES)).id;
});

after(async () => {
  restaurarAntivirus();
  server.close();
  if (usuarioId) await borrarUsuarioPrueba(usuarioId);
  await db.$disconnect();
});

afterEach(() => {
  delete process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_PORT;
  delete process.env.CLAMAV_REQUIRED;
});

function subir(contenido: Buffer, nombre: string, tipo: string) {
  const formulario = new FormData();
  formulario.append('file', new Blob([new Uint8Array(contenido)], { type: tipo }), nombre);
  return fetch(`${baseUrl}/api/upload/public`, {
    method: 'POST',
    headers: { Cookie: `${COOKIE_CMS}=${generateToken(usuarioId, Role.REDES)}` },
    body: formulario,
  });
}

const ficherosEnAlmacen = async () => (await readdir(almacenPublico, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name);

/** Una foto de 40×20 con GPS en el EXIF y la orientación «girar 90°», como las de un móvil en vertical. */
async function fotoDeMovil() {
  return sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 20, b: 20 } } })
    .withExif({ IFD0: { Copyright: 'Autor de prueba' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '36/1 43/1 12/1' } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
}

/** Píxeles RGB de un degradado con ruido: se comprime como una foto, no como un color liso. */
function fotoConRuido(ancho: number, alto: number) {
  const pixeles = Buffer.alloc(ancho * alto * 3);
  let semilla = 7;
  for (let i = 0; i < pixeles.length; i++) {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    const base = i % 3 === 0 ? (i / 3) % ancho : i % 3 === 1 ? Math.floor(i / 3 / ancho) : 128;
    pixeles[i] = Math.max(0, Math.min(255, Math.round(base * 255 / ancho) + (semilla % 40) - 20));
  }
  return pixeles;
}

/** Un PDF mínimo relleno hasta `bytes`: file-type lo reconoce por la cabecera. */
function pdfDe(bytes: number) {
  const cabecera = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n');
  const final = Buffer.from('\n%%EOF\n');
  return Buffer.concat([cabecera, Buffer.alloc(Math.max(0, bytes - cabecera.length - final.length), 0x20), final]);
}

/** Un clamd de mentira que responde siempre lo mismo. */
async function clamdFalso(respuesta: string) {
  const falso = net.createServer((socket) => {
    socket.on('data', (datos) => {
      // El socket podría estar en modo texto; aquí nunca lo está, pero así no
      // hace falta una conversión a ciegas para leer los últimos cuatro bytes.
      const trozo = Buffer.isBuffer(datos) ? datos : Buffer.from(datos);
      // El trozo de longitud 0 cierra el flujo: entonces se contesta.
      if (trozo.subarray(-4).equals(Buffer.alloc(4))) socket.end(`${respuesta}\0`);
    });
  });
  await new Promise<void>((r) => falso.listen(0, '127.0.0.1', r));
  return { puerto: (falso.address() as AddressInfo).port, cerrar: () => new Promise((r) => falso.close(r)) };
}

describe('almacén de los tests', () => {
  test('las subidas de estas pruebas van a una carpeta temporal, no al storage del repositorio', () => {
    assert.equal(publicStorageDir, almacenPublico);
  });
});

describe('fotos sin metadatos (C5)', () => {
  test('recodificar quita el EXIF (GPS incluido) y aplica la orientación a los píxeles', async () => {
    const original = await fotoDeMovil();
    const antes = await sharp(original).metadata();
    assert.equal(antes.orientation, 6);
    assert.ok(antes.exif, 'la foto de prueba tiene que llevar EXIF para que la prueba signifique algo');

    const limpia = await recodificarSinMetadatos(original, 'image/jpeg');
    const despues = await sharp(limpia).metadata();
    assert.equal(despues.format, 'jpeg', 'conserva el formato para no romper la extensión');
    assert.equal(despues.exif, undefined, 'el EXIF (con el GPS) debe desaparecer');
    assert.equal(despues.orientation, undefined);
    assert.deepEqual([despues.width, despues.height], [20, 40], 'la foto hecha en vertical debe quedar en vertical');
  });

  test('un JPEG ya comprimido no engorda al recodificarlo', async () => {
    // Antes salía a calidad 90: uno de calidad 70 crecía un tercio y podía servirse por encima de 5 MB.
    const original = await sharp(fotoConRuido(800, 600), { raw: { width: 800, height: 600, channels: 3 } }).jpeg({ quality: 70 }).toBuffer();
    const limpia = await recodificarSinMetadatos(original, 'image/jpeg');
    assert.ok(limpia.length <= original.length, `pasó de ${original.length} a ${limpia.length} bytes`);
  });

  test('un PNG de paleta sigue con paleta (y no crece), y uno de 16 bits sigue en 16', async () => {
    const paleta = await sharp(fotoConRuido(300, 200), { raw: { width: 300, height: 200, channels: 3 } }).png({ palette: true, colours: 64 }).toBuffer();
    const conPaleta = await recodificarSinMetadatos(paleta, 'image/png');
    assert.equal((await sharp(conPaleta).metadata()).isPalette, true);
    assert.ok(conPaleta.length <= paleta.length * 1.1, `pasó de ${paleta.length} a ${conPaleta.length} bytes`);

    const dieciseis = await sharp({ create: { width: 30, height: 30, channels: 3, background: '#123456' } }).toColourspace('rgb16').png().toBuffer();
    const limpia = await recodificarSinMetadatos(dieciseis, 'image/png');
    assert.equal((await sharp(limpia).metadata()).depth, 'ushort');
  });

  test('una WebP animada conserva todos sus fotogramas', async () => {
    const fotograma = (color: string) => sharp({ create: { width: 20, height: 10, channels: 3, background: color } }).png().toBuffer();
    const animada = await sharp([await fotograma('red'), await fotograma('blue'), await fotograma('green')], { join: { animated: true } }).webp().toBuffer();
    assert.equal((await sharp(animada, { animated: true }).metadata()).pages, 3);
    const limpia = await recodificarSinMetadatos(animada, 'image/webp');
    assert.equal((await sharp(limpia, { animated: true }).metadata()).pages, 3);
  });

  test('un archivo que no se puede decodificar no se recodifica: lanza', async () => {
    const roto = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
    await assert.rejects(recodificarSinMetadatos(roto, 'image/jpeg'));
  });

  test('la foto subida se guarda sin EXIF y enderezada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await subir(await fotoDeMovil(), 'movil.jpg', 'image/jpeg');
    assert.equal(res.status, 201, await res.clone().text());
    const { data } = await res.json() as { data: { filename: string } };
    const guardada = await sharp(await readFile(path.join(almacenPublico, data.filename))).metadata();
    assert.equal(guardada.exif, undefined);
    assert.deepEqual([guardada.width, guardada.height], [20, 40]);
  });

  test('la extensión se guarda en minúsculas (si no, nunca casaría con el filtro de borrado)', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
    const res = await subir(png, 'FOTO.PNG', 'image/png');
    assert.equal(res.status, 201);
    const { data } = await res.json() as { data: { filename: string } };
    assert.match(data.filename, /^[a-f0-9]{32}\.png$/);
  });

  test('una foto que dice ser JPEG y no se puede leer se rechaza y no se queda en disco', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = await ficherosEnAlmacen();
    const roto = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]), Buffer.alloc(500, 3)]);
    const res = await subir(roto, 'rota.jpg', 'image/jpeg');
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as { error: string }).error, /no se ha podido procesar la foto/i);
    assert.deepEqual(await ficherosEnAlmacen(), antes);
  });
});

describe('topes de tamaño (C2)', () => {
  test('los topes son 5 MB para fotos y 20 MB para PDF', () => {
    assert.equal(MAX_BYTES_IMAGEN, 5 * 1024 * 1024);
    assert.equal(MAX_BYTES_PDF, 20 * 1024 * 1024);
  });

  test('un PDF de 6 MB se acepta y se guarda byte a byte (sin recodificar)', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const pdf = pdfDe(6 * 1024 * 1024);
    const res = await subir(pdf, 'boletin.pdf', 'application/pdf');
    assert.equal(res.status, 201, await res.clone().text());
    const { data } = await res.json() as { data: { filename: string } };
    assert.match(data.filename, /^[a-f0-9]{32}\.pdf$/);
    assert.ok((await readFile(path.join(almacenPublico, data.filename))).equals(pdf));
  });

  test('un PDF que el navegador manda sin tipo o como octet-stream se acepta (se comprueban sus bytes)', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    for (const tipo of ['application/octet-stream', '']) {
      const res = await subir(pdfDe(4096), 'acta.pdf', tipo);
      assert.equal(res.status, 201, `con tipo «${tipo}»: ${await res.clone().text()}`);
    }
    // Una foto sin tipo sigue sin pasar: la excepción es solo para .pdf.
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
    assert.equal((await subir(png, 'foto.png', 'application/octet-stream')).status, 400);
    // Y un .pdf sin tipo que no es un PDF muere en la comprobación de bytes.
    assert.equal((await subir(Buffer.from('<html>no soy un pdf</html>'), 'falso.pdf', 'application/octet-stream')).status, 400);
  });

  test('una foto de más de 5 MB se rechaza con 413 y no se queda en disco', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = await ficherosEnAlmacen();
    const grande = Buffer.concat([await fotoDeMovil(), Buffer.alloc(MAX_BYTES_IMAGEN, 0)]);
    const res = await subir(grande, 'grande.jpg', 'image/jpeg');
    assert.equal(res.status, 413);
    assert.match(((await res.json()) as { error: string }).error, /5 MB/);
    assert.deepEqual(await ficherosEnAlmacen(), antes);
  });

  test('un PDF de más de 20 MB no se acepta y no se queda en disco', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = await ficherosEnAlmacen();
    const res = await subir(pdfDe(MAX_BYTES_PDF + 1024), 'enorme.pdf', 'application/pdf');
    // Lo corta multer (LIMIT_FILE_SIZE) y el 413 lo pone el manejador de
    // errores global (error.middleware.ts), no el controlador de subidas.
    assert.equal(res.status, 413);
    assert.deepEqual(await ficherosEnAlmacen(), antes, 'multer tiene que borrar el trozo que alcanzó a escribir');
  });
});

describe('antivirus (S7)', () => {
  test('interpreta las respuestas de clamd en sus cuatro veredictos', () => {
    assert.equal(parseClamdResponse('stream: OK\0').veredicto, 'limpio');
    assert.equal(parseClamdResponse('stream: Eicar-Signature FOUND\0').veredicto, 'infectado');
    assert.equal(parseClamdResponse('INSTREAM size limit exceeded. ERROR\0').veredicto, 'no-disponible');
    assert.equal(parseClamdResponse('').veredicto, 'no-disponible');
  });

  test('sin CLAMAV_HOST no analiza, deja pasar y avisa en el log una sola vez', async () => {
    reiniciarAvisoSinAntivirus();
    const aviso = mock.method(console, 'warn', () => {});
    try {
      const primero = await scanBufferClamav(Buffer.from('x'));
      const segundo = await scanBufferClamav(Buffer.from('y'));
      assert.equal(primero.veredicto, 'sin-analizar');
      assert.equal(segundo.veredicto, 'sin-analizar');
      const avisos = aviso.mock.calls.filter((c) => String(c.arguments[0]).includes('CLAMAV_HOST'));
      assert.equal(avisos.length, 1);
    } finally {
      aviso.mock.restore();
    }
  });

  test('CLAMAV_REQUIRED=true sin CLAMAV_HOST es «no disponible», no «infectado»', async () => {
    process.env.CLAMAV_REQUIRED = 'true';
    assert.equal((await scanBufferClamav(Buffer.from('x'))).veredicto, 'no-disponible');
  });

  test('con clamd caído responde 503 «no disponible» y no dice que haya virus', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Un puerto que se acaba de liberar: nadie escucha en él.
    const libre = net.createServer();
    await new Promise<void>((r) => libre.listen(0, '127.0.0.1', r));
    const puerto = (libre.address() as AddressInfo).port;
    await new Promise((r) => libre.close(r));
    process.env.CLAMAV_HOST = '127.0.0.1';
    process.env.CLAMAV_PORT = String(puerto);

    const antes = await ficherosEnAlmacen();
    const res = await subir(pdfDe(2048), 'acta.pdf', 'application/pdf');
    assert.equal(res.status, 503);
    assert.equal(((await res.json()) as { error: string }).error, 'El análisis antivirus no está disponible, inténtalo más tarde.');
    assert.deepEqual(await ficherosEnAlmacen(), antes);
  });

  test('si clamd encuentra algo, se rechaza por el antivirus', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const clamd = await clamdFalso('stream: Eicar-Signature FOUND');
    try {
      process.env.CLAMAV_HOST = '127.0.0.1';
      process.env.CLAMAV_PORT = String(clamd.puerto);
      const antes = await ficherosEnAlmacen();
      const res = await subir(pdfDe(2048), 'virus.pdf', 'application/pdf');
      assert.equal(res.status, 400);
      assert.match(((await res.json()) as { error: string }).error, /rechazado por el análisis antivirus/);
      assert.deepEqual(await ficherosEnAlmacen(), antes);
    } finally {
      await clamd.cerrar();
    }
  });

  test('si clamd dice que está limpio, se acepta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const clamd = await clamdFalso('stream: OK');
    try {
      process.env.CLAMAV_HOST = '127.0.0.1';
      process.env.CLAMAV_PORT = String(clamd.puerto);
      const res = await subir(pdfDe(2048), 'limpio.pdf', 'application/pdf');
      assert.equal(res.status, 201);
    } finally {
      await clamd.cerrar();
    }
  });
});
