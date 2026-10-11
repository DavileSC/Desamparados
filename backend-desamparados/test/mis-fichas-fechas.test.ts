// Las fechas que el hermano cambia en sus fichas desde «Mi perfil» y «Mi
// familia» pasan por las mismas reglas que el alta: el titular es mayor de
// edad, la ficha a cargo (aún pendiente) es de un menor, nada nace ni se
// bautiza en el futuro y nadie se bautiza antes de nacer. Antes la edición se
// lo tragaba todo: un menor pendiente se hacía adulto y el titular podía
// quedarse con seis años.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import db from '../src/config/db.js';
import { MisFichasService } from '../src/services/mis-fichas.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { diaDe, diaDeHoy } from '../src/domain/fechas-hermano.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

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
    await db.hermano.deleteMany({ where: { userId: id } });
    await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

/** Una cuenta con su ficha de titular (de 1980, bautizado en 1980) y un hijo pendiente de 2015. */
async function familia() {
  const u = await crearUsuarioPrueba();
  usuarios.push(u.id);
  const titular = await MisFichasService.createDependentProfile(u.id, { nombre: 'Antonio', primerApellido: 'Ruiz', fechaNacimiento: '1980-01-01', dni: u.dni });
  await db.hermano.update({ where: { id: titular.id }, data: { fechaBautismo: new Date(Date.UTC(1980, 2, 1)) } });
  const hijo = await MisFichasService.createDependentProfile(u.id, { nombre: 'Pablo', primerApellido: 'Ruiz', fechaNacimiento: '2015-04-12', parentesco: 'HIJO' });
  return { u, titular, hijo };
}

const rechazo = (patron: RegExp) => (e: unknown) => e instanceof HttpError && e.status === 400 && patron.test(e.message);

/** 'AAAA-MM-DD' a tantos años de hoy (negativo, al pasado). */
function haceAnios(anios: number): string {
  const [a, m, d] = diaDeHoy().split('-');
  return `${Number(a) - anios}-${m}-${d === '29' && m === '02' ? '28' : d}`;
}

const MANANA = (() => {
  const d = new Date(`${diaDeHoy()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();

describe('la ficha a cargo pendiente sigue siendo de un menor', () => {
  test('cambiarle la fecha para hacerlo adulto se rechaza; otra fecha de menor vale', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { u, hijo } = await familia();
    await assert.rejects(MisFichasService.updateProfileIfOwned(hijo.id, u.id, { fechaNacimiento: '1990-01-01' }), rechazo(/18 años/));
    await assert.rejects(MisFichasService.updateProfileIfOwned(hijo.id, u.id, { fechaNacimiento: MANANA }), rechazo(/futura/));
    const bien = await MisFichasService.updateProfileIfOwned(hijo.id, u.id, { fechaNacimiento: '2016-04-12' });
    assert.equal(bien?.fechaNacimiento.toISOString().slice(0, 10), '2016-04-12');
  });
});

describe('la ficha del titular', () => {
  test('no nace en el futuro ni se queda en menor de edad', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { u, titular } = await familia();
    await assert.rejects(MisFichasService.updateProfileIfOwned(titular.id, u.id, { fechaNacimiento: MANANA }), rechazo(/futura/));
    await assert.rejects(MisFichasService.updateProfileIfOwned(titular.id, u.id, { fechaNacimiento: haceAnios(6) }), rechazo(/18 años/));
    const bien = await MisFichasService.updateProfileIfOwned(titular.id, u.id, { fechaNacimiento: '1979-12-31' });
    assert.equal(bien?.fechaNacimiento.toISOString().slice(0, 10), '1979-12-31');
  });

  test('el bautismo no es futuro ni anterior al nacimiento (el nuevo o el guardado)', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { u, titular } = await familia();
    await assert.rejects(MisFichasService.updateProfileIfOwned(titular.id, u.id, { fechaBautismo: MANANA }), rechazo(/bautismo.*posterior a hoy/i));
    // Contra el nacimiento guardado (1980-01-01).
    await assert.rejects(MisFichasService.updateProfileIfOwned(titular.id, u.id, { fechaBautismo: '1979-06-01' }), rechazo(/bautismo.*anterior.*nacimiento/i));
    // Contra el bautismo guardado (1980-03-01), moviendo solo el nacimiento.
    await assert.rejects(MisFichasService.updateProfileIfOwned(titular.id, u.id, { fechaNacimiento: '1980-06-01' }), rechazo(/bautismo.*anterior.*nacimiento/i));
    // Las dos a la vez, coherentes entre sí.
    const bien = await MisFichasService.updateProfileIfOwned(titular.id, u.id, { fechaNacimiento: '1980-06-01', fechaBautismo: '1980-07-01' });
    assert.ok(bien?.fechaBautismo);
    assert.equal(diaDe(bien.fechaBautismo), '1980-07-01');
    // El mismo día que el nacimiento vale; vaciarlo, también.
    await MisFichasService.updateProfileIfOwned(titular.id, u.id, { fechaBautismo: '1980-06-01' });
    await MisFichasService.updateProfileIfOwned(titular.id, u.id, { fechaBautismo: null });
  });
});
