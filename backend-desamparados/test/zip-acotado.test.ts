// test/zip-acotado.test.ts
//
// El Excel del censo se abre con ExcelJS, que lo descomprime entero en
// memoria. Un .xlsx de pocos KB puede esconder gigas de ceros (una «bomba
// zip») y tumbar el proceso. `revisarZip` mide lo descomprimido sin pasar del
// tope y sin fiarse de los tamaños que declara el fichero.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import ExcelJS from 'exceljs';
import { revisarZip } from '../src/utils/zip-acotado.js';
import { CensoHojaService } from '../src/services/censo-hoja.service.js';
import { HttpError } from '../src/utils/error.handle.js';

const MB = 1024 * 1024;

/** Un zip mínimo con deflate. `mentir` pone en el directorio un tamaño descomprimido falso. */
function zip(entradas: { nombre: string; datos: Buffer }[], mentir?: number): Buffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;
  for (const { nombre, datos } of entradas) {
    const nombreB = Buffer.from(nombre);
    const comprimido = deflateRawSync(datos);
    const tamano = mentir ?? datos.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comprimido.length, 18); local.writeUInt32LE(tamano, 22); local.writeUInt16LE(nombreB.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(comprimido.length, 20); central.writeUInt32LE(tamano, 24); central.writeUInt16LE(nombreB.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    locales.push(local, nombreB, comprimido);
    centrales.push(central, nombreB);
    desplazamiento += 30 + nombreB.length + comprimido.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(entradas.length, 8); fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(directorio.length, 12); fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, directorio, fin]);
}

describe('revisarZip', () => {
  test('un Excel de verdad pasa', async () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet('Censo').addRows([['Nombre', 'DNI'], ['Ana', '12345678Z']]);
    const xlsx = Buffer.from(await libro.xlsx.writeBuffer());
    assert.equal(revisarZip(xlsx, 50 * MB), 'ok');
  });

  test('pasarse del tope, declarado o escondido, es «grande»', () => {
    const ceros = Buffer.alloc(3 * MB);
    assert.equal(revisarZip(zip([{ nombre: 'a.xml', datos: ceros }]), 2 * MB), 'grande');
    // Dice que ocupa 10 bytes y descomprime 3 MB: se mide lo de verdad.
    assert.equal(revisarZip(zip([{ nombre: 'a.xml', datos: ceros }], 10), 2 * MB), 'grande');
    // Repartido entre varias entradas también suma.
    const trozo = Buffer.alloc(800 * 1024);
    assert.equal(revisarZip(zip([1, 2, 3].map((n) => ({ nombre: `${n}.xml`, datos: trozo }))), 2 * MB), 'grande');
    assert.equal(revisarZip(zip([{ nombre: 'a.xml', datos: trozo }]), 2 * MB), 'ok');
  });

  test('lo que no es un zip es «roto»', () => {
    assert.equal(revisarZip(Buffer.from('PK esto no es un zip'), MB), 'roto');
    const cortado = zip([{ nombre: 'a.xml', datos: Buffer.from('hola') }]);
    cortado.writeUInt32LE(0xdeadbeef, cortado.length - 6);
    assert.equal(revisarZip(cortado, MB), 'roto');
  });

  test('el censo rechaza la bomba antes de abrirla', async () => {
    const bomba = zip([{ nombre: 'xl/worksheets/sheet1.xml', datos: Buffer.alloc(60 * MB) }], 100);
    await assert.rejects(CensoHojaService.previa(bomba), (e: unknown) => e instanceof HttpError && e.status === 413);
  });
});
