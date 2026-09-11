import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import app from '../src/app.js';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import db from '../src/config/db.js';
import { generateToken, generatePending2FAToken } from '../src/utils/jwt.handle.js';
import { COOKIE_SESION } from '../src/utils/cookies.js';
import { Role } from '@prisma/client';
import { AdminService } from '../src/services/admin.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';

let server: Server;
let baseUrl: string;

/**
 * Los tests que consultan la base de datos solo tienen sentido con MariaDB
 * levantada. Sin ella el servidor devuelve 500 tras el timeout de conexión y
 * el fallo no dice nada sobre el código, así que se sondea una vez y esos
 * casos se marcan como omitidos con el motivo a la vista, en vez de fallar.
 *
 * OJO: el skip va DENTRO del cuerpo con `t.skip()`, no en las opciones del
 * test. La opcion `skip` del runner de Node espera un valor, no una funcion:
 * una funcion es siempre truthy, nunca se llama, y el test queda omitido para
 * siempre haya base de datos o no. Asi estuvieron desactivados sin que se
 * notara. Ademas, `dbDisponible` solo se conoce despues del before().
 */
let dbDisponible = false;
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

// Por qué no se pudo conectar. Sin esto, una ejecución sin base de datos se
// limita a omitir los tests y no hay forma de saber si es que MariaDB está
// parada, si el .env apunta a otro sitio o si la contraseña es incorrecta.
let motivoSinDb = '';

async function sondearDb(): Promise<boolean> {
  // Con un timeout corto: el driver reintenta durante ~20 s antes de rendirse
  // y eso convertia cada ejecución sin base de datos en una espera inútil.
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`
    .then(() => 'ok' as const)
    .catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));

  const resultado = await Promise.race([consulta, timeout]);
  if (resultado === 'ok') return true;

  motivoSinDb = resultado === 'timeout'
    ? `la conexión no respondió en 3 s (DATABASE_HOST=${process.env.DATABASE_HOST ?? 'sin definir'})`
    : resultado.message;
  return false;
}

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  dbDisponible = await sondearDb();
  if (!dbDisponible) {
    console.log(`
ℹ  Sin conexión a la base de datos: se omiten los tests que la necesitan.`);
    console.log(`   Motivo: ${motivoSinDb}`);
    console.log(`   Revisa el .env: DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME.`);
    console.log(`   Los tests omitidos NO demuestran nada: hasta que pasen, la sesión está sin verificar.
`);
  }
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await db.$disconnect();
});

test('healthcheck responde con estado ok', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  const body = await response.json() as { status?: string; uptime?: number };
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptime, 'number');
});

test('las publicaciones públicas no requieren autenticación y vienen paginadas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const response = await fetch(`${baseUrl}/api/publications`);
  assert.equal(response.status, 200);
  const cuerpo = await response.json() as { data: unknown[]; meta: Record<string, number> };
  assert.ok(Array.isArray(cuerpo.data));
  assert.deepEqual(Object.keys(cuerpo.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
});

// Que `meta` traiga las cuatro claves NO demuestra que la página y el tamaño se
// hayan honrado. Si alguien quitara `...paginacionQuery` del esquema, `validate`
// borraría page y limit en silencio: `meta` seguiría completa, `page` valdría 1
// y todas las páginas servirían la primera. Esto es lo que lo detecta.
test('las publicaciones públicas respetan la página y el tamaño pedidos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const primera = await fetch(`${baseUrl}/api/publications?page=1&limit=1`);
  assert.equal(primera.status, 200);
  const uno = await primera.json() as { data: { id: number }[]; meta: Record<string, number> };

  assert.equal(uno.meta.limit, 1, 'el tamaño pedido no llegó al servicio: ¿falta ...paginacionQuery en el esquema?');
  assert.equal(uno.meta.page, 1);

  // Con una sola publicación visible la página 2 estaría vacía y las
  // comprobaciones de abajo pasarían sin comprobar nada: se omite con el motivo
  // a la vista en vez de dar un verde vacío.
  if (uno.meta.total < 2) {
    return t.skip(`solo hay ${uno.meta.total} publicación(es) visible(s); hacen falta al menos 2 para comprobar dos páginas de tamaño 1`);
  }

  const segunda = await fetch(`${baseUrl}/api/publications?page=2&limit=1`);
  const dos = await segunda.json() as { data: { id: number }[]; meta: Record<string, number> };

  assert.equal(dos.meta.page, 2, 'la página pedida no llegó al servicio');
  assert.equal(uno.data.length, 1, 'con al menos 2 publicaciones, la primera página debe traer la que pidió');
  assert.equal(dos.data.length, 1);
  // La segunda página trae otra publicación: si el skip no se aplica, esto falla.
  assert.notEqual(dos.data[0].id, uno.data[0].id);
});

// Boletines y Dossier de prensa se sirven por aquí: si esta ruta se quedara con
// la forma antigua, esas dos pantallas se vaciarían sin dar ningún error.
test('las publicaciones por categoría también vienen paginadas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const response = await fetch(`${baseUrl}/api/publications/category/boletin?page=2&limit=5`);
  assert.equal(response.status, 200);
  const cuerpo = await response.json() as { data: unknown[]; meta: Record<string, number> };
  assert.ok(Array.isArray(cuerpo.data));
  assert.deepEqual(Object.keys(cuerpo.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
  // Esta ruta valida con OTRO esquema (categoryParamSchema): si le faltara
  // ...paginacionQuery, page y limit se perderían solo aquí y en ningún otro sitio.
  assert.equal(cuerpo.meta.page, 2, 'la página pedida se perdió en categoryParamSchema');
  assert.equal(cuerpo.meta.limit, 5, 'el tamaño pedido se perdió en categoryParamSchema');
});

// '/:id' exige sesión y captura cualquier segmento suelto. Declarada antes de
// '/latest', la portada pediría la publicación con id "latest" y el visitante
// anónimo recibiría un 401 en vez de las destacadas.
test('la ruta por id no ensombrece a /latest', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const response = await fetch(`${baseUrl}/api/publications/latest`);
  assert.equal(response.status, 200, 'un 401 significa que /:id se declaró antes y captura "latest"');
  assert.ok(Array.isArray(await response.json()));
});

test('las noticias destacadas no requieren autenticación', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const response = await fetch(`${baseUrl}/api/news/latest`);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(await response.json()));
});

test('el CMS rechaza peticiones sin token', async () => {
  const response = await fetch(`${baseUrl}/api/publications/admin`);
  assert.equal(response.status, 401);
  const body = await response.json() as { error?: string };
  assert.equal(body.error, 'NO_TOKEN_PROVIDED');
});

// Antes, getAdminPublicationById se traía el listado del CMS y buscaba dentro
// con un .find(): una publicación fuera del recorte era imposible de editar.
// Este test comprueba que se pide al servidor por id.
test('la publicación del CMS se lee por id, no buscándola en el listado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const admin = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const token = generateToken(admin.id, Role.ADMIN);
    const cabeceras = { Cookie: `${COOKIE_SESION}=${token}` };

    const listado = await fetch(`${baseUrl}/api/publications/admin?limit=1`, { headers: cabeceras });
    const { data, meta } = await listado.json() as { data: { id: number }[]; meta: { limit: number } };
    // El ?limit=1 no está de adorno: si el esquema del listado perdiera page y
    // limit, esto seguiría trayendo la página entera sin que nadie se enterara.
    assert.equal(meta.limit, 1, 'el listado del CMS ignoró el tamaño pedido');
    if (data.length === 0) return t.skip('no hay publicaciones sembradas');

    const respuesta = await fetch(`${baseUrl}/api/publications/${data[0].id}`, { headers: cabeceras });
    assert.equal(respuesta.status, 200);
    assert.equal((await respuesta.json() as { id: number }).id, data[0].id);
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

// La lectura por id muestra también los borradores (visible: false): sin sesión
// no puede servirse. Corta antes de tocar la base de datos.
test('la publicación por id no se sirve sin sesión', async () => {
  const respuesta = await fetch(`${baseUrl}/api/publications/1`);
  assert.equal(respuesta.status, 401);
});

test('el archivo de noticias del CMS rechaza peticiones sin token', async () => {
  // Regresión: esta ruta se declaró antes del use(authenticateToken) para que
  // "admin" no se leyera como slug, y con ello dejó de pasar por el filtro.
  // Expone los borradores (visible: false) a cualquiera.
  const response = await fetch(`${baseUrl}/api/news/admin/archive`);
  assert.equal(response.status, 401);
  const body = await response.json() as { error?: string };
  assert.equal(body.error, 'NO_TOKEN_PROVIDED');
});

// Antes, getAdminNewsById se traía el listado (recortado) y buscaba dentro
// con un .find(): editar una noticia que no cabía en ese recorte era
// imposible. Este test comprueba que la noticia se pide al servidor por id.
test('la noticia del CMS se lee por id, no buscándola en el listado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const admin = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const token = generateToken(admin.id, Role.ADMIN);
    const cabeceras = { Cookie: `${COOKIE_SESION}=${token}` };

    // La página 2 a propósito: pedir la 1 traería justo la noticia que SÍ cabía
    // en el recorte, y entonces el .find() de antes también la habría encontrado.
    // El fallo que esta ruta cierra es el de una noticia MÁS ALLÁ de la primera
    // página, así que es esa la que hay que pedir por id.
    const listado = await fetch(`${baseUrl}/api/news/admin/archive?limit=1&page=2`, { headers: cabeceras });
    const { data, meta } = await listado.json() as { data: { id: number }[]; meta: { limit: number; page: number } };
    // Igual que en publicaciones: el ?limit=1 solo demuestra algo si se comprueba
    // que llegó. Sin esto, el archivo podría servir siempre la página entera.
    assert.equal(meta.limit, 1, 'el archivo del CMS ignoró el tamaño pedido');
    assert.equal(meta.page, 2, 'el archivo del CMS ignoró la página pedida');
    if (data.length === 0) return t.skip('hacen falta al menos 2 noticias sembradas para pedir la de la página 2');

    const respuesta = await fetch(`${baseUrl}/api/news/admin/${data[0].id}`, { headers: cabeceras });
    assert.equal(respuesta.status, 200);
    assert.equal((await respuesta.json() as { id: number }).id, data[0].id);
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

// La ruta va antes de /:slug para que "admin" no se lea como slug, y ese
// orden ya dejó los borradores al aire una vez.
test('la noticia del CMS por id no se sirve sin sesión', async () => {
  const respuesta = await fetch(`${baseUrl}/api/news/admin/1`);
  assert.equal(respuesta.status, 401);
  // El código solo dice «no pasas»; el cuerpo dice QUIÉN cortó. Sin comprobarlo,
  // un 401 de cualquier otra causa (un 404 mal traducido, un fallo de la base de
  // datos) daría el test por bueno y la guarda en línea de la ruta podría faltar.
  const cuerpo = await respuesta.json() as { error?: string };
  assert.equal(cuerpo.error, 'NO_TOKEN_PROVIDED', 'el 401 debe venir de la guarda de sesión de la ruta');
});

test('los documentos privados rechazan peticiones sin token', async () => {
  const response = await fetch(`${baseUrl}/api/upload/private/${'a'.repeat(32)}.pdf`);
  assert.equal(response.status, 401);
});

test('contacto rechaza un cuerpo inválido antes de intentar enviar correo', async () => {
  const response = await fetch(`${baseUrl}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje: 'corto' }),
  });
  assert.equal(response.status, 400);
  const body = await response.json() as { message?: string };
  assert.equal(body.message, 'Error de validación');
});


// ==========================================
//  SESION EN COOKIE httpOnly
// ==========================================
// Ninguno de estos necesita base de datos: el middleware corta antes de llegar.

test('sin cookie, una ruta privada responde 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/mis-datos`);
  assert.equal(res.status, 401);
});

test('la cabecera Authorization ya no autentica', async () => {
  const res = await fetch(`${baseUrl}/api/auth/mis-datos`, {
    headers: { Authorization: `Bearer ${generateToken(1, 'ADMIN')}` }
  });
  assert.equal(res.status, 401);
});

// El caso critico: el testigo del 2FA identifica a un usuario, pero no puede
// servir de sesion. Falla antes de tocar la base de datos, asi que no la necesita.
test('el testigo de 2FA no sirve como cookie de sesion', async () => {
  const res = await fetch(`${baseUrl}/api/auth/mis-datos`, {
    headers: { Cookie: `${COOKIE_SESION}=${generatePending2FAToken(1)}` }
  });
  assert.equal(res.status, 401);
});

// Sin la cookie del primer factor no se entra, aunque el codigo fuera correcto.
// Este es el fallo que se cierra: antes bastaba con mandar { userId, token2fa }.
test('el 2FA sin el testigo del primer factor responde 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token2fa: '123456' })
  });
  assert.equal(res.status, 401);
});

test('el 2FA ya no acepta un userId en el cuerpo', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 1, token2fa: '123456' })
  });
  // 401 por falta de testigo, nunca 200: el userId del cuerpo se ignora
  assert.equal(res.status, 401);
});

test('/me sin cookie responde 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(res.status, 401);
});

test('logout responde 204 y borra las cookies aunque no hubiera sesion', async () => {
  const res = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
  assert.equal(res.status, 204);

  const borrados = res.headers.getSetCookie();
  // El borrado tiene que repetir el Path exacto o el navegador lo ignora
  assert.ok(borrados.some((c) => c.includes('desamparados_session=') && c.includes('Path=/api')));
  assert.ok(borrados.some((c) => c.includes('desamparados_2fa=') && c.includes('Path=/api/auth')));
});

// ==========================================
//  COOKIES CONTRA LA BASE DE DATOS
// ==========================================

// Los hermanos entran por su área: el acceso del CMS ya no da sesión a una
// cuenta USER (responde 403 CUENTA_SIN_CMS), y sin `contexto` el servidor
// entiende que es el del CMS.
async function entrar(email: string, contexto?: 'cms' | 'hermanos') {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD_PRUEBA, ...(contexto ? { contexto } : {}) })
  });
}

function cookieSesionDe(res: Response): string | undefined {
  return res.headers.getSetCookie().find((c) => c.startsWith('desamparados_session='));
}

test('la cookie del hermano persiste 4 h y la del staff muere al cerrar', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const hermano = await crearUsuarioPrueba(Role.USER);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);

  try {
    const deHermano = cookieSesionDe(await entrar(hermano.email, 'hermanos'))!;
    assert.match(deHermano, /HttpOnly/i);
    assert.match(deHermano, /SameSite=Strict/i);
    assert.match(deHermano, /Max-Age=14400/i);

    const deStaff = cookieSesionDe(await entrar(staff.email))!;
    assert.match(deStaff, /HttpOnly/i);
    // Sin Max-Age: cookie de sesion, muere al cerrar el navegador
    assert.doesNotMatch(deStaff, /Max-Age/i);
  } finally {
    await borrarUsuarioPrueba(hermano.id);
    await borrarUsuarioPrueba(staff.id);
  }
});

test('el cuerpo del login ya no lleva el token', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const cuerpo = await (await entrar(hermano.email, 'hermanos')).json() as { status?: string; token?: string; user?: { id?: number } };
    assert.equal(cuerpo.status, 'OK');
    assert.equal(cuerpo.token, undefined);
    assert.ok(cuerpo.user?.id);
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('/me devuelve la sesion cuando se manda la cookie', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const cookie = cookieSesionDe(await entrar(hermano.email, 'hermanos'))!.split(';')[0];
    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });

    assert.equal(res.status, 200);
    const cuerpo = await res.json() as { user: { email: string } };
    assert.equal(cuerpo.user.email, hermano.email);
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('con 2FA activo el login no emite sesion, solo el testigo pendiente', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await db.user.update({
      where: { id: staff.id },
      data: { twoFactorEnabled: true, twoFactorSecret: 'JBSWY3DPEHPK3PXP' }
    });

    const res = await entrar(staff.email);
    const cookies = res.headers.getSetCookie();
    const cuerpo = await res.json() as { status?: string };

    assert.equal(cuerpo.status, '2FA_NEEDED');
    assert.ok(cookies.some((c) => c.startsWith('desamparados_2fa=')));
    assert.ok(!cookies.some((c) => c.startsWith('desamparados_session=')));
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('la agenda deja pasar tanto al invitado como a quien tiene sesion', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  // La agenda se monta en /api/events y usa el middleware opcional unificado:
  // ni bloquea al invitado ni rechaza una cookie valida.
  const deInvitado = await fetch(`${baseUrl}/api/events`);
  assert.equal(deInvitado.status, 200, 'el invitado deberia poder ver la agenda');

  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const cookie = cookieSesionDe(await entrar(hermano.email, 'hermanos'))!.split(';')[0];
    const conSesion = await fetch(`${baseUrl}/api/events`, { headers: { Cookie: cookie } });
    assert.equal(conSesion.status, 200, 'con sesion valida tambien deberia pasar');
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

// Que `meta` traiga las cuatro claves NO demuestra que la página y el tamaño se
// hayan honrado. Ojo con la mutación que hay que vigilar: borrar entero el
// bloque `query` de queryAgendaSchema NO rompe nada, porque `validate` solo
// pisa req.query cuando el esquema declara ese bloque y la consulta cruda
// sobrevive. La que sí rompe es declararlo incompleto: añadir un filtro nuevo y
// olvidarse de `...paginacionQuery`. Entonces page y limit se borran en
// silencio, `meta` sigue completa, `page` vale 1 y todas las páginas sirven la
// primera. Esto es lo que lo detecta.
test('la agenda respeta la pagina y el tamano pedidos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const primera = await fetch(`${baseUrl}/api/events?page=1&limit=1`);
  assert.equal(primera.status, 200);
  const uno = await primera.json() as { data: { id: number }[]; meta: Record<string, number> };

  assert.ok(Array.isArray(uno.data), 'los cuatro consumidores de /api/events leen data: sin ella se quedan en blanco');
  assert.deepEqual(Object.keys(uno.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
  assert.equal(uno.meta.limit, 1, 'el tamano pedido no llego al servicio: ¿falta ...paginacionQuery en queryAgendaSchema?');
  assert.equal(uno.meta.page, 1);

  // Con un solo evento publico la pagina 2 estaria vacia y las comprobaciones
  // de abajo pasarian sin comprobar nada: se omite con el motivo a la vista en
  // vez de dar un verde vacio.
  if (uno.meta.total < 2) {
    return t.skip(`solo hay ${uno.meta.total} evento(s) publico(s) proximo(s); hacen falta al menos 2 para comprobar dos paginas de tamano 1 (ejecuta el seed de contenido)`);
  }

  const segunda = await fetch(`${baseUrl}/api/events?page=2&limit=1`);
  const dos = await segunda.json() as { data: { id: number }[]; meta: Record<string, number> };

  assert.equal(dos.meta.page, 2, 'la pagina pedida no llego al servicio');
  assert.equal(uno.data.length, 1, 'con al menos 2 eventos, la primera pagina debe traer el que pidio');
  assert.equal(dos.data.length, 1);
  // La segunda pagina trae otro evento: si el skip no se aplica, esto falla.
  assert.notEqual(dos.data[0].id, uno.data[0].id);
});

// El tope duro no lo pone el esquema (que solo exige digitos) sino
// sanearPaginacion: un ?limit=999999 escrito a mano no puede llevarse la agenda
// entera por delante.
test('la agenda recorta un tamano desmedido al tope', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const respuesta = await fetch(`${baseUrl}/api/events?limit=999999`);
  const cuerpo = await respuesta.json() as { meta: { limit: number } };
  assert.equal(cuerpo.meta.limit, 100);
});

test('promover a staff invalida la sesion emitida como hermano', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const hermano = await crearUsuarioPrueba(Role.USER);
  const admin = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const cookie = cookieSesionDe(await entrar(hermano.email, 'hermanos'))!.split(';')[0];

    // Antes de promover, la sesion sirve
    const antes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(antes.status, 200);

    await AdminService.promoteToStaff(hermano.id, Role.SECRETARIA, admin.id);

    // Despues ya no: su cookie era la persistente de 4 h de USER, y con permisos
    // de CMS tiene que recibir la de staff, que muere al cerrar el navegador.
    const despues = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(despues.status, 401);
  } finally {
    await borrarUsuarioPrueba(hermano.id);
    await borrarUsuarioPrueba(admin.id);
  }
});

// El listado de paginas del CMS tiene que declararse ANTES de '/:slug' o queda
// ensombrecido. Distinguir los tres estados importa: 200 seria estar abierta,
// 404 seria estar rota por el orden, y solo 401 es correcto.
test('el listado de paginas del CMS exige sesion y no queda ensombrecido por /:slug', async () => {
  const res = await fetch(`${baseUrl}/api/pages/list-all`);
  assert.equal(res.status, 401, `esperado 401; un 404 significa que /:slug la captura, un 200 que esta abierta`);
});

// El restablecimiento usaba un validador propio, definido en linea en el router,
// que solo miraba la longitud: la politica de contrasenas debiles no se aplicaba
// justo en el flujo donde la gente elige lo primero que se le ocurre.
// Con un token falso, la respuesta distingue los dos casos: si el mensaje habla
// del enlace, la contrasena ya paso la validacion.
test('el restablecimiento rechaza contrasenas debiles antes de mirar el token', async () => {
  const token = 'a'.repeat(64);

  for (const debil of ['12345678', 'aaaaaaaaaaaa', 'password1234']) {
    const res = await fetch(`${baseUrl}/api/auth/reset-password/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: debil }),
    });
    const cuerpo = await res.text();

    assert.equal(res.status, 400, `"${debil}" deberia rechazarse`);
    assert.ok(
      !cuerpo.includes('enlace de recuperación'),
      `"${debil}" llego a comprobar el token, o sea que paso la validacion de contrasena`
    );
  }
});

test('el censo respeta la página y el tamaño pedidos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const admin = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const token = generateToken(admin.id, Role.ADMIN);
    const cabeceras = { Cookie: `${COOKIE_SESION}=${token}` };

    const primera = await fetch(`${baseUrl}/api/hermanos/admin/search?page=1&limit=10`, { headers: cabeceras });
    assert.equal(primera.status, 200);
    const uno = await primera.json() as { data: { id: number }[]; meta: Record<string, number> };

    // Con 10 hermanos o menos en el censo, la página 2 estaría vacía y las
    // comprobaciones de abajo pasarían sin comprobar nada: se omite con el
    // motivo a la vista en vez de dar un verde vacío.
    if (uno.meta.total <= 10) {
      return t.skip(`el censo de prueba solo tiene ${uno.meta.total} hermano(s); hacen falta más de 10 para comprobar la página 2`);
    }

    const segunda = await fetch(`${baseUrl}/api/hermanos/admin/search?page=2&limit=10`, { headers: cabeceras });
    const dos = await segunda.json() as { data: { id: number }[] };

    assert.deepEqual(Object.keys(uno.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
    assert.equal(uno.meta.limit, 10);
    assert.equal(uno.data.length, 10, 'con más de 10 hermanos, la primera página debe traer los 10 que pidió');
    assert.ok(dos.data.length >= 1, 'la segunda página debe traer al menos un hermano');
    // La segunda página trae hermanos distintos: si el skip no se aplica, esto falla.
    const idsPrimera = new Set(uno.data.map((h) => h.id));
    assert.ok(dos.data.every((h) => !idsPrimera.has(h.id)));
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

test('el censo recorta un tamaño desmedido al tope', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const admin = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const token = generateToken(admin.id, Role.ADMIN);
    const respuesta = await fetch(`${baseUrl}/api/hermanos/admin/search?limit=999999`, { headers: { Cookie: `${COOKIE_SESION}=${token}` } });
    const cuerpo = await respuesta.json() as { meta: { limit: number } };
    assert.equal(cuerpo.meta.limit, 100);
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

// El seed de demostración siembra cinco solicitudes pendientes: con tamaño 2
// hay margen para comprobar dos páginas de verdad, no una lista vacía.
test('las solicitudes de alta respetan la página y el tamaño pedidos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const admin = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const token = generateToken(admin.id, Role.ADMIN);
    const cabeceras = { Cookie: `${COOKIE_SESION}=${token}` };

    const primera = await fetch(`${baseUrl}/api/hermanos/admin/solicitudes?page=1&limit=2`, { headers: cabeceras });
    assert.equal(primera.status, 200);
    const uno = await primera.json() as { data: { id: number }[]; meta: Record<string, number> };

    // Con menos de tres solicitudes pendientes la página 2 no aportaría nada
    // distinto que comprobar: se omite con el motivo a la vista.
    if (uno.meta.total < 3) {
      return t.skip(`solo hay ${uno.meta.total} solicitud(es) pendiente(s); hacen falta al menos 3 para comprobar dos páginas de tamaño 2 (ejecuta el seed de demostración)`);
    }

    const segunda = await fetch(`${baseUrl}/api/hermanos/admin/solicitudes?page=2&limit=2`, { headers: cabeceras });
    const dos = await segunda.json() as { data: { id: number }[] };

    assert.deepEqual(Object.keys(uno.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
    assert.equal(uno.meta.limit, 2);
    assert.equal(uno.data.length, 2, 'con al menos 3 solicitudes, la primera página debe traer las 2 que pidió');
    assert.ok(dos.data.length >= 1, 'la segunda página debe traer al menos una solicitud');
    // La segunda página trae solicitudes distintas: si el skip no se aplica, esto falla.
    const idsPrimera = new Set(uno.data.map((s) => s.id));
    assert.ok(dos.data.every((s) => !idsPrimera.has(s.id)));
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

// El inventario es la única pantalla con dos listados independientes, así que
// la guarda va por duplicado: hay dos esquemas que pueden perder la paginación.
//
// Ojo con la mutación que hay que vigilar: borrar entero el bloque `query` de
// queryEnserSchema NO rompe nada, porque `validate` solo pisa req.query cuando
// el esquema declara ese bloque y la consulta cruda sobrevive. La que sí rompe
// es declararlo incompleto: añadir un filtro nuevo y olvidarse de
// `...paginacionQuery`. Entonces page y limit se borran en silencio, `meta`
// sigue trayendo sus cuatro claves, `page` vale 1 y todas las páginas sirven la
// primera. Comprobar solo la forma de `meta` no lo detectaría; esto sí.
test('los enseres respetan la página y el tamaño pedidos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const hermano = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const cabeceras = { Cookie: `${COOKIE_SESION}=${generateToken(hermano.id, Role.ADMIN)}` };

    const primera = await fetch(`${baseUrl}/api/inventario/enseres?page=1&limit=2`, { headers: cabeceras });
    assert.equal(primera.status, 200);
    const uno = await primera.json() as { data: { id: number }[]; meta: Record<string, number> };

    assert.ok(Array.isArray(uno.data), 'el CMS lee data: sin ella la pestaña de enseres se queda en blanco');
    assert.deepEqual(Object.keys(uno.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
    assert.equal(uno.meta.limit, 2, 'el tamaño pedido no llegó al servicio: ¿falta ...paginacionQuery en queryEnserSchema?');
    assert.equal(uno.meta.page, 1);

    // Con menos de tres enseres la página 2 estaría vacía y lo de abajo pasaría
    // sin comprobar nada: se omite con el motivo a la vista.
    if (uno.meta.total < 3) {
      return t.skip(`solo hay ${uno.meta.total} enser(es); hacen falta al menos 3 para comprobar dos páginas de tamaño 2 (ejecuta el seed de contenido)`);
    }

    const segunda = await fetch(`${baseUrl}/api/inventario/enseres?page=2&limit=2`, { headers: cabeceras });
    const dos = await segunda.json() as { data: { id: number }[]; meta: Record<string, number> };

    assert.equal(dos.meta.page, 2, 'la página pedida no llegó al servicio');
    assert.equal(uno.data.length, 2, 'con al menos 3 enseres, la primera página debe traer los 2 que pidió');
    assert.ok(dos.data.length >= 1, 'la segunda página debe traer al menos un enser');
    // La segunda página trae enseres distintos: si el skip no se aplica, esto falla.
    const idsPrimera = new Set(uno.data.map((e) => e.id));
    assert.ok(dos.data.every((e) => !idsPrimera.has(e.id)));
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

// El segundo listado de la misma pantalla, con su propio esquema: si el ropero
// perdiera `...paginacionQuery`, los enseres seguirían pasando de página y el
// fallo pasaría desapercibido.
test('el ropero respeta la página y el tamaño pedidos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const hermano = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const cabeceras = { Cookie: `${COOKIE_SESION}=${generateToken(hermano.id, Role.ADMIN)}` };

    const primera = await fetch(`${baseUrl}/api/inventario/prendas?page=1&limit=2`, { headers: cabeceras });
    assert.equal(primera.status, 200);
    const uno = await primera.json() as { data: { id: number }[]; meta: Record<string, number> };

    assert.ok(Array.isArray(uno.data), 'el CMS lee data: sin ella la pestaña del ropero se queda en blanco');
    assert.deepEqual(Object.keys(uno.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
    assert.equal(uno.meta.limit, 2, 'el tamaño pedido no llegó al servicio: ¿falta ...paginacionQuery en queryPrendaSchema?');
    assert.equal(uno.meta.page, 1);

    if (uno.meta.total < 3) {
      return t.skip(`solo hay ${uno.meta.total} prenda(s) en el ropero; hacen falta al menos 3 para comprobar dos páginas de tamaño 2 (ejecuta el seed de contenido)`);
    }

    const segunda = await fetch(`${baseUrl}/api/inventario/prendas?page=2&limit=2`, { headers: cabeceras });
    const dos = await segunda.json() as { data: { id: number }[]; meta: Record<string, number> };

    assert.equal(dos.meta.page, 2, 'la página pedida no llegó al servicio');
    assert.equal(uno.data.length, 2, 'con al menos 3 prendas, la primera página debe traer las 2 que pidió');
    assert.ok(dos.data.length >= 1, 'la segunda página debe traer al menos una prenda');
    // La segunda página trae prendas distintas: si el skip no se aplica, esto falla.
    const idsPrimera = new Set(uno.data.map((p) => p.id));
    assert.ok(dos.data.every((p) => !idsPrimera.has(p.id)));
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

// La ficha suelta de una prenda: el CMS la necesita para editar una que está
// fuera de la página cargada. Antes se buscaba con un .find() en el listado.
test('el ropero publica la ficha de una prenda por su id', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const hermano = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const cabeceras = { Cookie: `${COOKIE_SESION}=${generateToken(hermano.id, Role.ADMIN)}` };

    const listado = await fetch(`${baseUrl}/api/inventario/prendas?limit=1`, { headers: cabeceras });
    const cuerpo = await listado.json() as { data: { id: number; numero: string }[] };
    if (cuerpo.data.length === 0) return t.skip('el ropero está vacío (ejecuta el seed de contenido)');

    const esperada = cuerpo.data[0];
    const ficha = await fetch(`${baseUrl}/api/inventario/prendas/${esperada.id}`, { headers: cabeceras });

    assert.equal(ficha.status, 200, 'la ruta /prendas/:id debe ir después de /prendas y antes de las de acción');
    const prenda = await ficha.json() as { id: number; numero: string };
    assert.equal(prenda.id, esperada.id);
    assert.equal(prenda.numero, esperada.numero);
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

// ============================================================================
//  EL ÁREA DEL HERMANO: sus recibos, sus fichas y su histórico de papeletas
// ============================================================================
//
// Los tres extremos son privados y sirven SOLO lo del usuario de la sesión, así
// que un usuario recién creado no tiene nada y las dos páginas saldrían vacías:
// la guarda pasaría en verde sin comprobar nada. Por eso se siembra una familia
// de tres fichas, con su recibo y su papeleta cada una, más una cuota suelta
// para la titular: así los tres listados tienen totales que no se confunden
// entre sí (4 recibos, 3 fichas, 3 papeletas).
//
// Ojo con la mutación que hay que vigilar: /mis-recibos y /mis-papeletas ya
// declaran esquema de consulta (solo `...paginacionQuery`, para que un
// parámetro repetido sea un 400). Borrar un bloque `query` NO rompe la
// paginación —`validate` solo pisa `req.query` cuando el esquema declara ese
// bloque—. La que sí rompe es declararlo incompleto: el día
// que alguien valide `?year=` en /mis-papeletas y olvide `...paginacionQuery`,
// page y limit se borrarán en silencio, `meta` seguirá trayendo sus cuatro
// claves, `page` valdrá 1 y todas las páginas servirán la primera. Comprobar
// solo la forma de `meta` no lo detectaría; afirmar `meta.limit` y que las dos
// páginas traen elementos distintos, sí.

/**
 * Tres fichas, CUATRO recibos y tres papeletas colgando del usuario indicado.
 *
 * El recibo de más va a propósito: hace que el total de /mis-recibos (4) no
 * coincida con el de fichas (3), de modo que la guarda distinga de verdad la
 * unidad paginada. Si alguien volviera a paginar por miembro, el total bajaría
 * a 3 y el test lo diría.
 *
 * Si algo falla a mitad, recoge lo ya creado antes de relanzar: esto corre
 * contra la base de datos de desarrollo y no puede dejar basura suelta.
 */
async function sembrarFamiliaPrueba(userId: number): Promise<number[]> {
  const fichas: number[] = [];

  try {
    for (const [indice, nombre] of ['Ana', 'Bruno', 'Carla'].entries()) {
      const ficha = await db.hermano.create({
        data: {
          userId,
          nombre,
          apellidos: 'Prueba Paginacion',
          fechaNacimiento: new Date(Date.UTC(2000 + indice, 0, 1)),
          esTitular: indice === 0,
          activo: true
        }
      });
      // Antes de crear nada colgando de la ficha, para que el recogedor la
      // encuentre aunque lo siguiente reviente.
      fichas.push(ficha.id);

      const recibo = await db.recibo.create({
        data: {
          hermanoId: ficha.id,
          year: 2024 + indice,
          concepto: `Papeleta de prueba ${indice + 1}`,
          importe: 30
        }
      });

      await db.papeletaSitio.create({
        data: { hermanoId: ficha.id, reciboId: recibo.id, year: 2024 + indice, puesto: 'Cirio' }
      });

      // La titular lleva además su cuota anual, sin papeleta.
      if (indice === 0) {
        await db.recibo.create({
          data: {
            hermanoId: ficha.id,
            year: 2024,
            concepto: 'Cuota anual de prueba',
            importe: 25
          }
        });
      }
    }

    return fichas;
  } catch (e) {
    await recogerFamiliaPrueba(fichas);
    throw e;
  }
}

/** En orden inverso al de las claves ajenas: papeleta, recibo y ficha. */
async function recogerFamiliaPrueba(fichas: number[]) {
  await db.papeletaSitio.deleteMany({ where: { hermanoId: { in: fichas } } });
  await db.recibo.deleteMany({ where: { hermanoId: { in: fichas } } });
  await db.hermano.deleteMany({ where: { id: { in: fichas } } });
}

test('mis recibos respetan la página y el tamaño pedidos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const usuario = await crearUsuarioPrueba(Role.USER);
  let fichas: number[] = [];

  try {
    fichas = await sembrarFamiliaPrueba(usuario.id);
    const cabeceras = { Cookie: `${COOKIE_SESION}=${generateToken(usuario.id, Role.USER)}` };

    const primera = await fetch(`${baseUrl}/api/recibos/mis-recibos?page=1&limit=2`, { headers: cabeceras });
    assert.equal(primera.status, 200);
    const uno = await primera.json() as { data: { id: number; hermano?: { nombre?: string } }[]; meta: Record<string, number> };

    assert.ok(Array.isArray(uno.data), 'la pantalla de recibos lee data: sin ella se queda en blanco');
    assert.deepEqual(Object.keys(uno.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
    assert.equal(uno.meta.limit, 2, 'el tamaño pedido no llegó al servicio: ¿alguien validó la consulta sin ...paginacionQuery?');
    assert.equal(uno.meta.page, 1);
    // La unidad paginada es el RECIBO, no el miembro de la familia: la siembra
    // deja tres fichas y CUATRO recibos, así que un total de 3 delataría que se
    // ha vuelto a paginar por miembro —y entonces el tamaño de página no acota
    // las filas que ve el hermano, que es justo lo que este plan viene a cerrar.
    assert.equal(uno.meta.total, 4, 'deben contarse los cuatro recibos sembrados, no las tres fichas');
    assert.equal(uno.meta.totalPages, 2);
    assert.equal(uno.data.length, 2, 'la primera página debe traer los 2 recibos que pidió');
    // Cada recibo viaja plano y con su hermano dentro: la pantalla pinta una fila por recibo.
    assert.ok(uno.data.every((r) => typeof r.hermano?.nombre === 'string'), 'cada recibo debe decir de quién es');

    const segunda = await fetch(`${baseUrl}/api/recibos/mis-recibos?page=2&limit=2`, { headers: cabeceras });
    const dos = await segunda.json() as { data: { id: number }[]; meta: Record<string, number> };

    assert.equal(dos.meta.page, 2, 'la página pedida no llegó al servicio');
    assert.equal(dos.data.length, 2, 'la segunda página debe traer los 2 recibos que faltaban');
    // La segunda página trae recibos distintos: si el skip no se aplica, esto falla.
    const idsPrimera = new Set(uno.data.map((r) => r.id));
    assert.ok(dos.data.every((r) => !idsPrimera.has(r.id)));
  } finally {
    await recogerFamiliaPrueba(fichas);
    await borrarUsuarioPrueba(usuario.id);
  }
});

test('mis perfiles respetan la página y el tamaño pedidos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const usuario = await crearUsuarioPrueba(Role.USER);
  let fichas: number[] = [];

  try {
    fichas = await sembrarFamiliaPrueba(usuario.id);
    const cabeceras = { Cookie: `${COOKIE_SESION}=${generateToken(usuario.id, Role.USER)}` };

    const primera = await fetch(`${baseUrl}/api/hermanos/mis-perfiles?page=1&limit=2`, { headers: cabeceras });
    assert.equal(primera.status, 200);
    const uno = await primera.json() as { data: { id: number }[]; meta: Record<string, number> };

    assert.ok(Array.isArray(uno.data), 'las pantallas de perfil leen data: sin ella no hay ficha que mostrar');
    assert.deepEqual(Object.keys(uno.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
    assert.equal(uno.meta.limit, 2, 'el tamaño pedido no llegó al servicio: ¿alguien validó la consulta sin ...paginacionQuery?');
    assert.equal(uno.meta.page, 1);
    assert.equal(uno.meta.total, 3, 'las tres fichas sembradas deben contarse en el total');
    assert.equal(uno.data.length, 2, 'la primera página debe traer las 2 fichas que pidió');

    const segunda = await fetch(`${baseUrl}/api/hermanos/mis-perfiles?page=2&limit=2`, { headers: cabeceras });
    const dos = await segunda.json() as { data: { id: number }[]; meta: Record<string, number> };

    assert.equal(dos.meta.page, 2, 'la página pedida no llegó al servicio');
    assert.equal(dos.data.length, 1, 'la segunda página debe traer la ficha que faltaba');
    // La segunda página trae fichas distintas: si el skip no se aplica, esto falla.
    const idsPrimera = new Set(uno.data.map((h) => h.id));
    assert.ok(dos.data.every((h) => !idsPrimera.has(h.id)));
  } finally {
    await recogerFamiliaPrueba(fichas);
    await borrarUsuarioPrueba(usuario.id);
  }
});

// El selector de ficha de las pantallas de perfil pide la familia entera de una
// vez (limit=50, la constante FICHAS_POR_FAMILIA del cliente). Aquí se comprueba
// el otro extremo del trato: que el servidor atienda ese tamaño sin recortarlo,
// o el hermano con varias fichas dejaría de verlas todas.
test('mis perfiles caben enteros en la página que pide el selector', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const usuario = await crearUsuarioPrueba(Role.USER);
  let fichas: number[] = [];

  try {
    fichas = await sembrarFamiliaPrueba(usuario.id);
    const cabeceras = { Cookie: `${COOKIE_SESION}=${generateToken(usuario.id, Role.USER)}` };
    const respuesta = await fetch(`${baseUrl}/api/hermanos/mis-perfiles?page=1&limit=50`, { headers: cabeceras });
    const cuerpo = await respuesta.json() as { data: { id: number }[]; meta: Record<string, number> };

    assert.equal(cuerpo.meta.limit, 50);
    assert.equal(cuerpo.meta.totalPages, 1, 'la familia entera debe caber en una sola página');
    assert.equal(cuerpo.data.length, 3, 'el selector debe recibir las tres fichas, no solo las de una página corta');
  } finally {
    await recogerFamiliaPrueba(fichas);
    await borrarUsuarioPrueba(usuario.id);
  }
});

test('mi histórico de papeletas respeta la página y el tamaño pedidos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const usuario = await crearUsuarioPrueba(Role.USER);
  let fichas: number[] = [];

  try {
    fichas = await sembrarFamiliaPrueba(usuario.id);
    const cabeceras = { Cookie: `${COOKIE_SESION}=${generateToken(usuario.id, Role.USER)}` };

    const primera = await fetch(`${baseUrl}/api/procesion/mis-papeletas?page=1&limit=2`, { headers: cabeceras });
    assert.equal(primera.status, 200);
    const uno = await primera.json() as { data: { id: number }[]; meta: Record<string, number> };

    assert.ok(Array.isArray(uno.data), 'el histórico lee data: sin ella se queda en blanco');
    assert.deepEqual(Object.keys(uno.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
    assert.equal(uno.meta.limit, 2, 'el tamaño pedido no llegó al servicio: ¿alguien validó la consulta sin ...paginacionQuery?');
    assert.equal(uno.meta.page, 1);
    assert.equal(uno.meta.total, 3, 'las tres papeletas sembradas deben contarse en el total');
    assert.equal(uno.data.length, 2, 'la primera página debe traer las 2 papeletas que pidió');

    const segunda = await fetch(`${baseUrl}/api/procesion/mis-papeletas?page=2&limit=2`, { headers: cabeceras });
    const dos = await segunda.json() as { data: { id: number }[]; meta: Record<string, number> };

    assert.equal(dos.meta.page, 2, 'la página pedida no llegó al servicio');
    assert.equal(dos.data.length, 1, 'la segunda página debe traer la papeleta que faltaba');
    // La segunda página trae papeletas distintas: si el skip no se aplica, esto falla.
    const idsPrimera = new Set(uno.data.map((p) => p.id));
    assert.ok(dos.data.every((p) => !idsPrimera.has(p.id)));
  } finally {
    await recogerFamiliaPrueba(fichas);
    await borrarUsuarioPrueba(usuario.id);
  }
});

// ==========================================
//  DESEMPATE EN EL LIBRO MAYOR
// ==========================================
/**
 * Siembra apuntes con EXACTAMENTE la misma `fecha`, que es el caso real:
 * `prisma/demo/generar.ts` construye la fecha de cada movimiento con
 * `inicioDelDia(...)`, así que todos los de un mismo día la comparten al
 * milisegundo. Con empates, `ORDER BY fecha DESC` + LIMIT/OFFSET no tiene un
 * orden total y MariaDB puede devolver una fila en dos páginas y otra en
 * ninguna: justo lo que la paginación venía a evitar.
 *
 * Son DOCE y no tres a propósito. Con dos o tres empatados MariaDB resuelve el
 * `LIMIT` con una cola de prioridad diminuta y el orden coincide por casualidad
 * entre las dos consultas: el test pasaría igual sin el desempate y no guardaría
 * nada. A partir de una docena cambia de estrategia entre la página 1 y la 2 y
 * el fallo aflora: sin `{ id: 'asc' }` en el orderBy, dos filas salen repetidas
 * y otras dos no salen en ninguna página.
 *
 * La fecha va en el futuro a propósito, para que los doce queden en cabeza del
 * orden descendente y caigan en las dos primeras páginas sea cual sea el
 * volumen del libro. Son filas desechables: el `finally` las recoge.
 *
 * Si algo falla a mitad, recoge lo ya creado antes de relanzar: esto corre
 * contra la base de datos de desarrollo y no puede dejar basura suelta.
 */
const FECHA_EMPATE = new Date(Date.UTC(2099, 11, 31, 12, 0, 0));
const APUNTES_EMPATADOS = 12;

async function sembrarApuntesEmpatados(): Promise<{ categoriaId: number; apuntes: number[] }> {
  const categoria = await db.categoriaTransaccion.create({
    data: { nombre: `Prueba desempate ${Date.now()}`, tipo: 'INGRESO' }
  });
  const apuntes: number[] = [];

  try {
    for (let i = 1; i <= APUNTES_EMPATADOS; i++) {
      const apunte = await db.transaccion.create({
        data: { tipo: 'INGRESO', categoriaId: categoria.id, concepto: `Empate ${i}`, importe: 10, fecha: FECHA_EMPATE }
      });
      apuntes.push(apunte.id);
    }
    return { categoriaId: categoria.id, apuntes };
  } catch (e) {
    await recogerApuntesEmpatados(categoria.id, apuntes);
    throw e;
  }
}

/** En orden inverso al de las claves ajenas: apuntes y después la categoría. */
async function recogerApuntesEmpatados(categoriaId: number | null, apuntes: number[]) {
  if (apuntes.length > 0) await db.transaccion.deleteMany({ where: { id: { in: apuntes } } });
  if (categoriaId !== null) await db.categoriaTransaccion.deleteMany({ where: { id: categoriaId } });
}

test('el libro mayor no repite ni pierde apuntes con la misma fecha al pasar de página', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  let categoriaId: number | null = null;
  let apuntes: number[] = [];

  try {
    const sembrado = await sembrarApuntesEmpatados();
    categoriaId = sembrado.categoriaId;
    apuntes = sembrado.apuntes;
    const cabeceras = { Cookie: `${COOKIE_SESION}=${generateToken(tesorero.id, Role.TESORERIA)}` };

    // Tamaño 10, uno de los cinco que ofrece el selector: los doce empatados no
    // caben en una página y el corte cae justo dentro del empate.
    const primera = await fetch(`${baseUrl}/api/transacciones/libro-mayor?page=1&limit=10`, { headers: cabeceras });
    assert.equal(primera.status, 200);
    const uno = await primera.json() as { data: { id: number }[]; meta: Record<string, number> };
    assert.equal(uno.meta.limit, 10, 'el tamaño pedido no llegó al servicio');
    assert.equal(uno.meta.page, 1);

    const segunda = await fetch(`${baseUrl}/api/transacciones/libro-mayor?page=2&limit=10`, { headers: cabeceras });
    assert.equal(segunda.status, 200);
    const dos = await segunda.json() as { data: { id: number }[]; meta: Record<string, number> };
    assert.equal(dos.meta.page, 2, 'la página pedida no llegó al servicio');

    // Ninguna fila puede salir en las dos páginas.
    const idsPrimera = new Set(uno.data.map((m) => m.id));
    const repetidos = dos.data.filter((m) => idsPrimera.has(m.id)).map((m) => m.id);
    assert.deepEqual(repetidos, [], `estas filas salen en las dos páginas: ${repetidos.join(', ')}`);

    // Y ninguno de los doce empatados puede desaparecer: son los más recientes
    // del libro, así que las dos primeras páginas (veinte filas) los cubren.
    const vistos = new Set([...uno.data, ...dos.data].map((m) => m.id));
    const perdidos = apuntes.filter((id) => !vistos.has(id));
    assert.deepEqual(
      perdidos, [],
      `estos apuntes empatados no salen en ninguna de las dos páginas: ${perdidos.join(', ')}. Falta el desempate por id en el orderBy del libro mayor.`
    );
  } finally {
    await recogerApuntesEmpatados(categoriaId, apuntes);
    await borrarUsuarioPrueba(tesorero.id);
  }
});

// ---------------------------------------------------------------------------
// ORIGEN DE SESIÓN: el 2FA se exige al entrar por el CMS, no por el área de
// hermanos. Sin estos tests, la única comprobación del origen vivía en la
// guarda de rutas del frontend, que es código del navegador y no protege la API.
// ---------------------------------------------------------------------------

async function conSegundoFactor(id: number) {
  await db.user.update({
    where: { id },
    data: { twoFactorEnabled: true, twoFactorSecret: 'JBSWY3DPEHPK3PXP' }
  });
}

test('con 2FA activo, entrar por el área de hermanos no pide el segundo factor', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);

    const res = await entrar(staff.email, 'hermanos');
    const cuerpo = await res.json() as { status?: string };

    assert.notEqual(cuerpo.status, '2FA_NEEDED', 'el área de hermanos no debe pedir el segundo factor');
    assert.ok(cookieSesionDe(res), 'debería emitir la sesión en el primer paso');
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('con 2FA activo, entrar por el CMS sí pide el segundo factor', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);

    const res = await entrar(staff.email, 'cms');
    const cuerpo = await res.json() as { status?: string };

    assert.equal(cuerpo.status, '2FA_NEEDED');
    assert.ok(!cookieSesionDe(res), 'no debe haber sesión hasta pasar el segundo factor');
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('una sesión abierta en el área de hermanos no vale para el CMS', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  // El caso que hace falta cerrar: un ADMIN con 2FA entra por /hermanos/acceso,
  // donde solo se le pide la contraseña, y usa esa cookie contra la API del CMS.
  // Si el servidor la acepta, el segundo factor del CMS es evitable sin navegador.
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  try {
    await conSegundoFactor(admin.id);

    const cookie = cookieSesionDe(await entrar(admin.email, 'hermanos'))!.split(';')[0];
    const res = await fetch(`${baseUrl}/api/news/admin/archive`, { headers: { Cookie: cookie } });

    assert.equal(res.status, 403, 'una sesión de origen hermanos no debe entrar en el CMS');
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});
