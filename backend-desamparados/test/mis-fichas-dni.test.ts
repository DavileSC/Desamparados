// test/mis-fichas-dni.test.ts
//
// «Mi familia» y «Mi perfil» no dicen si un DNI está en el censo. Antes
// respondían «Ese DNI ya está registrado» y servían para averiguar quién es
// hermano probando DNI. Ahora el mensaje es genérico, el choque queda en la
// auditoría para Secretaría y cada cuenta tiene un cupo de DNI por día.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomInt } from 'node:crypto';
import db from '../src/config/db.js';
import { MENSAJE_DNI_NO_GUARDADO, MisFichasService } from '../src/services/mis-fichas.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const dniValido = (n: number) => `${String(n).padStart(8, '0')}${LETRAS[n % 23]}`;
let siguiente = 60_000_000 + randomInt(0, 900_000);
const nuevoDni = () => dniValido(siguiente++);

let dbDisponible = false;
const usuarios: number[] = [];

before(async () => {
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
  dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
});

after(async () => {
  for (const id of usuarios) {
    const fichas = await db.hermano.findMany({ where: { userId: id }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { entityType: 'hermano', entityId: { in: fichas.map((f) => String(f.id)) } } });
    await db.auditLog.deleteMany({ where: { action: 'FAMILIAR_DNI_OCUPADO', userId: id } });
    await db.hermano.deleteMany({ where: { userId: id } });
    await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

async function cuenta() {
  const u = await crearUsuarioPrueba();
  usuarios.push(u.id);
  return u;
}

const menor = (dni?: string) => ({ nombre: 'Lucía', primerApellido: 'Prueba', fechaNacimiento: '2015-04-12', ...(dni ? { dni } : {}) });
const noDelata = (e: unknown) => e instanceof HttpError && e.status === 400 && e.message === MENSAJE_DNI_NO_GUARDADO;

describe('un DNI de otra ficha no se confirma', () => {
  test('ni al apuntar a un familiar ni al cambiar el DNI de una ficha; Secretaría lo ve en la auditoría', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const ajena = await cuenta();
    const ocupado = nuevoDni();
    const fichaAjena = await MisFichasService.createDependentProfile(ajena.id, menor(ocupado));

    const yo = await cuenta();
    const meta = { userId: yo.id };
    await assert.rejects(MisFichasService.createDependentProfile(yo.id, menor(ocupado), meta), noDelata);

    const mia = await MisFichasService.createDependentProfile(yo.id, menor(nuevoDni()), meta);
    await assert.rejects(MisFichasService.updateProfileIfOwned(mia.id, yo.id, { dni: ocupado }, meta), noDelata);

    const rastros = await db.auditLog.findMany({ where: { action: 'FAMILIAR_DNI_OCUPADO', userId: yo.id } });
    assert.equal(rastros.length, 2);
    for (const r of rastros) {
      assert.deepEqual(r.detalles, { fichaConEseDni: fichaAjena.id });
      assert.ok(!JSON.stringify(r.detalles).includes(ocupado), 'sin el DNI en claro');
    }
  });

  test('cada cuenta escribe como mucho diez DNI al día, salgan bien o mal', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const yo = await cuenta();
    const mia = await MisFichasService.createDependentProfile(yo.id, menor(nuevoDni()));
    for (let i = 0; i < 9; i++) await MisFichasService.updateProfileIfOwned(mia.id, yo.id, { dni: nuevoDni() });
    await assert.rejects(
      MisFichasService.updateProfileIfOwned(mia.id, yo.id, { dni: nuevoDni() }),
      (e: unknown) => e instanceof HttpError && e.status === 429,
    );
    // Lo que no toca el DNI sigue funcionando.
    assert.ok(await MisFichasService.updateProfileIfOwned(mia.id, yo.id, { nombre: 'Lucía María' }));
  });
});
