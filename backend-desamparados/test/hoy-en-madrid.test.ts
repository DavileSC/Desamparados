// «Hoy» es el día de Madrid, no el del reloj del servidor (NG8, auditoría del
// 07-10-2026). El contenedor corre en UTC: con `setHours(0, 0, 0, 0)`, de
// medianoche a las 02:00 de Madrid la mesa y la lista de asistentes buscaban
// el día anterior. Esta prueba fuerza la zona del proceso a UTC para
// reproducir el servidor aunque se lance en un PC de Madrid. Además,
// `getAsistentesDelDia` ya no cambia la fecha que recibe.

process.env.TZ = 'UTC';

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { EstadoCita, Role } from '@prisma/client';
import db from '../src/config/db.js';
import { diaMadridComoIntervalo } from '../src/domain/contabilidad.js';
import { PapeletasService } from '../src/services/procesion/papeletas.service.js';
import { MesaService } from '../src/services/procesion/mesa.service.js';
import { idDeSalida, salida, PASION } from './fixtures/salidas.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await db.$disconnect();
});

test('el día de Madrid como intervalo, también los días de cambio de hora', () => {
  // 00:30 del 8 de octubre en Madrid (horario de verano) es 22:30 UTC del 7.
  const otoño = diaMadridComoIntervalo(new Date('2026-10-07T22:30:00Z'));
  assert.equal(otoño.desde.toISOString(), '2026-10-07T22:00:00.000Z');
  assert.equal(otoño.hasta.toISOString(), '2026-10-08T22:00:00.000Z');
  // El 29-03-2026 se adelanta la hora: el día dura 23 horas.
  const cambio = diaMadridComoIntervalo(new Date('2026-03-29T10:00:00Z'));
  assert.equal(cambio.desde.toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(cambio.hasta.toISOString(), '2026-03-29T22:00:00.000Z');
});

test('a las 00:30 de Madrid, la mesa y la lista de asistentes ven el reparto de ese día', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const usuario = await crearUsuarioPrueba(Role.USER);
  const hermano = await db.hermano.create({
    data: { userId: usuario.id, nombre: 'Madrugada', apellidos: `Prueba ${Date.now()}`, fechaNacimiento: new Date(Date.UTC(1990, 0, 1)), activo: true },
  });
  // Un día de reparto lejano, guardado como lo guarda la pantalla de turnos
  // (`AAAA-MM-DD` → medianoche UTC), de 18:00 a 21:00 en Madrid.
  const turno = await db.turno.create({
    data: {
      salidaId: await idDeSalida(PASION), fecha: new Date('2030-06-15'),
      horaInicio: new Date('2030-06-15T16:00:00Z'), horaFin: new Date('2030-06-15T19:00:00Z'),
    },
  });
  const cita = await db.cita.create({ data: { turnoId: turno.id, hermanoId: hermano.id, estado: EstadoCita.RESERVADA } });
  try {
    const madrugada = new Date('2030-06-14T22:30:00Z');
    const asistentes = await PapeletasService.getAsistentesDelDia(madrugada);
    assert.ok(asistentes.some((c) => c.id === cita.id), 'la cita del 15 sale a las 00:30 del 15');
    assert.equal(madrugada.toISOString(), '2030-06-14T22:30:00.000Z', 'la fecha recibida no se toca');

    const esperados = await MesaService.esperadosHoy(await salida(PASION), madrugada);
    assert.ok(esperados.some((e) => e.citaId === cita.id), 'la mesa también lo espera');
  } finally {
    await db.cita.deleteMany({ where: { id: cita.id } });
    await db.turno.deleteMany({ where: { id: turno.id } });
    await db.hermano.deleteMany({ where: { id: hermano.id } });
    await borrarUsuarioPrueba(usuario.id);
  }
});
