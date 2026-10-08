// test/omisiones-sin-db.test.ts
//
// Guardiana de «omitido no es pasado» (docs/notas-del-proyecto.md §6): toda
// prueba que se omite por no llegar a MariaDB lo dice con el motivo común de
// `fixtures/sin-db.ts`, que empieza por «requiere MariaDB». La guarda del CI
// solo reconoce ese texto; un motivo escrito a mano («sin base de datos»,
// el mensaje del driver…) se le escapaba y la suite quedaba en verde sin
// haber probado nada. Lee los ficheros como texto: no necesita base.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SIN_DB, sinDb } from './fixtures/sin-db.js';

const carpeta = path.dirname(fileURLToPath(import.meta.url));
const ficheros = readdirSync(carpeta).filter((f) => f.endsWith('.test.ts'));

test('los dos motivos empiezan por lo que busca la guarda del CI', () => {
  assert.match(SIN_DB, /^requiere MariaDB/);
  assert.match(sinDb('la conexión no respondió en 3 s'), /^requiere MariaDB/);
  assert.match(sinDb(''), /^requiere MariaDB/);
});

test('nadie se escribe su propio motivo de «sin base de datos»', () => {
  assert.ok(ficheros.length > 50, 'no encuentra los ficheros de prueba');
  const malas: string[] = [];
  for (const fichero of ficheros) {
    readFileSync(path.join(carpeta, fichero), 'utf8').split('\n').forEach((linea, i) => {
      if (/^\s*const SIN_DB\s*=/.test(linea)) malas.push(`${fichero}:${i + 1} declara su propio SIN_DB`);
      // Una omisión condicionada a la base tiene que usar el motivo común.
      const porLaBase = /(dbDisponible|sondearDb|DbDisponible)/.test(linea) && /\bskip\(/.test(linea);
      if (porLaBase && !/skip\((SIN_DB|sinDb\()/.test(linea)) malas.push(`${fichero}:${i + 1} ${linea.trim()}`);
    });
  }
  assert.deepEqual(malas, [], 'usa SIN_DB o sinDb(…) de ./fixtures/sin-db.js');
});
