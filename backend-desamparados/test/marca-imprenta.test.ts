// La marca en los PDF y en los correos (src/domain/marca.ts): qué escudo sale
// en cada sitio, la cabecera de los correos a hermanos y los colores de
// imprenta.
//
//  - Con la marca de partida (la de las pruebas: sin instalacion/marca/ ni
//    colores), el escudo neutro, sin cabecera en los correos y EXACTAMENTE los
//    colores que estaban escritos a mano: el cerrojo de que Desamparados, con
//    la marca a null, no cambia ni un tono.
//  - Con la marca de prueba completa (shared/__fixtures__/marca/completa) y
//    unos colores azules, en un proceso aparte (test/fixtures/marca-en-papel.ts):
//    cada sitio toma su fichero, el correo a un hermano lleva la cabecera, los
//    colores siguen a la marca y la papeleta y el Informe anual se generan.
//
// Las reglas de la marca (qué fichero vale, qué avisa) y de los colores están
// en marca.test.ts y colores-de-marca.test.ts. Sin base de datos.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, test } from 'node:test';
import { paletaDeImprenta } from '../../shared/colores-de-marca.mjs';
import { CARPETA_PARTIDA, resolverMarca } from '../../shared/marca.mjs';
import { FICHEROS_MARCA, IMAGENES_MARCA, IMPRENTA } from '../src/domain/marca.js';
import * as pdf from '../src/services/informes/pdf.js';
import { COLORES, conImagenesEnLinea, imagenesDe, maquetar } from '../src/services/correos/plantilla.js';

const BACKEND = fileURLToPath(new URL('..', import.meta.url));
const COMPLETA = fileURLToPath(new URL('../../shared/__fixtures__/marca/completa/', import.meta.url));
const EJEMPLO = fileURLToPath(new URL('../../shared/datos-entidad.ejemplo.json', import.meta.url));
const partida = (fichero: string) => join(CARPETA_PARTIDA, fichero);

const correo = (para: 'hermano' | 'interno') =>
  maquetar({ titulo: 'Prueba', antetitulo: 'Secretaría', resumen: 'Prueba', contenido: '<p>Hola.</p>', para });

describe('con la marca de partida', () => {
  test('el escudo neutro en todos los sitios: el destacado cae en el de su fondo', () => {
    assert.deepEqual(IMAGENES_MARCA, {
      escudoSobreClaro: partida('escudo-sobre-claro.png'),
      escudoDestacadoEnPapel: partida('escudo-sobre-claro.png'),
      escudoDestacadoEnNegro: partida('escudo-sobre-oscuro.png'),
      correoCabecera: null,
    });
    assert.equal(FICHEROS_MARCA.escudoSobreClaro.origen, 'partida');
  });

  test('cerrojo: los colores de los PDF y los correos son los de antes de la marca', () => {
    assert.deepEqual(
      [pdf.BURDEOS, pdf.BURDEOS_VIVO, pdf.ORO, pdf.ORO_CLARO, pdf.ORO_PALIDO, pdf.ORO_MEDIO, pdf.ORO_TEXTO],
      ['#5c1622', '#a3303f', '#b08d52', '#cdae72', '#ddd0b3', '#cbb48a', '#8a6a30'],
    );
    assert.equal(COLORES.burdeos, '#6e1a20');
    assert.deepEqual(IMPRENTA, paletaDeImprenta(null));
  });

  test('el correo a un hermano lleva el escudo y no la cabecera, que no tiene partida', () => {
    const html = correo('hermano');
    assert.match(html, /src="cid:escudo@marca"/);
    assert.doesNotMatch(html, /cabecera@marca/);
    assert.deepEqual(imagenesDe(html), [
      { filename: 'escudo.png', path: partida('escudo-sobre-claro.png'), cid: 'escudo@marca', contentType: 'image/png' },
    ]);
  });

  test('la vista previa lleva el escudo dentro, sin ningún cid suelto', () => {
    const html = conImagenesEnLinea(correo('hermano'));
    assert.doesNotMatch(html, /cid:/);
    const escudo = readFileSync(partida('escudo-sobre-claro.png')).toString('base64');
    assert.ok(html.includes(`data:image/png;base64,${escudo}`));
  });
});

describe('con una marca completa y otros colores', () => {
  const temporal = mkdtempSync(join(tmpdir(), 'marca-imprenta-'));
  after(() => rmSync(temporal, { recursive: true, force: true }));

  const AZUL = { colorPrincipal: '#1f4e79', colorAcento: '#4fa3e0' };
  const datos = JSON.parse(readFileSync(EJEMPLO, 'utf8'));
  datos.marca = { ...AZUL };
  const ficheroDatos = join(temporal, 'datos-entidad.json');
  writeFileSync(ficheroDatos, JSON.stringify(datos));

  const ejecucion = spawnSync(process.execPath, ['--import', 'tsx', 'test/fixtures/marca-en-papel.ts'], {
    cwd: BACKEND,
    env: { ...process.env, MARCA: 'shared/__fixtures__/marca/completa', DATOS_ENTIDAD: ficheroDatos },
    encoding: 'utf8',
    timeout: 120_000,
  });

  /** Lo que imprime el proceso: la última línea, un JSON. */
  const salida = () => {
    assert.equal(ejecucion.status, 0, ejecucion.stderr);
    return JSON.parse(ejecucion.stdout.trim().split('\n').at(-1)!);
  };
  const deLaMarca = (fichero: string) => join(COMPLETA, fichero);

  test('cada sitio toma el fichero de la instalación', () => {
    assert.deepEqual(salida().imagenes, {
      escudoSobreClaro: deLaMarca('escudo-sobre-claro.png'),
      escudoDestacadoEnPapel: deLaMarca('escudo-destacado.png'),
      escudoDestacadoEnNegro: deLaMarca('escudo-destacado.png'),
      correoCabecera: deLaMarca('correo-cabecera.jpg'),
    });
  });

  test('los colores de los PDF y los correos siguen a la marca', () => {
    const { imprenta, pdf: enPdf, correoBurdeos } = salida();
    const esperada = paletaDeImprenta(AZUL);
    assert.deepEqual(imprenta, { ...esperada });
    assert.deepEqual(enPdf, {
      BURDEOS: esperada.burdeos, BURDEOS_VIVO: esperada.burdeosVivo, ORO: esperada.oro, ORO_CLARO: esperada.oroClaro,
      ORO_PALIDO: esperada.oroPalido, ORO_MEDIO: esperada.oroMedio, ORO_TEXTO: esperada.oroTexto,
    });
    assert.equal(correoBurdeos, esperada.acentoCorreo);
    assert.notEqual(correoBurdeos, '#6e1a20');
  });

  test('el correo a un hermano lleva la cabecera; el interno, solo el escudo', () => {
    const { correo: c } = salida();
    assert.match(c.hermano.html, /src="cid:cabecera@marca"/);
    assert.deepEqual(c.hermano.adjuntos, [
      { filename: 'escudo.png', cid: 'escudo@marca', contentType: 'image/png', path: deLaMarca('escudo-sobre-claro.png') },
      { filename: 'cabecera.jpg', cid: 'cabecera@marca', contentType: 'image/jpeg', path: deLaMarca('correo-cabecera.jpg') },
    ]);
    assert.deepEqual(c.interno.adjuntos.map((a: { cid: string }) => a.cid), ['escudo@marca']);
  });

  test('la papeleta y el Informe anual salen, con el escudo de la marca y ninguno de partida', () => {
    const { papeleta, informe } = salida();
    const { ficheros } = resolverMarca({ carpeta: COMPLETA });
    const medidas = (f: { ancho: number; alto: number }) => `${f.ancho}x${f.alto}`;
    const dePartida = resolverMarca({ carpeta: null }).ficheros;
    for (const generado of [papeleta, informe]) {
      assert.equal(generado.cabecera, '%PDF-');
      assert.ok(generado.imagenes.length > 0);
      assert.ok(!generado.imagenes.includes(medidas(dePartida.escudoSobreClaro)), generado.imagenes.join(' '));
      assert.ok(!generado.imagenes.includes(medidas(dePartida.escudoSobreOscuro)), generado.imagenes.join(' '));
    }
    assert.ok(papeleta.imagenes.includes(medidas(ficheros.escudoDestacado!)));
  });
});
