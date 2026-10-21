// El asistente de primer arranque contra MariaDB: sale en una base recién
// instalada y no en una web en marcha, solo Administración lo lleva y, una vez
// terminado, repasarlo no lo vuelve a sacar.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { AsistenteService } from '../src/services/asistente.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const CLAVE = 'asistente_inicial';
let server: Server;
let baseUrl: string;
let dbDisponible = false;
let filaAntes: { value: string; descripcion: string | null } | null = null;
const usuarios: Partial<Record<'ADMIN' | 'SECRETARIA', number>> = {};

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (!dbDisponible) return;
  filaAntes = await db.configuracion.findUnique({ where: { key: CLAVE }, select: { value: true, descripcion: true } });
  for (const rol of ['ADMIN', 'SECRETARIA'] as const) usuarios[rol] = (await crearUsuarioPrueba(Role[rol])).id;
});

after(async () => {
  server.close();
  if (dbDisponible) {
    if (filaAntes) await db.configuracion.update({ where: { key: CLAVE }, data: filaAntes });
    else await db.configuracion.deleteMany({ where: { key: CLAVE } });
    await db.auditLog.deleteMany({ where: { action: ACCIONES_AUDITORIA.ASISTENTE_TERMINAR, userId: { in: Object.values(usuarios) } } });
    for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

async function pedir(rol: keyof typeof usuarios | null, cuerpo?: unknown) {
  const res = await fetch(`${baseUrl}/api/cms/corporacion/asistente`, {
    method: cuerpo === undefined ? 'GET' : 'PUT',
    headers: {
      ...(rol ? { Cookie: `${COOKIE_CMS}=${generateToken(usuarios[rol]!, rol)}` } : {}),
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  return { status: res.status, cuerpo: texto ? JSON.parse(texto) : null };
}

describe('el asistente de primer arranque', () => {
  test('en una base recién instalada sale; en una web en marcha nace terminado', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.configuracion.deleteMany({ where: { key: CLAVE } });
    await AsistenteService.cargar(async () => false);
    assert.deepEqual(await AsistenteService.estado(), { paso: 0, saltados: [], terminado: null });

    await db.configuracion.deleteMany({ where: { key: CLAVE } });
    await AsistenteService.cargar(async () => true);
    assert.ok((await AsistenteService.estado()).terminado, 'una web con datos no debería ver el asistente');

    // Con la fila ya puesta, arrancar otra vez no la toca.
    await AsistenteService.cargar(async () => false);
    assert.ok((await AsistenteService.estado()).terminado);
  });

  test('solo Administración lo lee y lo apunta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedir(null)).status, 401);
    assert.equal((await pedir('SECRETARIA')).status, 403);
    assert.equal((await pedir('SECRETARIA', { paso: 1, saltados: [], terminar: false })).status, 403);
    assert.equal((await pedir('ADMIN')).status, 200);
  });

  test('apunta el paso y los saltados, termina una vez y no vuelve a salir', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.configuracion.deleteMany({ where: { key: CLAVE } });
    await AsistenteService.cargar(async () => false);

    const a = await pedir('ADMIN', { paso: 3, saltados: ['colores', 'colores'], terminar: false });
    assert.equal(a.status, 200);
    assert.deepEqual(a.cuerpo, { paso: 3, saltados: ['colores'], terminado: null });

    const b = await pedir('ADMIN', { paso: 6, saltados: ['colores', 'legales'], terminar: true });
    assert.ok(b.cuerpo.terminado);
    const auditoria = await db.auditLog.count({ where: { action: ACCIONES_AUDITORIA.ASISTENTE_TERMINAR, userId: usuarios.ADMIN } });
    assert.equal(auditoria, 1);

    // Repasarlo desde Datos de la corporación mueve el paso, pero sigue terminado.
    const c = await pedir('ADMIN', { paso: 2, saltados: [], terminar: false });
    assert.equal(c.cuerpo.terminado, b.cuerpo.terminado);
  });

  test('rechaza un paso fuera de rango o uno que no se puede saltar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedir('ADMIN', { paso: 7, saltados: [], terminar: false })).status, 400);
    assert.equal((await pedir('ADMIN', { paso: 1, saltados: ['nombre'], terminar: false })).status, 400);
  });
});
