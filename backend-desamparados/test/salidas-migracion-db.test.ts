// La migración de las salidas contra MariaDB: las dos de siempre quedan como
// filas con lo que antes decía el código, nada se queda sin salida y la
// configuración que vivía en claves sueltas desaparece.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import type { PuestoDelCatalogo } from '../src/domain/salidas.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await db.$disconnect();
});

test('las dos salidas de siempre existen con su configuración', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const [pasion, rosario] = await Promise.all([
    db.salida.findUniqueOrThrow({ where: { slug: 'sabado-de-pasion' } }),
    db.salida.findUniqueOrThrow({ where: { slug: 'rosario-vespertino' } }),
  ]);
  assert.equal(pasion.fecha, 'PASCUA');
  assert.equal(pasion.diasDesdePascua, -8);
  assert.equal(pasion.conRopa, true);
  assert.equal(pasion.cobro, 'CUOTA');
  assert.ok(Array.isArray(pasion.puestos) && pasion.puestos.length > 0);
  assert.equal(rosario.fecha, 'MANUAL');
  assert.equal(rosario.cobro, 'DONATIVO');
  assert.equal(rosario.conRopa, false);
});

test('el catálogo de la Pasión trae los puestos de la hoja, con su ropa', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const { puestos } = await db.salida.findUniqueOrThrow({ where: { slug: 'sabado-de-pasion' } });
  const lista = puestos as unknown as PuestoDelCatalogo[];
  const puesto = (nombre: string) => lista.find((p) => p.nombre === nombre);
  assert.equal(puesto('Nazareno')?.tocado, 'CAPIROTE');
  assert.equal(puesto('Guardería')?.tocado, 'FARAONA');
  assert.equal(puesto('Trono')?.alturaHombro, true);
  assert.equal(puesto('Mantilla')?.tunica, false);
  assert.equal(new Set(lista.map((p) => p.nombre)).size, lista.length);
});

test('ninguna papeleta, solicitud ni turno queda sin salida', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const huerfanas = await db.$queryRaw<{ n: bigint }[]>`
    SELECT (SELECT COUNT(*) FROM PapeletaSitio p LEFT JOIN Salida s ON s.id = p.salidaId WHERE s.id IS NULL)
         + (SELECT COUNT(*) FROM Solicitud o LEFT JOIN Salida s ON s.id = o.salidaId WHERE s.id IS NULL)
         + (SELECT COUNT(*) FROM Turno t LEFT JOIN Salida s ON s.id = t.salidaId WHERE s.id IS NULL) AS n`;
  assert.equal(Number(huerfanas[0].n), 0);
});

test('la configuración vieja de las salidas ya no está', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const viejas = await db.configuracion.count({ where: { key: { in: ['papeletas_abiertas', 'papeletas_abiertas_rosario', 'rosario_evento_id', 'precio_papeleta_sitio'] } } });
  assert.equal(viejas, 0);
});
