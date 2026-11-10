// test/tinta-de-portada.test.ts
//
// La letra de la cubierta «Foto callada» según la foto: cada zona elige letra
// clara u oscura y el velo justo para leerse (domain/tinta-de-portada.ts), y
// el servicio la guarda al subir la portada y la rellena en las antiguas.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import db from '../src/config/db.js';
import { ALTO_MUESTRA, ANCHO_MUESTRA, VELO_MAXIMO, tintaDePortada, tintaDeZona } from '../src/domain/tinta-de-portada.js';
import { leerTintaDePortada } from '../src/utils/leer-tinta-de-portada.js';
import { publicStorageDir } from '../src/middleware/upload.middleware.js';
import { PublicacionService } from '../src/services/publicacion.service.js';
import { SIN_DB } from './fixtures/sin-db.js';

const zonaDe = (gris: number, n = 100) => Array.from({ length: n }, () => [gris, gris, gris]);

/** Una muestra con un gris arriba y otro abajo. */
function muestra(arriba: number, abajo: number) {
  const crudo = new Uint8Array(ANCHO_MUESTRA * ALTO_MUESTRA * 3);
  for (let y = 0; y < ALTO_MUESTRA; y++) {
    crudo.fill(y < ALTO_MUESTRA / 2 ? arriba : abajo, y * ANCHO_MUESTRA * 3, (y + 1) * ANCHO_MUESTRA * 3);
  }
  return crudo;
}

describe('la tinta de una zona', () => {
  test('sobre negro, letra clara y sin velo; sobre blanco, oscura y sin velo', () => {
    assert.deepEqual(tintaDeZona(zonaDe(0)), { letra: 'clara', velo: 0 });
    assert.deepEqual(tintaDeZona(zonaDe(255)), { letra: 'oscura', velo: 0 });
  });

  test('sobre un gris medio hace falta velo, y nunca pasa del máximo', () => {
    const { velo } = tintaDeZona(zonaDe(128));
    assert.ok(velo > 0 && velo <= VELO_MAXIMO, `velo ${velo}`);
  });

  test('un brillo suelto (menos del 10 %) no oscurece la zona entera', () => {
    // Se rompe si se mide con el píxel peor y no con la mayoría: una vela en
    // una foto de noche taparía la tapa con un velo.
    const noche = [...zonaDe(0, 95), ...zonaDe(255, 5)];
    assert.deepEqual(tintaDeZona(noche), { letra: 'clara', velo: 0 });
  });

  test('arriba y abajo se miden por separado', () => {
    // Cielo arriba y gente abajo: oscura arriba, clara abajo.
    const tinta = tintaDePortada(muestra(250, 10));
    assert.equal(tinta.arriba.letra, 'oscura');
    assert.equal(tinta.abajo.letra, 'clara');
  });
});

describe('la tinta de la portada subida', () => {
  const nombre = `${randomBytes(16).toString('hex')}.webp`;
  const ruta = `/storage/public/${nombre}`;
  const ids: number[] = [];
  let dbDisponible = false;

  before(async () => {
    // Blanca arriba y negra abajo, en la proporción de la tapa.
    const mitad = (color: string) => sharp({ create: { width: 300, height: 200, channels: 3, background: color } }).png().toBuffer();
    await sharp({ create: { width: 300, height: 400, channels: 3, background: '#000' } })
      .composite([{ input: await mitad('#fff'), top: 0, left: 0 }])
      .webp()
      .toFile(path.join(publicStorageDir, nombre));
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
  });

  after(async () => {
    try {
      if (dbDisponible) await db.publicacion.deleteMany({ where: { id: { in: ids } } });
      await fs.rm(path.join(publicStorageDir, nombre), { force: true });
    } finally {
      // Sin cerrar la base, el proceso de la prueba no termina nunca.
      await db.$disconnect();
    }
  });

  test('lee la foto y saca letra oscura arriba y clara abajo', async () => {
    assert.deepEqual(await leerTintaDePortada(ruta), {
      arriba: { letra: 'oscura', velo: 0 },
      abajo: { letra: 'clara', velo: 0 },
    });
  });

  test('sin foto, ajena o que no existe: null, y la web pone la letra de siempre', async () => {
    assert.equal(await leerTintaDePortada(null), null);
    assert.equal(await leerTintaDePortada('/images/portada.webp'), null);
    assert.equal(await leerTintaDePortada('/storage/public/../../.env'), null);
    assert.equal(await leerTintaDePortada(`/storage/public/${'0'.repeat(32)}.webp`), null);
  });

  test('la portada rellena la tinta de las subidas antes y la guarda', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Fecha lejana: así es de las que salen en la portada.
    const antigua = await db.publicacion.create({
      data: { titulo: 'Tinta antigua', archivoUrl: '/storage/public/documentos/pendiente.pdf', categoria: 'boletin', imagenUrl: ruta, fecha: new Date('2199-01-01') },
    });
    ids.push(antigua.id);
    assert.equal(antigua.tintaPortada, null);

    const servida = (await PublicacionService.deLaPortada()).find((p) => p.id === antigua.id);
    assert.equal((servida?.tintaPortada as { abajo: { letra: string } } | undefined)?.abajo.letra, 'clara');
    const guardada = await db.publicacion.findUniqueOrThrow({ where: { id: antigua.id } });
    assert.deepEqual(guardada.tintaPortada, servida?.tintaPortada);
  });

  // Va después de la de la portada: al quitarle la foto, la limpieza de
  // huérfanas la borraría si la antigua no la siguiera usando.
  test('se guarda al crear, cambia con la portada y se quita sin ella', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const creada = await PublicacionService.crear({
      titulo: 'Tinta de prueba', archivoUrl: '/storage/public/documentos/pendiente.pdf', categoria: 'boletin', imagenUrl: ruta, visible: false,
    });
    ids.push(creada.id);
    assert.equal((creada.tintaPortada as { arriba: { letra: string } }).arriba.letra, 'oscura');

    // Otro dato de la ficha: la tinta no se recalcula ni se pierde.
    const retitulada = await PublicacionService.actualizar(creada.id, { titulo: 'Tinta de prueba 2', imagenUrl: ruta });
    assert.deepEqual(retitulada.tintaPortada, creada.tintaPortada);

    const sinFoto = await PublicacionService.actualizar(creada.id, { imagenUrl: '' });
    assert.equal(sinFoto.tintaPortada, null);
  });
});
