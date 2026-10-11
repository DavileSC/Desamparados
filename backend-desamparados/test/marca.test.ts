// La marca de cada instalación (shared/marca.mjs): qué fichero se usa para cada
// imagen, de la instalación o de la partida, y qué impide arrancar. Además,
// que PDFKit lee un PNG entrelazado: por eso el validador no lo rechaza.
// Sin base de datos.
//
// Fixtures (shared/__fixtures__/marca/, rehechos con su generar.mjs):
//   completa/  los nueve ficheros, válidos y sin avisos; el escudo destacado, entrelazado.
//   sueltos/   casos sueltos: rgb-entrelazado.png, paleta-con-trns.png, opaco.png,
//              progresivo.jpg, jpeg-con-extension.png, escudo.webp, texto.png,
//              cortado.png y cortado.jpg.
// Los casos de error se montan copiando sueltos/ con el nombre de la marca en
// una carpeta temporal.

import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { after, test } from 'node:test';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import {
  CARPETA_PARTIDA, CATALOGO_MARCA, PESO_MAXIMO, leerCabeceraImagen, resolverMarca, rutaDeMarca,
} from '../../shared/marca.mjs';

const FIXTURES = fileURLToPath(new URL('../../shared/__fixtures__/marca/', import.meta.url));
const COMPLETA = join(FIXTURES, 'completa');
const suelto = (nombre: string) => join(FIXTURES, 'sueltos', nombre);
const cabecera = (ruta: string) => leerCabeceraImagen(readFileSync(ruta));

const temporales: string[] = [];
after(() => { for (const d of temporales) rmSync(d, { recursive: true, force: true }); });

/** Una carpeta de marca nueva con `ficheros` = { nombre en la marca: fichero de origen o contenido }. */
function carpetaCon(ficheros: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'marca-'));
  temporales.push(dir);
  for (const [nombre, origen] of Object.entries(ficheros)) {
    if (Buffer.isBuffer(origen)) writeFileSync(join(dir, nombre), origen);
    else copyFileSync(origen, join(dir, nombre));
  }
  return dir;
}

test('lee formato, medidas, transparencia y entrelazado de PNG y JPEG', () => {
  assert.deepEqual(cabecera(suelto('opaco.png')), { formato: 'png', ancho: 40, alto: 48, transparencia: false, entrelazado: false });
  assert.deepEqual(cabecera(suelto('paleta-con-trns.png')), { formato: 'png', ancho: 40, alto: 48, transparencia: true, entrelazado: false });
  assert.deepEqual(cabecera(suelto('rgb-entrelazado.png')), { formato: 'png', ancho: 8, alto: 6, transparencia: false, entrelazado: true });
  assert.deepEqual(cabecera(join(COMPLETA, 'escudo-destacado.png')), { formato: 'png', ancho: 200, alto: 240, transparencia: true, entrelazado: true });
  assert.deepEqual(cabecera(suelto('progresivo.jpg')), { formato: 'jpeg', ancho: 64, alto: 32, transparencia: false, entrelazado: true });
  assert.deepEqual(cabecera(suelto('jpeg-con-extension.png')), { formato: 'jpeg', ancho: 64, alto: 32, transparencia: false, entrelazado: false });
  assert.deepEqual(cabecera(join(COMPLETA, 'compartir.jpg')), { formato: 'jpeg', ancho: 1200, alto: 630, transparencia: false, entrelazado: false });
});

test('lo que no es PNG ni JPEG da null; lo cortado lanza', () => {
  assert.equal(cabecera(suelto('texto.png')), null);
  assert.equal(cabecera(suelto('escudo.webp')), null);
  assert.equal(leerCabeceraImagen(Buffer.alloc(0)), null);
  assert.throws(() => cabecera(suelto('cortado.png')), /PNG cortado/);
  assert.throws(() => cabecera(suelto('cortado.jpg')), /JPEG cortado/);
  // Un byte cambiado en medio: la cabecera sigue bien, el CRC no.
  const tocado = Buffer.from(readFileSync(suelto('opaco.png')));
  tocado[40] ^= 0xff;
  assert.throws(() => leerCabeceraImagen(tocado), /PNG roto/);
});

test('PDFKit lee un PNG entrelazado, y bien: por eso el validador lo admite', async () => {
  const pdf = async (ruta: string) => {
    const doc = new PDFDocument({ compress: false });
    const trozos: Buffer[] = [];
    doc.on('data', (t: Buffer) => trozos.push(t));
    const fin = new Promise<void>((ok, mal) => { doc.on('end', ok); doc.on('error', mal); });
    doc.image(ruta, 10, 10, { width: 80 });
    doc.end();
    await fin;
    return Buffer.concat(trozos);
  };
  // Con alfa (el escudo destacado): PDFKit separa el canal y no lanza.
  assert.ok((await pdf(join(COMPLETA, 'escudo-destacado.png'))).length > 0);
  // Sin alfa: PDFKit tiene que desentrelazarlo él. Los píxeles del PDF
  // (el flujo de la imagen, ya sin compresión) son los del PNG.
  const salida = (await pdf(suelto('rgb-entrelazado.png'))).toString('latin1');
  const objeto = salida.indexOf('/Subtype /Image');
  assert.ok(objeto > -1, 'el PDF no lleva la imagen');
  const desde = salida.indexOf('stream\n', objeto) + 'stream\n'.length;
  const hasta = salida.indexOf('\nendstream', desde);
  const pixeles = inflateSync(Buffer.from(salida.slice(desde, hasta), 'latin1'));
  const esperados = await sharp(suelto('rgb-entrelazado.png')).raw().toBuffer();
  assert.deepEqual(pixeles, esperados);
});

test('en las pruebas no hay carpeta de instalación: solo la marca de partida', () => {
  assert.equal(rutaDeMarca(), null);
  assert.equal(rutaDeMarca({}), join(fileURLToPath(new URL('../../', import.meta.url)), 'instalacion', 'marca'));
  assert.equal(rutaDeMarca({ MARCA: 'shared/__fixtures__/marca/completa' }), COMPLETA);
  assert.throws(() => rutaDeMarca({ MARCA: 'shared/no-existe' }), /MARCA apunta a .*no existe/);
});

test('en las pruebas no cuenta la MARCA del entorno (la del .env); solo MARCA_DE_PRUEBA', () => {
  // dotenv vuelca el .env del backend en process.env: si define MARCA, las
  // pruebas no deben ver las imágenes de esta máquina.
  const enPruebas = { NODE_TEST_CONTEXT: 'child-v8' };
  assert.equal(rutaDeMarca({ ...enPruebas, MARCA: 'shared/__fixtures__/marca/completa' }), null);
  assert.equal(rutaDeMarca({ VITEST: 'true', MARCA: 'shared/__fixtures__/marca/completa' }), null);
  assert.equal(rutaDeMarca({ ...enPruebas, MARCA_DE_PRUEBA: 'shared/__fixtures__/marca/completa' }), COMPLETA);
  assert.throws(() => rutaDeMarca({ ...enPruebas, MARCA_DE_PRUEBA: 'shared/no-existe' }), /MARCA_DE_PRUEBA apunta a .*no existe/);
  // Fuera de las pruebas, MARCA_DE_PRUEBA no pinta nada.
  assert.equal(rutaDeMarca({ MARCA_DE_PRUEBA: 'shared/__fixtures__/marca/completa' }), join(fileURLToPath(new URL('../../', import.meta.url)), 'instalacion', 'marca'));
});

test('un JPEG con datos tras el fin (foto en movimiento, restos de un editor) sirve, con aviso', () => {
  const foto = readFileSync(join(COMPLETA, 'correo-cabecera.jpg'));
  // Lo que añade una foto en movimiento de Android: un vídeo MP4 tras el EOI,
  // con un FFD9 suelto dentro para que no baste con mirar el final.
  const video = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(3000, 7), Buffer.from([0xff, 0xd9, 1, 2])]);
  const conVideo = Buffer.concat([foto, video]);
  assert.deepEqual(
    { ...leerCabeceraImagen(conVideo), datosTrasElFin: undefined },
    { ...leerCabeceraImagen(foto), datosTrasElFin: undefined },
  );
  const { errores, avisos, ficheros } = resolverMarca({ carpeta: carpetaCon({ 'correo-cabecera.jpg': conVideo }) });
  assert.deepEqual(errores, []);
  assert.equal(ficheros.correoCabecera?.origen, 'instalacion');
  assert.ok(avisos.some((a) => a.startsWith('correo-cabecera.jpg:') && a.includes('tras el final de la imagen')), avisos.join('\n'));
  // Sin el EOI en ninguna parte sigue siendo un JPEG cortado.
  assert.throws(() => cabecera(suelto('cortado.jpg')), /JPEG cortado/);
});

test('un JPEG con el segmento de medidas (SOF) demasiado corto da un error claro', () => {
  const corto = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x04, 0x08, 0x00]);
  assert.throws(() => leerCabeceraImagen(corto), /JPEG roto: el segmento de medidas \(SOF\) es demasiado corto/);
});

test('un nombre de la marca con mayúsculas en la extensión: se pide renombrarlo', () => {
  const { avisos, ficheros } = resolverMarca({
    carpeta: carpetaCon({ 'escudo-sobre-oscuro.PNG': join(COMPLETA, 'escudo-sobre-oscuro.png') }),
  });
  const aviso = avisos.find((a) => a.startsWith('escudo-sobre-oscuro.PNG:')) ?? '';
  assert.match(aviso, /renómbralo a escudo-sobre-oscuro\.png/);
  assert.doesNotMatch(aviso, /Tiene que ser PNG|convertido/);
  // No se usa: en el servidor (Linux) ese nombre no es el que se lee.
  assert.equal(ficheros.escudoSobreOscuro.origen, 'partida');
});

test('la marca de partida: sin avisos, PNG sin entrelazar y nulas las que no tiene', () => {
  const { ficheros, errores, avisos } = resolverMarca({ carpeta: null });
  assert.deepEqual(errores, []);
  assert.deepEqual(avisos, []);
  for (const entrada of CATALOGO_MARCA) {
    const f = ficheros[entrada.clave];
    if (!entrada.partida) { assert.equal(f, null, entrada.clave); continue; }
    assert.ok(f, entrada.clave);
    assert.equal(f.origen, 'partida');
    assert.equal(f.ruta, join(CARPETA_PARTIDA, entrada.fichero));
    assert.match(f.version, /^[0-9a-f]{8}$/);
    const c = cabecera(f.ruta);
    assert.equal(c?.entrelazado, false, entrada.fichero);
    if (entrada.exacto) assert.deepEqual([c?.ancho, c?.alto], entrada.exacto, entrada.fichero);
  }
  assert.equal(cabecera(ficheros.escudoSobreOscuro.ruta)?.transparencia, true);
  assert.equal(cabecera(ficheros.appleTouchIcon.ruta)?.transparencia, false);
});

test('una instalación completa: todo de la instalación, sin errores ni avisos', () => {
  const { ficheros, errores, avisos } = resolverMarca({ carpeta: COMPLETA });
  assert.deepEqual(errores, []);
  assert.deepEqual(avisos, []);
  for (const entrada of CATALOGO_MARCA) {
    assert.equal(ficheros[entrada.clave]?.origen, 'instalacion', entrada.clave);
    assert.equal(ficheros[entrada.clave]?.fichero, entrada.fichero);
  }
  assert.equal(ficheros.compartir?.tipo, 'image/jpeg');
  assert.equal(ficheros.escudoSobreOscuro.tipo, 'image/png');
  assert.equal(ficheros.icono512.ancho, 512);
});

test('sin la carpeta, un solo aviso; con la carpeta vacía, un aviso por fichero', () => {
  const sinCarpeta = resolverMarca({ carpeta: join(tmpdir(), 'marca-que-no-existe-' + Date.now()) });
  assert.deepEqual(sinCarpeta.errores, []);
  assert.equal(sinCarpeta.avisos.length, 1);
  assert.match(sinCarpeta.avisos[0], /se usa la marca de partida/);
  assert.equal(sinCarpeta.ficheros.escudoSobreOscuro.origen, 'partida');

  const vacia = resolverMarca({ carpeta: carpetaCon({}) });
  assert.deepEqual(vacia.errores, []);
  assert.equal(vacia.avisos.length, CATALOGO_MARCA.length);
  assert.ok(vacia.avisos.some((a) => a.startsWith('Falta escudo-sobre-oscuro.png') && a.includes('marca de partida')));
  assert.ok(vacia.avisos.some((a) => a.startsWith('Falta correo-cabecera.jpg') && a.includes('sin imagen')));
  assert.equal(vacia.ficheros.correoCabecera, null);
});

test('mezcla: lo que está es de la instalación y lo que falta, de la partida', () => {
  const { ficheros, errores } = resolverMarca({ carpeta: carpetaCon({ 'escudo-sobre-oscuro.png': join(COMPLETA, 'escudo-sobre-oscuro.png') }) });
  assert.deepEqual(errores, []);
  assert.equal(ficheros.escudoSobreOscuro.origen, 'instalacion');
  assert.equal(ficheros.escudoSobreClaro.origen, 'partida');
  assert.equal(ficheros.escudoDestacado, null);
});

test('lo que no sirve impide arrancar, y dice por qué', () => {
  const grande = Buffer.concat([readFileSync(join(COMPLETA, 'compartir.jpg')), Buffer.alloc(PESO_MAXIMO)]);
  const { errores, ficheros } = resolverMarca({
    carpeta: carpetaCon({
      'escudo-sobre-oscuro.png': suelto('texto.png'),
      'escudo-sobre-claro.png': suelto('jpeg-con-extension.png'),
      'escudo-destacado.png': suelto('cortado.png'),
      'favicon-32.png': suelto('opaco.png'),
      'correo-cabecera.jpg': suelto('opaco.png'),
      'compartir.jpg': grande,
    }),
  });
  const de = (fichero: string) => errores.find((e) => e.startsWith(`${fichero}:`)) ?? '';
  assert.equal(errores.length, 6, errores.join('\n'));
  assert.match(de('escudo-sobre-oscuro.png'), /no es una imagen PNG, es un fichero de texto/);
  assert.match(de('escudo-sobre-claro.png'), /es un JPEG con extensión de PNG/);
  assert.match(de('escudo-destacado.png'), /PNG cortado/);
  assert.match(de('favicon-32.png'), /mide 40×48 y tiene que medir 32×32/);
  assert.match(de('correo-cabecera.jpg'), /es un PNG con extensión de JPEG/);
  assert.match(de('compartir.jpg'), /máximo es 2 MB/);
  // Aun así, quien llame tiene con qué pintar mientras lo cuenta.
  assert.equal(ficheros.escudoSobreOscuro.origen, 'partida');
});

test('avisa sin impedir arrancar: medidas, transparencia y nombres que no son de la marca', () => {
  const dir = carpetaCon({
    'escudo-sobre-oscuro.png': suelto('opaco.png'),
    'apple-touch-icon.png': Buffer.alloc(0),
    'escudo-sobre-oscuro.webp': suelto('escudo.webp'),
    'escudo-sobre-oscro.png': suelto('opaco.png'),
    'notas.txt': Buffer.from('hola'),
    '.DS_Store': Buffer.from('x'),
  });
  // apple-touch-icon con transparencia: el escudo de partida, que la tiene.
  copyFileSync(join(CARPETA_PARTIDA, 'escudo-sobre-oscuro.png'), join(dir, 'apple-touch-icon.png'));
  mkdirSync(join(dir, 'originales'));
  writeFileSync(join(dir, 'originales', 'escudo-original.png'), 'no se lee');
  const { errores, avisos } = resolverMarca({ carpeta: dir });
  // El de partida mide 197×240 y no 180×180: eso sí es error.
  assert.deepEqual(errores.map((e) => e.split(':')[0]), ['apple-touch-icon.png']);
  const de = (inicio: string) => avisos.filter((a) => a.startsWith(inicio));
  assert.equal(de('escudo-sobre-oscuro.png:').length, 2, avisos.join('\n'));
  assert.ok(de('escudo-sobre-oscuro.png:').some((a) => a.includes('borroso')));
  assert.ok(de('escudo-sobre-oscuro.png:').some((a) => a.includes('no tiene transparencia')));
  assert.match(de('escudo-sobre-oscuro.webp:')[0] ?? '', /no es de la marca; ¿escudo-sobre-oscuro\.png\? Tiene que ser PNG/);
  assert.match(de('escudo-sobre-oscro.png:')[0] ?? '', /¿escudo-sobre-oscuro\.png\?/);
  assert.match(de('notas.txt:')[0] ?? '', /no es de la marca y se ignora/);
  assert.equal(avisos.filter((a) => a.includes('DS_Store') || a.includes('originales')).length, 0);
});

test('apple-touch-icon con transparencia avisa', async () => {
  const transparente = await sharp({ create: { width: 180, height: 180, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const { errores, avisos } = resolverMarca({ carpeta: carpetaCon({ 'apple-touch-icon.png': transparente }) });
  assert.deepEqual(errores, []);
  assert.ok(avisos.some((a) => a.startsWith('apple-touch-icon.png:') && a.includes('iOS')), avisos.join('\n'));
});
