// Lo que una baja hace con la procesión (NG2, auditoría del 07-10-2026).
//
// Dar de baja (Secretaría, también por fallecimiento; la familia desde su
// área; o al borrar la cuenta) no tocaba las solicitudes de salida: seguían
// vivas en la mesa y en el día de reparto. Ahora las que aún no se han pagado
// ni recogido, de salidas por celebrar, se cancelan en la misma transacción,
// con el mismo rastro que una cancelación a mano. Las pagadas se quedan (lo
// decide la Junta) y las de salidas ya pasadas son historia.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { EstadoCita, EstadoPago, EstadoSolicitud, OrigenSolicitud, Prisma, Role, TipoRecibo } from '@prisma/client';
import db from '../src/config/db.js';
import { CensoService } from '../src/services/censo.service.js';
import { MisFichasService } from '../src/services/mis-fichas.service.js';
import { MisDatosService } from '../src/services/mis-datos.service.js';
import { anioDeLaMesa } from '../src/services/procesion/zonas.service.js';
import { PASION, salida } from './fixtures/salidas.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await db.$disconnect();
});

/** Una cuenta con una ficha en activo y tres solicitudes de la Pasión: viva sin pagar, viva pagada y de hace años. */
async function escenario() {
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const usuario = await crearUsuarioPrueba(Role.USER);
  const pasion = await salida(PASION);
  const year = anioDeLaMesa(pasion);
  const hermano = await db.hermano.create({
    data: { userId: usuario.id, nombre: 'Baja', apellidos: `Procesión ${Date.now()}`, fechaNacimiento: new Date(Date.UTC(1990, 0, 1)), activo: true, esTitular: true },
  });
  const turno = await db.turno.create({
    data: { salidaId: pasion.id, fecha: new Date(`${year}-01-15`), horaInicio: new Date(`${year}-01-15T17:00:00Z`), horaFin: new Date(`${year}-01-15T20:00:00Z`) },
  });
  const cita = await db.cita.create({ data: { turnoId: turno.id, hermanoId: hermano.id } });
  const solicitud = (extra: Partial<Prisma.SolicitudUncheckedCreateInput>) =>
    db.solicitud.create({ data: { hermanoId: hermano.id, salidaId: pasion.id, year, puesto: 'Cirio', origen: OrigenSolicitud.WEB, ...extra } });
  const sinPagar = await solicitud({ citaId: cita.id });
  const recibo = await db.recibo.create({
    data: { hermanoId: hermano.id, year, concepto: `Papeleta ${year}`, importe: new Prisma.Decimal(10), tipo: TipoRecibo.PAPELETA_SITIO, estado: EstadoPago.PAGADO },
  });
  const pagada = await solicitud({ reciboId: recibo.id, puesto: 'Vara' });
  const antigua = await solicitud({ year: year - 5 });

  const estado = async (id: number) => (await db.solicitud.findUniqueOrThrow({ where: { id } })).estado;
  const comprobar = async () => {
    assert.equal(await estado(sinPagar.id), EstadoSolicitud.CANCELADA, 'la viva sin pagar se cancela');
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.CANCELADA, 'y suelta su cita');
    assert.equal(await estado(pagada.id), EstadoSolicitud.PENDIENTE, 'la pagada la decide la Junta');
    assert.equal(await estado(antigua.id), EstadoSolicitud.PENDIENTE, 'la de una salida pasada no se toca');
    const rastro = await db.auditLog.count({ where: { action: 'SOLICITUD_SALIDA_CANCELAR', entityType: 'solicitud', entityId: String(sinPagar.id) } });
    assert.equal(rastro, 1, 'deja el mismo rastro que cancelarla a mano');
  };

  const recoger = async () => {
    const ids = [sinPagar.id, pagada.id, antigua.id].map(String);
    await db.auditLog.deleteMany({ where: { OR: [{ entityType: 'solicitud', entityId: { in: ids } }, { entityType: 'hermano', entityId: String(hermano.id) }, { userId: staff.id }] } });
    await db.solicitud.deleteMany({ where: { hermanoId: hermano.id } });
    await db.cita.deleteMany({ where: { id: cita.id } });
    await db.turno.deleteMany({ where: { id: turno.id } });
    await db.recibo.deleteMany({ where: { hermanoId: hermano.id } });
    await db.hermano.deleteMany({ where: { id: hermano.id } });
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(staff.id);
  };
  return { staff, usuario, hermano, comprobar, recoger };
}

test('la baja de Secretaría por fallecimiento cancela sus solicitudes sin pagar', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    await CensoService.darDeBajaHermano(e.hermano.id, { userId: e.staff.id }, undefined, 'FALLECIMIENTO');
    await e.comprobar();
  } finally {
    await e.recoger();
  }
});

test('la baja que pide la familia desde su área, también', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    await MisFichasService.deleteProfileIfOwned(e.hermano.id, e.usuario.id, { userId: e.usuario.id });
    await e.comprobar();
  } finally {
    await e.recoger();
  }
});

test('y la de quien borra su cuenta', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    await MisDatosService.deleteOwnAccount(e.usuario.id, PASSWORD_PRUEBA, 'hermanos', { userId: e.usuario.id });
    await e.comprobar();
  } finally {
    await e.recoger();
  }
});
