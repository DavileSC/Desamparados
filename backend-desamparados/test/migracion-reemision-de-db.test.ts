// El relleno de la migración `20261119200000_reemision_de` sobre filas: cada
// devuelto se enlaza con la primera reemisión posterior de su clave, la
// papeleta de otra salida no cuenta y una cadena de dos queda enlazada paso a
// paso. Se ejecuta su propio UPDATE, no una copia, contra tablas temporales
// que tapan `Recibo` y `Solicitud` en su conexión: ni se toca ni estorba lo
// que hay en la base (el relleno recorre la tabla entera).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import { SIN_DB } from './fixtures/sin-db.js';

const SQL = readFileSync(new URL('../prisma/migrations/20261119200000_reemision_de/migration.sql', import.meta.url), 'utf8');
// Solo el relleno: lo de antes (columna, índice y clave ajena) ya está en la base.
const RELLENO = SQL.slice(SQL.indexOf('UPDATE `Recibo`')).trim().replace(/;$/, '');
let dbDisponible = false;

before(async () => {
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await db.$disconnect();
});

interface Fila { id: number; hermanoId: number; year: number; tipo: string; concepto: string; estado: string; salidaId?: number }

/** Ejecuta el relleno sobre `filas` y devuelve, de cada recibo, de cuál es reemisión. */
async function rellenar(filas: Fila[]): Promise<Map<number, number | null>> {
  // La transacción es solo para que todo vaya por la misma conexión del pool:
  // las tablas temporales solo existen en la suya.
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE TEMPORARY TABLE \`Recibo\` (
      id INT PRIMARY KEY, hermanoId INT NOT NULL, year INT NOT NULL, tipo VARCHAR(40) NOT NULL,
      concepto VARCHAR(255) NOT NULL, estado VARCHAR(20) NOT NULL, reemisionDeId INT NULL
    ) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci`);
    await tx.$executeRawUnsafe('CREATE TEMPORARY TABLE `Solicitud` (id INT AUTO_INCREMENT PRIMARY KEY, reciboId INT NULL, salidaId INT NOT NULL)');
    try {
      for (const f of filas) {
        await tx.$executeRaw`INSERT INTO Recibo (id, hermanoId, year, tipo, concepto, estado) VALUES (${f.id}, ${f.hermanoId}, ${f.year}, ${f.tipo}, ${f.concepto}, ${f.estado})`;
        if (f.salidaId !== undefined) await tx.$executeRaw`INSERT INTO Solicitud (reciboId, salidaId) VALUES (${f.id}, ${f.salidaId})`;
      }
      await tx.$executeRawUnsafe(RELLENO);
      const enlaces = await tx.$queryRawUnsafe<{ id: number; reemisionDeId: number | null }[]>('SELECT id, reemisionDeId FROM Recibo ORDER BY id');
      return new Map(enlaces.map((r) => [Number(r.id), r.reemisionDeId === null ? null : Number(r.reemisionDeId)]));
    } finally {
      await tx.$executeRawUnsafe('DROP TEMPORARY TABLE `Solicitud`');
      await tx.$executeRawUnsafe('DROP TEMPORARY TABLE `Recibo`');
    }
  });
}

const cuota = (id: number, concepto: string, estado: string, hermanoId = 1): Fila => ({ id, hermanoId, year: 2026, tipo: 'CUOTA_HERMANO', concepto, estado });

test('el relleno sabe dónde empieza el UPDATE de la migración', () => {
  assert.match(RELLENO, /^UPDATE `Recibo` AS r\b/);
  assert.match(RELLENO, /SET r\.reemisionDeId = x\.devueltoId$/);
});

test('un devuelto se enlaza con su «(reemisión)» posterior, y no con un recibo cualquiera de su clave', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const enlaces = await rellenar([
    cuota(10, 'Cuota anual 2026', 'DEVUELTO'),
    cuota(11, 'Cuota anual 2026 (reemisión)', 'PAGADO'),
    // Otro hermano, otro año u otro tipo no son su reemisión.
    cuota(12, 'Cuota anual 2026 (reemisión)', 'PENDIENTE', 2),
    { ...cuota(13, 'Donativo (reemisión)', 'PENDIENTE'), tipo: 'DONATIVO' },
  ]);
  assert.equal(enlaces.get(11), 10);
  assert.equal(enlaces.get(12), null);
  assert.equal(enlaces.get(13), null);
});

test('la papeleta de otra salida no reemite la devuelta; la de la misma salida, sí', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const papeleta = (id: number, concepto: string, estado: string, salidaId: number): Fila => ({ ...cuota(id, concepto, estado), tipo: 'PAPELETA_SITIO', salidaId });
  const enlaces = await rellenar([
    papeleta(20, 'Papeleta Pasión 2026', 'DEVUELTO', 1),
    papeleta(21, 'Papeleta Rosario 2026 (reemisión)', 'PAGADO', 2),
    papeleta(22, 'Papeleta Pasión 2026 (reemisión)', 'PAGADO', 1),
  ]);
  assert.equal(enlaces.get(21), null, 'la del Rosario no salda la de la Pasión');
  assert.equal(enlaces.get(22), 20);
});

test('una cadena de dos queda enlazada paso a paso', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const enlaces = await rellenar([
    cuota(30, 'Cuota 2026', 'DEVUELTO'),
    cuota(31, 'Cuota 2026 (reemisión)', 'DEVUELTO'),
    cuota(32, 'Cuota 2026 (reemisión) (reemisión)', 'PAGADO'),
  ]);
  assert.equal(enlaces.get(31), 30);
  assert.equal(enlaces.get(32), 31);
});

test('con una reemisión a mano sin «(reemisión)» en medio, el primer devuelto queda suelto (lo cierra «Reemitir» con su id: R1)', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const enlaces = await rellenar([
    cuota(40, 'Cuota anual 2026', 'DEVUELTO'),
    cuota(41, 'Cuota 2026', 'DEVUELTO'),
    cuota(42, 'Cuota 2026 (reemisión)', 'PAGADO'),
  ]);
  // Los dos tienen el 42 por candidato y se lo queda el más cercano.
  assert.equal(enlaces.get(42), 41);
  assert.equal(enlaces.get(41), null);
  assert.equal([...enlaces.values()].filter((v) => v === 40).length, 0, 'el 40 sigue debiéndose');
});
