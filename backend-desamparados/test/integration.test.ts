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

test('las publicaciones públicas no requieren autenticación', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const response = await fetch(`${baseUrl}/api/publications`);
  assert.equal(response.status, 200);
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

    const listado = await fetch(`${baseUrl}/api/news/admin/archive?limit=1`, { headers: cabeceras });
    const { data } = await listado.json() as { data: { id: number }[] };
    if (data.length === 0) return t.skip('no hay noticias sembradas');

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

async function entrar(email: string) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD_PRUEBA })
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
    const deHermano = cookieSesionDe(await entrar(hermano.email))!;
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
    const cuerpo = await (await entrar(hermano.email)).json() as { status?: string; token?: string; user?: { id?: number } };
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
    const cookie = cookieSesionDe(await entrar(hermano.email))!.split(';')[0];
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
    const cookie = cookieSesionDe(await entrar(hermano.email))!.split(';')[0];
    const conSesion = await fetch(`${baseUrl}/api/events`, { headers: { Cookie: cookie } });
    assert.equal(conSesion.status, 200, 'con sesion valida tambien deberia pasar');
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('promover a staff invalida la sesion emitida como hermano', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const hermano = await crearUsuarioPrueba(Role.USER);
  const admin = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const cookie = cookieSesionDe(await entrar(hermano.email))!.split(';')[0];

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
    const res = await fetch(`${baseUrl}/api/auth/reset-password/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: debil }),
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
