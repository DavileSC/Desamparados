// test/reactivacion.test.ts
//
// Quien se dio de baja y quiere volver. Su ficha conserva la fecha de baja, así
// que no entra en la cola de solicitudes (esa busca las que nunca estuvieron en
// el censo): la petición se marca aparte y Secretaría la ve junto a las altas,
// pero la resuelve reactivando, que le da número nuevo.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomInt } from 'node:crypto';
import db from '../src/config/db.js';
import { AuthService } from '../src/services/auth.service.js';
import { HermanoService } from '../src/services/hermano.service.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const dniValido = (n: number) => `${String(n).padStart(8, '0')}${LETRAS[n % 23]}`;

describe('pedir volver tras una baja', () => {
  let dbDisponible = false;
  const sufijo = `${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`;
  const usuarios: number[] = [];
  const fichas: number[] = [];
  let siguienteDni = 80_000_000 + randomInt(0, 900_000);
  const dniDeBaja = dniValido(siguienteDni++);
  const email = `vuelve-${sufijo}@ejemplo.test`;

  before(async () => {
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
    if (!dbDisponible) return;

    // Un hermano que estuvo en el censo y se dio de baja hace tiempo.
    const user = await db.user.create({
      data: {
        email, dni: dniDeBaja, password: 'x', nombre: 'Antonio', apellidos: 'Vega Ruiz',
        telefono: '600111222', active: false,
      },
    });
    usuarios.push(user.id);
    const ficha = await db.hermano.create({
      data: {
        userId: user.id, nombre: 'Antonio', apellidos: 'Vega Ruiz', dni: dniDeBaja,
        fechaNacimiento: new Date('1980-02-10'), esTitular: true,
        activo: false, fechaBaja: new Date('2024-06-30'), numeroHermano: null,
      },
    });
    fichas.push(ficha.id);
  });

  after(async () => {
    if (dbDisponible) {
      await db.auditLog.deleteMany({ where: { entityType: 'hermano', entityId: { in: fichas.map(String) } } });
      await db.hermano.deleteMany({ where: { id: { in: fichas } } });
      await db.user.deleteMany({ where: { id: { in: usuarios } } });
    }
    await db.$disconnect();
  });

  const laFicha = () => db.hermano.findUnique({ where: { id: fichas[0] } });

  test('la petición marca la ficha sin tocar la fecha de baja', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await AuthService.solicitarReactivacion({ dni: dniDeBaja, email });

    const ficha = await laFicha();
    assert.ok(ficha!.reactivacionSolicitada, 'queda marcada');
    assert.deepEqual(ficha!.fechaBaja, new Date('2024-06-30'), 'y no se pierde cuándo se fue');
    assert.equal(ficha!.activo, false, 'sigue fuera del censo hasta que Secretaría la mire');
  });

  test('insistir no reescribe desde cuándo espera', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const primera = (await laFicha())!.reactivacionSolicitada;
    await AuthService.solicitarReactivacion({ dni: dniDeBaja, email });
    assert.deepEqual((await laFicha())!.reactivacionSolicitada, primera);
  });

  test('sale en la cola de Secretaría, aparte de las altas nuevas', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { reactivaciones } = await HermanoService.getSolicitudesPendientes();
    const suya = reactivaciones.find((r) => r.id === fichas[0]);
    assert.ok(suya, 'la petición está en la cola');
    assert.equal(suya!.dni, dniDeBaja);
    assert.ok(suya!.fechaBaja, 'y se ve desde cuándo estaba fuera');
  });

  test('responde lo mismo exista o no el DNI: el formulario no delata al censo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const conFicha = await AuthService.solicitarReactivacion({ dni: dniDeBaja, email });
    const sinFicha = await AuthService.solicitarReactivacion({ dni: dniValido(siguienteDni++), email: 'nadie@ejemplo.test' });
    assert.deepEqual(conFicha, sinFicha);
  });

  test('reactivar la atiende: número nuevo y fuera de la cola', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await HermanoService.reactivarHermano(fichas[0], {});

    const ficha = await laFicha();
    assert.equal(ficha!.activo, true);
    assert.equal(ficha!.fechaBaja, null);
    assert.ok(ficha!.numeroHermano, 'vuelve con número');
    assert.equal(ficha!.reactivacionSolicitada, null, 'la petición queda atendida');

    const { reactivaciones } = await HermanoService.getSolicitudesPendientes();
    assert.ok(!reactivaciones.some((r) => r.id === fichas[0]));
  });

  test('descartarla la saca de la cola y la deja de baja como estaba', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Se vuelve a dejar de baja y a pedir, para probar el otro botón.
    await db.hermano.update({
      where: { id: fichas[0] },
      data: { activo: false, fechaBaja: new Date('2024-06-30'), numeroHermano: null },
    });
    await AuthService.solicitarReactivacion({ dni: dniDeBaja, email });

    await HermanoService.descartarReactivacion(fichas[0], {});
    const ficha = await laFicha();
    assert.equal(ficha!.reactivacionSolicitada, null);
    assert.equal(ficha!.activo, false, 'no se reactiva de rebote');
    assert.ok(ficha!.fechaBaja, 'y sigue constando cuándo se fue');

    await assert.rejects(() => HermanoService.descartarReactivacion(fichas[0], {}), /ya no está/);
  });
});
