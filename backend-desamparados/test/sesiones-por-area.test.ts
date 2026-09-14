// test/sesiones-por-area.test.ts
// Cada área (CMS y hermanos) tiene su propia marca de corte
// (cmsValidoDesde / hermanoValidoDesde): cerrar sesión en una no puede
// invalidar la otra, pero el corte global (tokenValidAfter) sigue matando
// las dos. Se sondea la base de datos real porque validateSessionAgainstDb
// consulta directamente el usuario; sin MariaDB levantada se omiten con
// motivo, igual que en test/permisos-hermano-mayor.test.ts.
//
// Este fichero crece en las tareas 4, 5, 6, 7, 8 y 11 (login, logout,
// checkRole, panel de acceso...): los imports van agrupados arriba para que
// ampliarlo sea barato.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { validateSessionAgainstDb } from '../src/middleware/session.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { Role } from '@prisma/client';

let dbDisponible = false;
let motivoSinDb = '';
let server: Server;
let baseUrl: string;

async function sondearDb(): Promise<boolean> {
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
  // Servidor real: los tests del middleware (tarea 4 en adelante) necesitan
  // que las cookies pasen por Express de verdad, no solo llamar a la función.
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  dbDisponible = await sondearDb();
  if (!dbDisponible) {
    console.log(`
ℹ  Sin conexión a la base de datos: se omiten los tests que la necesitan.`);
    console.log(`   Motivo: ${motivoSinDb}`);
  }
});

const creados: number[] = [];
after(async () => {
  server.close();
  for (const id of creados) await borrarUsuarioPrueba(id);
  await db.$disconnect();
});

/** Un payload de sesión como el que firma generateToken, emitido ahora mismo. */
const payloadDe = (id: number, role: string, origen: 'cms' | 'hermanos') => ({
  id, role, typ: 'session' as const, origen, emitidoMs: Date.now()
});

test('cerrar el área de hermanos no invalida la sesión del CMS', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.TESORERIA);
  creados.push(user.id);

  const cms = payloadDe(user.id, Role.TESORERIA, 'cms');
  const hermano = payloadDe(user.id, Role.TESORERIA, 'hermanos');

  // Cierra solo el área de hermanos.
  await db.user.update({ where: { id: user.id }, data: { hermanoValidoDesde: new Date(Date.now() + 1000) } });

  assert.ok(await validateSessionAgainstDb(cms, 'cms'), 'la del CMS tiene que seguir viva');
  assert.equal(await validateSessionAgainstDb(hermano, 'hermanos'), null, 'la de hermanos tiene que estar muerta');
});

test('cerrar el CMS no invalida la sesión del área de hermanos', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.SECRETARIA);
  creados.push(user.id);

  const cms = payloadDe(user.id, Role.SECRETARIA, 'cms');
  const hermano = payloadDe(user.id, Role.SECRETARIA, 'hermanos');

  await db.user.update({ where: { id: user.id }, data: { cmsValidoDesde: new Date(Date.now() + 1000) } });

  assert.equal(await validateSessionAgainstDb(cms, 'cms'), null);
  assert.ok(await validateSessionAgainstDb(hermano, 'hermanos'));
});

test('el corte global sigue matando las dos', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.ADMIN);
  creados.push(user.id);

  // Es lo que hace un cambio de contraseña o una degradación de rol: ahí sí
  // hay que echar a todo el mundo de todas partes.
  await db.user.update({ where: { id: user.id }, data: { tokenValidAfter: new Date(Date.now() + 1000) } });

  assert.equal(await validateSessionAgainstDb(payloadDe(user.id, Role.ADMIN, 'cms'), 'cms'), null);
  assert.equal(await validateSessionAgainstDb(payloadDe(user.id, Role.ADMIN, 'hermanos'), 'hermanos'), null);
});

test('un token de hermanos no vale como sesión del CMS aunque la cuenta sea de staff', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.ADMIN);
  creados.push(user.id);

  // El segundo factor solo se pide en /cms/acceso: un token nacido en el área
  // de hermanos es un token que NO ha pasado el 2FA.
  const colado = payloadDe(user.id, Role.ADMIN, 'hermanos');
  assert.equal(await validateSessionAgainstDb(colado, 'cms'), null);
});

// --- Tarea 4: el middleware sobre el servidor real, resolviendo las dos cookies ---
//
// NOTA: el brief de esta tarea usa `/api/panel/hoy` en estos tres tests, pero
// esa ruta no existe (src/routes/panel.routes.ts monta panelRoutes.get('/', ...)
// y src/app.ts lo cuelga de /api/panel). Con /hoy el servidor respondería 404 y
// los `assert.notEqual(status, 401/403)` pasarían sin comprobar nada: se usa
// /api/panel, la ruta real, protegida por authenticateToken + checkRole(staff).
//
// El tramo de /api/panel del siguiente test pasa porque la tarea 5 hizo que
// checkRole mire req.sesiones.cms en vez de req.user: con las dos cookies
// puestas, req.user por defecto es la de hermanos (así lo deja la tarea 4),
// pero checkRole la ignora en las rutas de staff y usa la del CMS.

test('con las dos cookies puestas, cada área usa la suya', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.TESORERIA);
  creados.push(user.id);

  const cms = generateToken(user.id, Role.TESORERIA, false, 'cms');
  const hermano = generateToken(user.id, Role.TESORERIA, false, 'hermanos');
  const lasDos = `${COOKIE_CMS}=${cms}; ${COOKIE_HERMANO}=${hermano}`;

  // Ruta de staff: tiene que pasar, porque la cookie del CMS está puesta.
  const panel = await fetch(`${baseUrl}/api/panel`, { headers: { cookie: lasDos } });
  assert.notEqual(panel.status, 401, 'con cookie del CMS no puede dar 401');
  assert.notEqual(panel.status, 403, 'con cookie del CMS no puede dar 403');

  // Ruta del área de hermanos: también, con la suya.
  const perfiles = await fetch(`${baseUrl}/api/hermanos/mis-perfiles`, { headers: { cookie: lasDos } });
  assert.equal(perfiles.status, 200);
});

test('sin ninguna cookie, las rutas con sesión dan 401', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const respuesta = await fetch(`${baseUrl}/api/hermanos/mis-perfiles`);
  assert.equal(respuesta.status, 401);
});

test('solo con la cookie del CMS, una ruta del área de hermanos sigue atendiendo', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  // Es su propia ficha: una sesión del CMS es más fuerte, no más débil.
  const user = await crearUsuarioPrueba(Role.SECRETARIA);
  creados.push(user.id);
  const cms = generateToken(user.id, Role.SECRETARIA, false, 'cms');
  const respuesta = await fetch(`${baseUrl}/api/hermanos/mis-perfiles`, {
    headers: { cookie: `${COOKIE_CMS}=${cms}` },
  });
  assert.equal(respuesta.status, 200);
});

// --- Tarea 5: checkRole exige la sesión del CMS, nunca cae a la de hermanos ---

test('la cookie de hermanos no abre una ruta de staff, aunque la cuenta sea ADMIN', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  // Saltarse esto es saltarse el segundo factor: solo se pide en /cms/acceso.
  const user = await crearUsuarioPrueba(Role.ADMIN);
  creados.push(user.id);
  const hermano = generateToken(user.id, Role.ADMIN, false, 'hermanos');

  const respuesta = await fetch(`${baseUrl}/api/panel`, {
    headers: { cookie: `${COOKIE_HERMANO}=${hermano}` },
  });
  assert.equal(respuesta.status, 403);
  assert.equal((await respuesta.json()).error, 'SESION_NO_CMS');
});

test('la cookie del CMS no vale si el rol no llega', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.REDES);
  creados.push(user.id);
  const cms = generateToken(user.id, Role.REDES, false, 'cms');

  // Auditoría es solo de ADMIN y HERMANO_MAYOR: aquí el 403 es de permisos,
  // no de sesión, y lleva otro código.
  const respuesta = await fetch(`${baseUrl}/api/admin/audit-logs`, {
    headers: { cookie: `${COOKIE_CMS}=${cms}` },
  });
  assert.equal(respuesta.status, 403);
  assert.notEqual((await respuesta.json()).error, 'SESION_NO_CMS');
});

// --- Tarea 6: el login pone la cookie de su área y no toca la otra ---

test('entrar como hermano no borra la cookie del CMS', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  // Es el hallazgo del usuario: estaba en el CMS, entró como hermano para ver
  // su perfil, y la administración le dijo que su sesión no tenía acceso.
  const user = await crearUsuarioPrueba(Role.TESORERIA);
  creados.push(user.id);

  const respuesta = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: PASSWORD_PRUEBA, contexto: 'hermanos' }),
  });
  assert.equal(respuesta.status, 200);

  const cookies = respuesta.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith(`${COOKIE_HERMANO}=`)), 'pone la de hermanos');
  assert.ok(!cookies.some((c) => c.startsWith(`${COOKIE_CMS}=`)), 'no toca la del CMS');
});

test('entrar en el CMS no borra la cookie del área de hermanos', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.SECRETARIA);
  creados.push(user.id);

  const respuesta = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: PASSWORD_PRUEBA, contexto: 'cms' }),
  });
  assert.equal(respuesta.status, 200);

  const cookies = respuesta.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith(`${COOKIE_CMS}=`)));
  assert.ok(!cookies.some((c) => c.startsWith(`${COOKIE_HERMANO}=`)));
});
