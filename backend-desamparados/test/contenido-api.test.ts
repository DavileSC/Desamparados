// El contenido editable de la portada, el recorrido y la historia contra MariaDB.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import http, { type Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { sembrarContenidoPaginas } from '../prisma/seed-contenido.js';
import { SLUGS_CONTENIDO, porDefecto, type SlugContenido } from '../src/domain/contenido.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

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

/**
 * Lo que hace el navegador al revalidar lo que tiene guardado. Con `http` y
 * no con `fetch`: el `fetch` de Node, al ver un `If-None-Match` puesto a
 * mano, añade por norma `Cache-Control: no-cache`, y Express responde entonces
 * 200 aunque el ETag coincida.
 */
const estadoRevalidando = (url: string, etag: string) =>
  new Promise<number>((resolve, reject) => {
    http.get(url, { headers: { 'If-None-Match': etag } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    }).on('error', reject);
  });

const cookieCms = (id: number, role: Role) => `${COOKIE_CMS}=${generateToken(id, role, false, 'cms')}`;

test('la siembra deja una fila por página editable, con los textos de siempre', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  await sembrarContenidoPaginas();
  const filas = await db.contenidoPagina.findMany({ orderBy: { slug: 'asc' } });

  // La lista sale de `SLUGS_CONTENIDO` y no escrita a mano: convertir una
  // página más a bloques la añade ahí, y una lista repetida aquí convertía
  // cada página nueva en un rojo que no señalaba ningún defecto.
  assert.deepEqual(filas.map((f) => f.slug), [...SLUGS_CONTENIDO].sort());

  // Los textos se comprueban en lo que la siembra escribe en una fila nueva
  // (`porDefecto`, de shared/contenido-por-defecto.json), no en la fila viva:
  // la siembra no pisa lo editado, y la base de desarrollo tiene el recorrido
  // editado (9 paradas), con lo que esta prueba fallaba siempre en local.
  const documento = (slug: string) => porDefecto(slug as SlugContenido) as any;

  // Los tres fines, cada uno con su página (desde el 26-09-2026, en los tres anillos).
  const fines = documento('nuestros-fines').bloques.find((b: any) => b.tipo === 'anillos');
  assert.deepEqual(fines.fines.map((f: any) => f.enlace), ['/cultos', '/nuestros-fines/caridad', '/nuestros-fines/formacion']);
  // Los cinco hitos de siempre viven ahora en el bloque de cronología.
  const cronologia = documento('historia').bloques.find((b: any) => b.tipo === 'cronologia');
  assert.equal(cronologia.hitos.length, 5);
  // Las páginas de datos vivos se siembran con su listado, y Contacto con su formulario.
  assert.equal(documento('noticias').bloques[0].fuente, 'noticias');
  assert.equal(documento('contacto').bloques[0].tipo, 'contacto');
  assert.equal(documento('portada').hero.titulo, 'Desamparados Málaga');
  // El recorrido guarda sus paradas dentro del bloque de itinerario: las
  // diecinueve calles de 2025, y el recorrido sobre el mapa.
  const itinerario = documento('recorrido').bloques.find((b: any) => b.tipo === 'itinerario');
  assert.equal(itinerario.paradas.length, 19);
  assert.ok(itinerario.recorrido.linea.length >= 2, 'el recorrido se siembra con su línea sobre el mapa');
  // Y las páginas convertidas en esta tanda traen ya su contenido de siempre.
  assert.ok(documento('cultos').bloques.length >= 2, 'Cultos se siembra con su texto y sus tarjetas');
  assert.ok(documento('ajuar').bloques.length >= 1, 'Ajuar se siembra con su texto');
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
  // La fila viva puede estar editada: se deja con los textos de partida y se
  // devuelve como estaba.
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  try {
    await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: porDefecto('portada') as object } });
    const respuesta = await fetch(`${baseUrl}/api/contenido/portada`);
    assert.equal(respuesta.status, 200);

    const datos = await respuesta.json() as any;
    assert.equal(datos.hero.titulo, 'Desamparados Málaga');
    assert.equal(datos.accesos.teselas.length, 6);
  } finally {
    await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes!.datos as object } });
  }
});

test('las lecturas públicas se guardan en caché solo revalidando, y responden 304 si nada cambió (FR12)', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  for (const ruta of ['/api/contenido/portada', '/api/portada', '/api/news/latest', '/api/news/archive', '/api/publications/latest', '/api/publications']) {
    const primera = await fetch(`${baseUrl}${ruta}`);
    assert.equal(primera.status, 200, ruta);
    // Nunca `max-age`: el CMS vuelve a pedir estas rutas nada más publicar.
    assert.equal(primera.headers.get('cache-control'), 'public, no-cache', ruta);
    const etag = primera.headers.get('etag');
    assert.ok(etag, `${ruta} tiene que llevar ETag para poder revalidar`);
    assert.equal(await estadoRevalidando(`${baseUrl}${ruta}`, etag!), 304, ruta);
  }
  // Lo que depende de la sesión no lleva la cabecera pública.
  const privada = await fetch(`${baseUrl}/api/contenido/portada/versiones`);
  assert.equal(privada.status, 401);
  assert.notEqual(privada.headers.get('cache-control'), 'public, no-cache');
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

test('el HTML de un bloque se guarda saneado, no como llegó', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // El agujero que esto cierra: `ContenidoService.guardar` hace un `upsert` del
  // documento entero, así que sin `sanearBloques` el HTML se almacenaba literal
  // y la única barrera era el saneado del navegador. Se sondea la ruta entera
  // —no el esquema suelto— porque el defecto no estaba en el esquema sino en
  // que nadie llamaba al saneado por el camino.
  const redes = await crearUsuarioPrueba(Role.REDES);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'nuestros-fines' } });
  try {
    const nuevo = porDefecto('nuestros-fines') as any;
    nuevo.bloques = [{
      tipo: 'texto',
      titulo: '',
      html: '<p>Hola</p><img src="https://rastreador.ejemplo/pixel.gif"><script>alert(1)</script>'
        + '<a href="javascript:alert(2)">pulsa</a>',
    }];

    const respuesta = await fetch(`${baseUrl}/api/contenido/nuestros-fines`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieCms(redes.id, Role.REDES) },
      body: JSON.stringify({ datos: nuevo }),
    });
    assert.equal(respuesta.status, 200);

    // Se comprueba en la BASE, no en la respuesta: lo que importa es lo que
    // queda almacenado, que es lo que servirá a cualquier consumidor futuro.
    const fila = await db.contenidoPagina.findUnique({ where: { slug: 'nuestros-fines' } });
    const html = ((fila!.datos as any).bloques[0].html) as string;
    assert.ok(html.includes('<p>Hola</p>'), 'el contenido legítimo se conserva');
    assert.ok(!html.includes('<script'), 'el script no puede quedar almacenado');
    assert.ok(!html.includes('rastreador.ejemplo'), 'una imagen de fuera filtra la IP de quien la vea');
    assert.ok(!html.includes('javascript:'), 'un enlace con javascript: tampoco');
  } finally {
    await db.contenidoPagina.update({ where: { slug: 'nuestros-fines' }, data: { datos: antes!.datos as object } });
    await borrarUsuarioPrueba(redes.id);
  }
});

test('el vídeo de una galería se guarda ya normalizado, no como se pegó', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // El CMS pide «pega la dirección de YouTube», que es la de la barra del
  // navegador. Si el documento se guardara tal cual, la web pondría esa
  // dirección en el iframe: con cookies de terceros y sin la forma `/embed`,
  // que es la única que se puede incrustar. Se sondea la ruta entera porque la
  // normalización no vive en el esquema —`paginaDeBloquesSchema` descarta la
  // salida de cada bloque— sino en el paso previo, `sanearBloques`.
  const redes = await crearUsuarioPrueba(Role.REDES);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'nuestros-fines' } });
  try {
    const nuevo = porDefecto('nuestros-fines') as any;
    nuevo.bloques = [{
      tipo: 'galeria',
      titulo: 'Galería',
      medios: [{
        tipo: 'video',
        url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
        portada: '/storage/public/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp',
        alt: 'Salida procesional de 2026',
        pie: '',
      }],
    }];

    const respuesta = await fetch(`${baseUrl}/api/contenido/nuestros-fines`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieCms(redes.id, Role.REDES) },
      body: JSON.stringify({ datos: nuevo }),
    });
    assert.equal(respuesta.status, 200);

    const fila = await db.contenidoPagina.findUnique({ where: { slug: 'nuestros-fines' } });
    const url = ((fila!.datos as any).bloques[0].medios[0].url) as string;
    assert.equal(url, 'https://www.youtube-nocookie.com/embed/aaaaaaaaaaa');
  } finally {
    await db.contenidoPagina.update({ where: { slug: 'nuestros-fines' }, data: { datos: antes!.datos as object } });
    await borrarUsuarioPrueba(redes.id);
  }
});

test('una galería con un vídeo que no es de YouTube ni de Vimeo se rechaza', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // El valor acaba en el `src` de un iframe de la web pública: con dirección
  // libre, quien edite el CMS podría incrustar cualquier página dentro del sitio.
  const redes = await crearUsuarioPrueba(Role.REDES);
  try {
    const nuevo = porDefecto('nuestros-fines') as any;
    nuevo.bloques = [{
      tipo: 'galeria',
      titulo: 'Galería',
      medios: [{
        tipo: 'video',
        url: 'https://ejemplo.test/lo-que-sea',
        portada: '/storage/public/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp',
        alt: 'Un vídeo de fuera',
        pie: '',
      }],
    }];

    const respuesta = await fetch(`${baseUrl}/api/contenido/nuestros-fines`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieCms(redes.id, Role.REDES) },
      body: JSON.stringify({ datos: nuevo }),
    });
    assert.equal(respuesta.status, 400);
  } finally {
    await borrarUsuarioPrueba(redes.id);
  }
});

test('un bloque que solo lleva porquería se rechaza, no se guarda en blanco', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // Por esto el saneado va ANTES del esquema: `<script>…</script>` se queda en
  // nada al limpiarlo, y un bloque vacío no pinta nada. Si se saneara después
  // de validar, esto se habría guardado como un hueco.
  const redes = await crearUsuarioPrueba(Role.REDES);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'nuestros-fines' } });
  try {
    const nuevo = porDefecto('nuestros-fines') as any;
    nuevo.bloques = [{ tipo: 'texto', titulo: '', html: '<script>alert(1)</script>' }];

    const respuesta = await fetch(`${baseUrl}/api/contenido/nuestros-fines`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieCms(redes.id, Role.REDES) },
      body: JSON.stringify({ datos: nuevo }),
    });
    assert.equal(respuesta.status, 400);

    const fila = await db.contenidoPagina.findUnique({ where: { slug: 'nuestros-fines' } });
    assert.deepEqual(fila!.datos, antes!.datos, 'la página no se toca');
  } finally {
    // Se restaura aunque el 400 no debiera haber tocado nada: si esta prueba
    // falla es justamente porque SÍ se guardó, y entonces dejaría la página
    // envenenada para los demás tests del fichero. Un test que al romperse
    // ensucia la base convierte un fallo en varios y esconde el de verdad.
    await db.contenidoPagina.update({ where: { slug: 'nuestros-fines' }, data: { datos: antes!.datos as object } });
    await borrarUsuarioPrueba(redes.id);
  }
});

test('una página con los seis tipos de bloque se guarda y se lee tal cual', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // La comprobación que pide `docs/notas-del-proyecto.md` §7: con las suites en
  // verde, la galería de vídeo estuvo rota porque el servidor rechazaba justo
  // lo que el CMS pedía pegar. Aquí va un documento con los seis tipos, con los
  // mismos campos que arma el CMS (`BLOQUE_NUEVO` en formularios.tsx, ya
  // rellenos), por la ruta de verdad.
  const redes = await crearUsuarioPrueba(Role.REDES);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'nuestros-fines' } });
  const FOTO = '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp';
  try {
    const nuevo = porDefecto('nuestros-fines') as any;
    nuevo.bloques = [
      { tipo: 'texto', titulo: '', html: '<p>Un párrafo</p>' },
      { tipo: 'foto', titulo: 'La Titular', url: FOTO, alt: 'La Virgen en su trono', pie: 'Camarín' },
      {
        tipo: 'galeria', titulo: 'Galería',
        medios: [
          { tipo: 'foto', url: FOTO, portada: '', alt: 'El trono en la plaza', pie: '' },
          {
            tipo: 'video',
            // Tal y como se pega desde la barra del navegador: el servidor la
            // normaliza antes de validarla.
            url: 'https://youtu.be/aaaaaaaaaaa',
            portada: FOTO, alt: 'Salida procesional', pie: '',
          },
        ],
      },
      {
        tipo: 'tarjetas', titulo: 'Explora la sección',
        tarjetas: [{ titulo: 'Historia', descripcion: 'Orígenes.', enlace: '/historia' }],
      },
      {
        tipo: 'llamada', titulo: '¿Quieres ser hermano?',
        texto: 'Las solicitudes se abren en septiembre.',
        boton: 'Hazte hermano', enlace: '/hazte-hermano',
      },
      {
        tipo: 'datos', titulo: 'Horario de cultos',
        lineas: [{ etiqueta: 'Misa de hermandad', valor: 'Primer viernes, a las 20:00' }],
      },
    ];

    const respuesta = await fetch(`${baseUrl}/api/contenido/nuestros-fines`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieCms(redes.id, Role.REDES) },
      body: JSON.stringify({ datos: nuevo }),
    });
    assert.equal(respuesta.status, 200, await respuesta.text());

    // Y se lee sin sesión, que es como lo pide la web pública: el orden y los
    // seis tipos, intactos.
    const leido = await (await fetch(`${baseUrl}/api/contenido/nuestros-fines`)).json() as any;
    assert.deepEqual(
      leido.bloques.map((b: { tipo: string }) => b.tipo),
      ['texto', 'foto', 'galeria', 'tarjetas', 'llamada', 'datos'],
    );
    assert.equal(leido.bloques[2].medios[1].url, 'https://www.youtube-nocookie.com/embed/aaaaaaaaaaa');
    assert.equal(leido.bloques[4].boton, 'Hazte hermano');
    assert.equal(leido.bloques[5].lineas[0].etiqueta, 'Misa de hermandad');
  } finally {
    await db.contenidoPagina.update({ where: { slug: 'nuestros-fines' }, data: { datos: antes!.datos as object } });
    await borrarUsuarioPrueba(redes.id);
  }
});
