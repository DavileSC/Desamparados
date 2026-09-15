// El contenido editable de la portada y el recorrido contra MariaDB.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import { sembrarContenidoPaginas } from '../prisma/seed-contenido.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => { await db.$disconnect(); });

test('la siembra deja las dos páginas con los textos de siempre', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  await sembrarContenidoPaginas();
  const filas = await db.contenidoPagina.findMany({ orderBy: { slug: 'asc' } });

  assert.deepEqual(filas.map((f) => f.slug), ['portada', 'recorrido']);
  assert.equal((filas[0].datos as any).hero.titulo, 'Desamparados Málaga');
  assert.equal((filas[1].datos as any).paradas.length, 9);
});

test('sembrar dos veces no pisa lo que se haya editado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  await sembrarContenidoPaginas();
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  await db.contenidoPagina.update({
    where: { slug: 'portada' },
    data: { datos: { ...(antes!.datos as object), hero: { titulo: 'Editado a mano' } } },
  });

  await sembrarContenidoPaginas();

  const despues = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  assert.equal((despues!.datos as any).hero.titulo, 'Editado a mano', 'la siembra no puede deshacer una edición');

  // Se deja como estaba para no ensuciar la base de desarrollo.
  await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes!.datos as object } });
});
