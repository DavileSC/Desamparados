// La migración `20261118200000_nombres_en_menu`: Desamparados (una base en
// marcha) recupera «Parroquia · Pasionistas»; una base nueva, no; y lo que ya
// se guardó desde el CMS no se pisa. Se ejecuta su propio SQL, no una copia.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import { SIN_DB } from './fixtures/sin-db.js';

const CLAVE = 'nombres_en_menu';
const SQL = readFileSync(new URL('../prisma/migrations/20261118200000_nombres_en_menu/migration.sql', import.meta.url), 'utf8');
let dbDisponible = false;
let filaAntes: { value: string; descripcion: string | null } | null = null;

const leer = async () => (await db.configuracion.findUnique({ where: { key: CLAVE } }))?.value ?? null;

before(async () => {
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (dbDisponible) filaAntes = await db.configuracion.findUnique({ where: { key: CLAVE }, select: { value: true, descripcion: true } });
});

after(async () => {
  if (dbDisponible) {
    if (filaAntes) await db.configuracion.upsert({ where: { key: CLAVE }, update: filaAntes, create: { key: CLAVE, ...filaAntes } });
    else await db.configuracion.deleteMany({ where: { key: CLAVE } });
  }
  await db.$disconnect();
});

test('en una base en marcha pone «Parroquia · Pasionistas», y no pisa lo guardado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  assert.ok(await db.contenidoPagina.count() > 0, 'la base de desarrollo debería tener páginas');
  await db.configuracion.deleteMany({ where: { key: CLAVE } });
  await db.$executeRawUnsafe(SQL);
  assert.deepEqual(JSON.parse((await leer())!), { '/parroquia': 'Parroquia · Pasionistas' });

  await db.configuracion.update({ where: { key: CLAVE }, data: { value: '{"/parroquia":"Otra"}' } });
  await db.$executeRawUnsafe(SQL);
  assert.equal(await leer(), '{"/parroquia":"Otra"}');
});

test('en una base nueva (sin páginas) no pone nada', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await db.configuracion.deleteMany({ where: { key: CLAVE } });
  // Una tabla temporal tapa la de verdad en su conexión: la migración ve
  // `ContenidoPagina` vacía sin borrar ninguna página. La transacción es solo
  // para tener las tres sentencias en la misma conexión del pool.
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('CREATE TEMPORARY TABLE `ContenidoPagina` (`id` INT)');
    try {
      await tx.$executeRawUnsafe(SQL);
    } finally {
      await tx.$executeRawUnsafe('DROP TEMPORARY TABLE `ContenidoPagina`');
    }
  });
  assert.equal(await leer(), null);
});
