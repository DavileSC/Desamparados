// test/paginas-sin-migrar.test.ts
//
// El aviso que da el arranque de la API cuando una página sigue guardada con la
// forma anterior a los bloques.
//
// Vale la pena fijarlo porque lo que vigila no se ve: sin convertir, el CMS
// abre igual, `mezclarConDefectos` descarta las claves de la forma antigua y lo
// que el Grupo Parroquial hubiera editado en el Recorrido, la Titular o la
// Historia vuelve a los textos de partida sin un solo error. Si esta detección
// dejara de funcionar, nadie se enteraría hasta que el contenido ya no está.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import db from '../src/config/db.js';
import {
  PAGINAS_ANTERIORES_A_BLOQUES,
  paginasSinMigrarABloques,
} from '../src/domain/paginas-sin-migrar.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;

/** La forma que tenía el Recorrido antes de los bloques, recortada. */
const FORMA_ANTIGUA = { titulo: 'Recorrido', subtitulo: 'Itinerario.', introduccion: 'Texto.', paradas: [] };

let copiaDelRecorrido: unknown = null;

async function sondearDb(): Promise<boolean> {
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const);
  return (await Promise.race([consulta, timeout])) === 'ok';
}

before(async () => {
  dbDisponible = await sondearDb();
  if (!dbDisponible) return;
  const fila = await db.contenidoPagina.findUnique({ where: { slug: 'recorrido' } });
  copiaDelRecorrido = fila?.datos ?? null;
});

// La fila se devuelve a como estaba pase lo que pase: esta prueba escribe sobre
// contenido de verdad, no sobre una fila de usar y tirar.
after(async () => {
  if (copiaDelRecorrido !== null) {
    await db.contenidoPagina.update({ where: { slug: 'recorrido' }, data: { datos: copiaDelRecorrido as object } });
  }
  await db.$disconnect();
});

describe('páginas que siguen con la forma anterior a los bloques', () => {
  test('la lista es la que convierte el script de migración', () => {
    assert.deepEqual([...PAGINAS_ANTERIORES_A_BLOQUES], ['recorrido', 'titular', 'historia']);
  });

  test('una base ya convertida no tiene ninguna pendiente', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    if (copiaDelRecorrido === null) return t.skip('no hay fila de recorrido: siembra la base');
    assert.deepEqual(await paginasSinMigrarABloques(), []);
  });

  test('una página con la forma antigua se detecta por su slug', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    if (copiaDelRecorrido === null) return t.skip('no hay fila de recorrido: siembra la base');

    await db.contenidoPagina.update({ where: { slug: 'recorrido' }, data: { datos: FORMA_ANTIGUA } });
    assert.deepEqual(await paginasSinMigrarABloques(), ['recorrido']);

    await db.contenidoPagina.update({ where: { slug: 'recorrido' }, data: { datos: copiaDelRecorrido as object } });
    assert.deepEqual(await paginasSinMigrarABloques(), [], 'al volver a la forma nueva deja de avisar');
  });
});
