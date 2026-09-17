// El contenido editable de la portada, el recorrido y la historia contra MariaDB.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { sembrarContenidoPaginas } from '../prisma/seed-contenido.js';
import { porDefecto } from '../src/domain/contenido.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

const cookieCms = (id: number, role: Role) => `${COOKIE_CMS}=${generateToken(id, role, false, 'cms')}`;

test('la siembra deja las cinco páginas con los textos de siempre', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  await sembrarContenidoPaginas();
  const filas = await db.contenidoPagina.findMany({ orderBy: { slug: 'asc' } });

  assert.deepEqual(filas.map((f) => f.slug), ['corporacion', 'historia', 'portada', 'recorrido', 'titular']);
  assert.equal((filas[0].datos as any).bloques.length, 2);
  assert.equal((filas[1].datos as any).hitos.length, 5);
  assert.equal((filas[2].datos as any).hero.titulo, 'Desamparados Málaga');
  assert.equal((filas[3].datos as any).paradas.length, 9);
  // La galería nace vacía: las fotos las sube el Grupo Parroquial desde el CMS.
  assert.deepEqual((filas[4].datos as any).galeria, []);
});

test('sembrar dos veces no pisa lo que se haya editado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  await sembrarContenidoPaginas();
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  try {
    await db.contenidoPagina.update({
      where: { slug: 'portada' },
      data: { datos: { ...(antes!.datos as object), hero: { titulo: 'Editado a mano' } } },
    });

    await sembrarContenidoPaginas();

    const despues = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
    assert.equal((despues!.datos as any).hero.titulo, 'Editado a mano', 'la siembra no puede deshacer una edición');
  } finally {
    // Pase lo que pase arriba: la batería corre en serie contra una base
    // compartida, y dejar `portada` con el hero a medias rompería la portada
    // para todos los ficheros que se ejecuten después.
    await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes!.datos as object } });
  }
});

test('GET /api/contenido/portada devuelve el documento mezclado, sin sesión', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await sembrarContenidoPaginas();

  const respuesta = await fetch(`${baseUrl}/api/contenido/portada`);
  assert.equal(respuesta.status, 200);

  const datos = await respuesta.json() as any;
  assert.equal(datos.hero.titulo, 'Desamparados Málaga');
  assert.equal(datos.accesos.teselas.length, 6);
});

test('un campo que falta en la fila sale del valor por defecto', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  try {
    // Una fila a la que solo le queda el hero: simula un documento guardado
    // antes de que existiera un campo nuevo.
    await db.contenidoPagina.update({
      where: { slug: 'portada' }, data: { datos: { hero: { titulo: 'Solo esto' } } },
    });

    const datos = await (await fetch(`${baseUrl}/api/contenido/portada`)).json() as any;
    assert.equal(datos.hero.titulo, 'Solo esto');
    assert.equal(datos.publicaciones.boton, 'Archivo de publicaciones', 'el resto no puede quedar en blanco');
  } finally {
    await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes!.datos as object } });
  }
});

test('sin fila en la base, la portada responde 200 con los textos de siempre', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  try {
    // Simula una base recién creada o una siembra que no ha corrido: no hay
    // fila para 'portada'. `ContenidoService.leer` es la red de seguridad de
    // la web pública para este caso, y hasta ahora solo estaba comprobada
    // leyendo el código.
    await db.contenidoPagina.delete({ where: { slug: 'portada' } });

    const respuesta = await fetch(`${baseUrl}/api/contenido/portada`);
    assert.equal(respuesta.status, 200, 'sin fila la portada no puede quedarse en blanco (404) ni romperse (500)');

    const datos = await respuesta.json() as any;
    assert.equal(datos.hero.titulo, 'Desamparados Málaga', 'sin fila debe salir el texto por defecto, no un cuerpo vacío');
  } finally {
    // Se recrea con lo capturado ANTES de borrar, no resembrando: sembrar es
    // un upsert con `update: {}` (no pisa lo editado), así que si la fila
    // borrada aquí no existiera para la siembra ya no estaríamos ante los
    // valores de por defecto sino ante los que tuviera 'antes'.
    await db.contenidoPagina.create({ data: { slug: 'portada', datos: antes!.datos as object } });
  }
});

test('un slug que no existe responde 404 y no crea fila', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const respuesta = await fetch(`${baseUrl}/api/contenido/inventada`);
  assert.equal(respuesta.status, 404);
  assert.equal(await db.contenidoPagina.count({ where: { slug: 'inventada' } }), 0);
});

test('sin sesión no se puede guardar', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  // Se sondea el servidor, no se lee el router: un 500 aquí querría decir que la
  // petición llegó a la base de datos sin sesión.
  const respuesta = await fetch(`${baseUrl}/api/contenido/portada`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datos: porDefecto('portada') }),
  });
  assert.equal(respuesta.status, 401);
});

test('un hermano sin cargo no puede guardar', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const usuario = await crearUsuarioPrueba(Role.USER);
  try {
    const respuesta = await fetch(`${baseUrl}/api/contenido/portada`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${COOKIE_HERMANO}=${generateToken(usuario.id, Role.USER, false, 'hermanos')}`,
      },
      body: JSON.stringify({ datos: porDefecto('portada') }),
    });
    assert.ok(respuesta.status === 401 || respuesta.status === 403, `esperaba 401 o 403, llegó ${respuesta.status}`);
  } finally {
    await borrarUsuarioPrueba(usuario.id);
  }
});

test('un cargo del CMS sin permiso sobre el contenido tampoco guarda', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // El test de arriba manda la cookie de hermanos, que muere antes en
  // `authenticateToken`: `checkRole` ni llega a ejecutarse, así que el permiso
  // por cargo se quedaba sin probar. Con una cookie del CMS de un rol que no
  // toca contenido —TESORERIA— la petición sí llega hasta él.
  const tesoreria = await crearUsuarioPrueba(Role.TESORERIA);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  try {
    const respuesta = await fetch(`${baseUrl}/api/contenido/portada`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieCms(tesoreria.id, Role.TESORERIA) },
      body: JSON.stringify({ datos: porDefecto('portada') }),
    });
    assert.equal(respuesta.status, 403);

    const despues = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
    assert.deepEqual(despues!.datos, antes!.datos, 'un cargo sin permiso no puede dejar rastro en la fila');
  } finally {
    // Si el 403 se rompiera —justo lo que este test vigila— la fila se habría
    // quedado con lo que mandó la petición. La batería corre en serie contra
    // una base compartida: se restaura pase lo que pase arriba.
    await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes!.datos as object } });
    await borrarUsuarioPrueba(tesoreria.id);
  }
});

test('un documento mal formado responde 400 y NO escribe', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const redes = await crearUsuarioPrueba(Role.REDES);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  try {
    const roto = porDefecto('portada') as any;
    roto.hero.titulo = 42;

    const respuesta = await fetch(`${baseUrl}/api/contenido/portada`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieCms(redes.id, Role.REDES) },
      body: JSON.stringify({ datos: roto }),
    });
    assert.equal(respuesta.status, 400);

    const despues = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
    assert.deepEqual(despues!.datos, antes!.datos, 'un 400 no puede dejar la fila a medias');
  } finally {
    // Si la aserción de arriba fallara —justo el caso que este test existe
    // para cazar— la fila se quedaría con el documento roto: la batería corre
    // en serie contra una base compartida y eso contaminaría todo lo que se
    // ejecute después. Se restaura incondicionalmente, pase lo que pase arriba.
    await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes!.datos as object } });
    await borrarUsuarioPrueba(redes.id);
  }
});

test('REDES guarda y lo guardado se lee', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const redes = await crearUsuarioPrueba(Role.REDES);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  try {
    const nuevo = porDefecto('portada') as any;
    nuevo.hero.titulo = 'Desamparados de Málaga';

    const respuesta = await fetch(`${baseUrl}/api/contenido/portada`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieCms(redes.id, Role.REDES) },
      body: JSON.stringify({ datos: nuevo }),
    });
    assert.equal(respuesta.status, 200);

    const leido = await (await fetch(`${baseUrl}/api/contenido/portada`)).json() as any;
    assert.equal(leido.hero.titulo, 'Desamparados de Málaga');
  } finally {
    await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes!.datos as object } });
    await borrarUsuarioPrueba(redes.id);
  }
});
