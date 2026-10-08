// test/una-vez-db.test.ts
//
// `unaVez` (services/procesion/una-vez.ts): lo que la mesa manda dos veces
// porque la WiFi se cortó se hace una sola. Lo usan el cobro de la mesa y los
// donativos; aquí se prueba la pieza sola, contra MariaDB.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import db from '../src/config/db.js';
import { olvidarOperacionesViejas, unaVez } from '../src/services/procesion/una-vez.js';
import { HttpError } from '../src/utils/error.handle.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
const prefijo = `prueba-una-vez-${randomBytes(4).toString('hex')}`;
const clave = (n: string) => `${prefijo}-${n}`;

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  if (dbDisponible) await db.operacionMesa.deleteMany({ where: { clave: { startsWith: prefijo } } });
  await db.$disconnect();
});

test('con la misma clave, la segunda vez no se hace: devuelve lo de la primera', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  let veces = 0;
  const cobrar = async () => ({ cobro: ++veces });
  const primera = await unaVez(clave('a'), 'cobro', cobrar);
  const segunda = await unaVez(clave('a'), 'cobro', cobrar);
  assert.deepEqual(primera, { resultado: { cobro: 1 }, repetida: false });
  assert.deepEqual(segunda, { resultado: { cobro: 1 }, repetida: true });
  assert.equal(veces, 1);
});

test('dos a la vez con la misma clave: se hace una', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  let veces = 0;
  const cobrar = async () => {
    veces++;
    await new Promise((r) => setTimeout(r, 50));
    return { ok: true };
  };
  const [a, b] = await Promise.all([unaVez(clave('b'), 'cobro', cobrar), unaVez(clave('b'), 'cobro', cobrar)]);
  assert.deepEqual([a.repetida, b.repetida].sort(), [false, true]);
  assert.deepEqual(a.resultado, b.resultado);
  // La transacción que pierde puede haber empezado la operación, pero no
  // queda: lo que cuenta es que se guardó una sola clave con un resultado.
  assert.equal(await db.operacionMesa.count({ where: { clave: clave('b') } }), 1);
  assert.ok(veces >= 1);
});

test('la misma clave para otra operación es un 409', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await unaVez(clave('c'), 'cobro', async () => 1);
  await assert.rejects(unaVez(clave('c'), 'donativo', async () => 2), (e: unknown) => e instanceof HttpError && e.status === 409);
});

test('si la operación falla, la clave no queda y el reintento sí se hace', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await assert.rejects(unaVez(clave('d'), 'cobro', async () => { throw new HttpError('sin cambio', 400); }));
  assert.equal(await db.operacionMesa.count({ where: { clave: clave('d') } }), 0, 'o quedan las dos o ninguna');
  assert.deepEqual(await unaVez(clave('d'), 'cobro', async () => 'hecho'), { resultado: 'hecho', repetida: false });
});

test('sin clave se hace siempre, y las claves viejas se olvidan', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  let veces = 0;
  await unaVez(undefined, 'cobro', async () => ++veces);
  await unaVez(undefined, 'cobro', async () => ++veces);
  assert.equal(veces, 2);

  // Una de hace 31 días y otra de hoy. Con la fecha de hoy: solo se lleva lo
  // que tiene más de 30 días, que en la base de desarrollo también sobra.
  const haceUnMes = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  await db.operacionMesa.create({ data: { clave: clave('vieja'), tipo: 'cobro', createdAt: haceUnMes } });
  await unaVez(clave('e'), 'cobro', async () => 1);
  assert.ok((await olvidarOperacionesViejas()) >= 1);
  assert.equal(await db.operacionMesa.count({ where: { clave: clave('vieja') } }), 0);
  assert.equal(await db.operacionMesa.count({ where: { clave: clave('e') } }), 1, 'la reciente se guarda');
});
