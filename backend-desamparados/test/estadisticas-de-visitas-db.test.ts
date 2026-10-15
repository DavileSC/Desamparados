// El informe de GoAccess en el CMS: quién lo ve y cómo se sirve. El informe
// lo escribe el servidor (docker/servidor/estadisticas.sh); aquí se deja uno
// de mentira en su sitio y se quita al acabar.
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { RUTA_DEL_INFORME } from '../src/services/estadisticas-de-visitas.service.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { borrarUsuarioPrueba, crearUsuarioPrueba } from './fixtures/usuarios.js';
import { encenderModulos } from './fixtures/modulos.js';
import { SIN_DB } from './fixtures/sin-db.js';

let server: Server;
let baseUrl: string;
let dbDisponible = false;
let restaurarModulos: (() => Promise<void>) | null = null;
// Si en este PC ya había un informe de verdad, se guarda y se devuelve.
let informeDeAntes: Buffer | null = null;
const usuarios: Partial<Record<Role, number>> = {};

before(async () => {
  try { await db.$queryRaw`SELECT 1`; dbDisponible = true; } catch { dbDisponible = false; }
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (!dbDisponible) return;
  restaurarModulos = await encenderModulos(['estadisticas-de-visitas']);
  for (const rol of [Role.ADMIN, Role.HERMANO_MAYOR, Role.SECRETARIA]) usuarios[rol] = (await crearUsuarioPrueba(rol)).id;
  informeDeAntes = await readFile(RUTA_DEL_INFORME).catch(() => null);
});

after(async () => {
  if (dbDisponible) {
    if (informeDeAntes) await writeFile(RUTA_DEL_INFORME, informeDeAntes);
    else await rm(RUTA_DEL_INFORME, { force: true });
    for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
    await restaurarModulos?.();
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
});

const pedir = (ruta: string, rol?: Role) => fetch(`${baseUrl}/api/estadisticas-de-visitas${ruta}`, {
  headers: rol ? { Cookie: `${COOKIE_CMS}=${generateToken(usuarios[rol]!, rol)}` } : {},
});

test('sin sesión, 401', async () => {
  assert.equal((await pedir('')).status, 401);
  assert.equal((await pedir('/informe')).status, 401);
});

test('solo Administración y el Hermano Mayor', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  assert.equal((await pedir('', Role.SECRETARIA)).status, 403);
  assert.equal((await pedir('/informe', Role.SECRETARIA)).status, 403);
  assert.equal((await pedir('', Role.ADMIN)).status, 200);
  assert.equal((await pedir('', Role.HERMANO_MAYOR)).status, 200);
});

test('sin informe, lo dice y no da 500', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await rm(RUTA_DEL_INFORME, { force: true });
  assert.deepEqual(await (await pedir('', Role.ADMIN)).json(), { hay: false, actualizado: null });
  assert.equal((await pedir('/informe', Role.ADMIN)).status, 404);
});

test('el informe se sirve aislado: sin origen propio, sin llamar a nada y enmarcable solo desde el CMS', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await mkdir(path.dirname(RUTA_DEL_INFORME), { recursive: true });
  await writeFile(RUTA_DEL_INFORME, '<!doctype html><title>Informe</title><p>visitas</p>');

  const estado = await (await pedir('', Role.HERMANO_MAYOR)).json() as { hay: boolean; actualizado: string };
  assert.equal(estado.hay, true);
  assert.ok(!Number.isNaN(Date.parse(estado.actualizado)));

  const res = await pedir('/informe', Role.HERMANO_MAYOR);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/html/);
  assert.match(await res.text(), /visitas/);
  const politica = res.headers.get('content-security-policy') ?? '';
  // Sin allow-same-origin: con él, un script colado en el informe tendría la sesión del CMS.
  assert.match(politica, /sandbox allow-scripts(;|$)/);
  assert.doesNotMatch(politica, /allow-same-origin/);
  assert.match(politica, /connect-src 'none'/);
  assert.match(politica, /frame-ancestors 'self'/);
  assert.equal(res.headers.get('x-frame-options'), null, 'el CMS lo enseña en un marco');
  assert.match(res.headers.get('cache-control') ?? '', /no-store/);
});
