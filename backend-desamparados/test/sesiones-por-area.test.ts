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
import db from '../src/config/db.js';
import { validateSessionAgainstDb } from '../src/middleware/session.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { Role } from '@prisma/client';

let dbDisponible = false;
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
  dbDisponible = await sondearDb();
  if (!dbDisponible) {
    console.log(`
ℹ  Sin conexión a la base de datos: se omiten los tests que la necesitan.`);
    console.log(`   Motivo: ${motivoSinDb}`);
  }
});

const creados: number[] = [];
after(async () => {
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
