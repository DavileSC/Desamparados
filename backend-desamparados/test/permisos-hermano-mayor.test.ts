// test/permisos-hermano-mayor.test.ts
// El Hermano Mayor pasa a ver y editar todo salvo la administración del
// sistema. Se sondea el servidor real, con el patrón de Task 9
// (test/panel-acceso.test.ts): authenticateToken revalida la sesión contra
// la base de datos (cierre del hallazgo 02, ver session.ts), así que todos
// los casos salvo el de «sin sesión» necesitan usuarios reales y se omiten
// con motivo si no hay MariaDB levantada — el CI no la levanta.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import app from '../src/app.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_SESION } from '../src/utils/cookies.js';
import db from '../src/config/db.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { Role } from '@prisma/client';

let server: Server;
let baseUrl: string;
const usuariosTestId: number[] = [];
const roleToUserId: Record<string, number> = {};

let dbDisponible = false;
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let motivoSinDb = '';

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
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  dbDisponible = await sondearDb();
  if (!dbDisponible) {
    console.log(`
ℹ  Sin conexión a la base de datos: se omiten los tests que la necesitan.`);
    console.log(`   Motivo: ${motivoSinDb}`);
    console.log(`   El test «sin sesión responde 401» sigue ejecutándose (no necesita BD).
`);
    return;
  }

  // Usuarios reales y desechables para los roles que sondean estas pruebas.
  for (const rol of [Role.HERMANO_MAYOR, Role.REDES, Role.USER, Role.SECRETARIA]) {
    const usuario = await crearUsuarioPrueba(rol);
    usuariosTestId.push(usuario.id);
    roleToUserId[rol] = usuario.id;
  }
});

after(async () => {
  server.close();
  for (const id of usuariosTestId) {
    await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

const como = (rol: string, ruta: string, init: RequestInit = {}) =>
  fetch(`${baseUrl}${ruta}`, {
    ...init,
    headers: { Cookie: `${COOKIE_SESION}=${generateToken(roleToUserId[rol]!, rol)}`, ...(init.headers ?? {}) },
  });

describe('permisos del Hermano Mayor', () => {
  test('sin sesión, /api/admin/audit-logs responde 401', async () => {
    // No toca la base: authenticateToken corta antes de consultarla. Corre
    // siempre, aunque el resto se omita sin BD, para no dejar el fichero
    // vacío en CI y garantizar que la ruta no queda abierta al público.
    const res = await fetch(`${baseUrl}/api/admin/audit-logs`);
    assert.equal(res.status, 401);
  });

  test('entra en tesorería', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/recibos/admin');
    // 404 también tendría que hacer fallar esto: si la ruta desaparece, quiero enterarme.
    assert.ok(res.status !== 401 && res.status !== 403 && res.status !== 404, `recibió ${res.status}`);
  });

  test('entra en contabilidad', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // /api/transacciones (la raíz del router) no tiene GET propio y da 404
    // pase lo que pase con el rol; /balance sí existe (transaccion.routes.ts:23).
    const res = await como('HERMANO_MAYOR', '/api/transacciones/balance');
    assert.ok(res.status !== 401 && res.status !== 403 && res.status !== 404, `recibió ${res.status}`);
  });

  test('lee el registro de auditoría', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/admin/audit-logs');
    assert.ok(res.status !== 401 && res.status !== 403 && res.status !== 404, `recibió ${res.status}`);
  });

  // El suelo de seguridad de admin.routes.ts (checkRole([ADMIN, HERMANO_MAYOR])
  // tras authenticateToken) no tenía test negativo propio: es lo único que
  // protege /api/admin de cualquier otro rol, incluida una ruta que se añada
  // mañana y se olvide de declarar su checkRole estrecho.
  test('un rol fuera del suelo de /api/admin recibe 403', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('SECRETARIA', '/api/admin/audit-logs');
    assert.equal(res.status, 403);
  });

  // Noticias y Publicaciones son contenido, no administración del sistema:
  // quedaban fuera por una omisión al redactar el spec (ver news.routes.ts
  // y publication.routes.ts, rolesCMS / roles).
  test('entra en el archivo de gestión de noticias', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/news/admin/archive');
    assert.ok(res.status !== 401 && res.status !== 403 && res.status !== 404, `recibió ${res.status}`);
  });

  test('entra en el listado de gestión de publicaciones', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/publications/admin');
    assert.ok(res.status !== 401 && res.status !== 403 && res.status !== 404, `recibió ${res.status}`);
  });

  // Admitir hermanos nuevos es censo, no administración del sistema: que el
  // Hermano Mayor viera el censo entero y no pudiera aprobar un alta se quedaba
  // descolgado.
  test('el Hermano Mayor puede ver las solicitudes de alta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/hermanos/admin/solicitudes');
    assert.ok(res.status !== 401 && res.status !== 403 && res.status !== 404, `recibió ${res.status}`);
  });

  test('un community manager sigue sin poder ver las solicitudes', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('REDES', '/api/hermanos/admin/solicitudes');
    assert.equal(res.status, 403);
  });

  test('un hermano raso sigue sin poder ver las solicitudes', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('USER', '/api/hermanos/admin/solicitudes');
    assert.equal(res.status, 403);
  });

  test('NO puede promover cargos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/admin/staff/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 2, role: 'ADMIN' }),
    });
    assert.equal(res.status, 403);
  });

  test('NO puede cambiar la configuración global', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'precio', value: '30' }),
    });
    assert.equal(res.status, 403);
  });

  test('el community manager sigue sin entrar en tesorería', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('REDES', '/api/transacciones');
    assert.equal(res.status, 403);
  });

  // --- Cobertura del reparto: el checkRole global de /api/admin se repartió
  // en siete rutas; el resto siguen siendo exclusivas de ADMIN aunque el
  // Hermano Mayor ya tenga hueco en el router (por el suelo de seguridad). ---
  test('NO puede ver el listado de cargos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/admin/staff');
    assert.equal(res.status, 403);
  });

  test('NO puede buscar usuarios', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/admin/users/search');
    assert.equal(res.status, 403);
  });

  test('NO puede degradar cargos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/admin/staff/demote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 2 }),
    });
    assert.equal(res.status, 403);
  });

  test('NO puede leer la configuración global', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('HERMANO_MAYOR', '/api/admin/config');
    assert.equal(res.status, 403);
  });

  test('abrir tesorería al Hermano Mayor no la abre a un hermano raso', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como('USER', '/api/recibos/admin');
    assert.equal(res.status, 403);
  });
});
