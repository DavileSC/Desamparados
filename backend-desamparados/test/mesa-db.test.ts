// La mesa de la procesión contra MariaDB: apuntar con la ropa del ropero,
// cobrar el alquiler solo por la túnica del ropero, avisar de quién tiene una
// prenda, dar de alta en el momento y corregir o anular devolviendo la ropa.
// Cada prueba siembra lo suyo y lo recoge al terminar.

import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoCita, EstadoPrenda, MetodoPago, Role, TipoPrenda } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { EmailService } from '../src/services/email.service.js';
import { PapeletasService } from '../src/services/procesion/papeletas.service.js';
import { MesaService } from '../src/services/procesion/mesa.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;
let server: Server;
let baseUrl: string;

mock.method(EmailService, 'enviarPapeleta', async () => undefined);

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  mock.restoreAll();
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

// Números de prenda que no chocan con los del ropero de desarrollo.
let serie = 0;
const numeroDePrueba = (prefijo = '') => `${prefijo}P${process.pid}${Date.now() % 100000}${(serie += 1)}`;

/** Un escenario desechable: quien firma, una cuenta con sus fichas, prendas y precios fijos. */
async function escenario() {
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  const usuario = await crearUsuarioPrueba(Role.USER);
  const meta = { userId: admin.id };
  const hermanos: number[] = [];
  const usuariosExtra: number[] = [];
  const prendas: number[] = [];
  const turnos: number[] = [];
  const precios = await db.configuracion.findMany({ where: { key: { in: ['precio_papeleta_sitio', 'precio_alquiler_tunica'] } } });
  for (const [key, value] of [['precio_papeleta_sitio', '30'], ['precio_alquiler_tunica', '15']]) {
    await db.configuracion.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  const hermano = async (extra: { nombre?: string; tieneTunicaPropia?: boolean } = {}) => {
    const h = await db.hermano.create({
      data: {
        userId: usuario.id, nombre: extra.nombre ?? 'Mesa', apellidos: `Prueba ${Date.now()}${hermanos.length}`,
        fechaNacimiento: new Date(Date.UTC(1990, 0, 1)), activo: true, tieneTunicaPropia: extra.tieneTunicaPropia ?? false,
      },
    });
    hermanos.push(h.id);
    return h;
  };

  const prenda = async (tipo: TipoPrenda, numero = numeroDePrueba(), extra: { estado?: EstadoPrenda; hermanoId?: number } = {}) => {
    const p = await db.prenda.create({ data: { tipo, numero, estado: extra.estado ?? EstadoPrenda.DISPONIBLE, hermanoId: extra.hermanoId } });
    prendas.push(p.id);
    return p;
  };

  const recoger = async () => {
    const todos = [...hermanos, ...(await db.hermano.findMany({ where: { userId: { in: usuariosExtra } }, select: { id: true } })).map((h) => h.id)];
    await db.auditLog.deleteMany({ where: { userId: admin.id } });
    await db.transaccion.deleteMany({ where: { hermanoId: { in: todos } } });
    await db.papeletaSitio.deleteMany({ where: { hermanoId: { in: todos } } });
    await db.cita.deleteMany({ where: { OR: [{ hermanoId: { in: todos } }, { turnoId: { in: turnos } }] } });
    await db.recibo.deleteMany({ where: { hermanoId: { in: todos } } });
    await db.turno.deleteMany({ where: { id: { in: turnos } } });
    await db.prenda.deleteMany({ where: { OR: [{ id: { in: prendas } }, { hermanoId: { in: todos } }] } });
    await db.hermano.deleteMany({ where: { id: { in: todos } } });
    for (const id of usuariosExtra) await borrarUsuarioPrueba(id);
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(admin.id);
    for (const key of ['precio_papeleta_sitio', 'precio_alquiler_tunica']) {
      const previo = precios.find((p) => p.key === key);
      if (previo) await db.configuracion.update({ where: { key }, data: { value: previo.value } });
      else await db.configuracion.deleteMany({ where: { key } });
    }
  };

  return { admin, usuario, meta, hermano, prenda, prendas, turnos, hermanos, usuariosExtra, recoger };
}

const apuntar = (hermanoId: number, extra: Partial<Parameters<typeof PapeletasService.inscribirYFacturar>[0]>, meta: { userId: number }) =>
  PapeletasService.inscribirYFacturar({ hermanoId, metodoPago: MetodoPago.EFECTIVO, puesto: 'Nazareno', ...extra }, meta);

test('apuntar con túnica y capirote del ropero: quedan prestados y se cobra el alquiler', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano({ tieneTunicaPropia: true });
    const tunica = await e.prenda(TipoPrenda.TUNICA);
    const capirote = await e.prenda(TipoPrenda.CAPIROTE);

    const { recibo, papeleta } = await apuntar(h.id, {
      origenTunica: 'ROPERO', numTunicaAsignada: tunica.numero, numCapiroteAsignado: capirote.numero,
    }, e.meta);

    assert.equal(Number(recibo.importe), 45, 'papeleta 30 + alquiler 15, aunque la ficha dijera túnica propia');
    assert.equal(papeleta.origenTunica, 'ROPERO');
    for (const id of [tunica.id, capirote.id]) {
      const p = await db.prenda.findUniqueOrThrow({ where: { id } });
      assert.equal(p.estado, EstadoPrenda.PRESTADA);
      assert.equal(p.hermanoId, h.id);
    }
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: h.id } })).tieneTunicaPropia, false);
  } finally {
    await e.recoger();
  }
});

test('con túnica propia o sin túnica (mantilla) no se cobra alquiler', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const propia = await e.hermano();
    const mantilla = await e.hermano();
    const a = await apuntar(propia.id, { origenTunica: 'PROPIA', numTunicaAsignada: 'ignorada' }, e.meta);
    const b = await apuntar(mantilla.id, { origenTunica: 'NINGUNA', puesto: 'Mantilla' }, e.meta);
    assert.equal(Number(a.recibo.importe), 30);
    assert.equal(a.papeleta.numTunicaAsignada, null, 'una túnica propia no lleva número del ropero');
    assert.equal(Number(b.recibo.importe), 30);
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: propia.id } })).tieneTunicaPropia, true);
  } finally {
    await e.recoger();
  }
});

test('una prenda que tiene otra persona no se presta, y la mesa sabe quién la tiene', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const duena = await e.hermano({ nombre: 'Lucía' });
    const otro = await e.hermano();
    const tunica = await e.prenda(TipoPrenda.TUNICA, numeroDePrueba(), { estado: EstadoPrenda.PRESTADA, hermanoId: duena.id });

    await assert.rejects(
      apuntar(otro.id, { origenTunica: 'ROPERO', numTunicaAsignada: tunica.numero }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 409 && err.message.includes(`la tiene Lucía ${duena.apellidos}`),
    );
    // Todo o nada: sin papeleta ni recibo.
    assert.equal(await db.papeletaSitio.count({ where: { hermanoId: otro.id } }), 0);
    assert.equal(await db.recibo.count({ where: { hermanoId: otro.id } }), 0);
  } finally {
    await e.recoger();
  }
});

test('una túnica que no está en el ropero se niega, salvo que se pida darla de alta (con su talla)', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const numero = `145-${numeroDePrueba()}`;
    await assert.rejects(
      apuntar(h.id, { origenTunica: 'ROPERO', numTunicaAsignada: numero }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 404 && /no está en el ropero/.test(err.message),
    );
    await apuntar(h.id, { origenTunica: 'ROPERO', numTunicaAsignada: numero, crearPrendas: ['TUNICA'] }, e.meta);
    const creada = await db.prenda.findUniqueOrThrow({ where: { tipo_numero: { tipo: TipoPrenda.TUNICA, numero: numero.toUpperCase() } } });
    e.prendas.push(creada.id);
    assert.equal(creada.talla, '145');
    assert.equal(creada.hermanoId, h.id);
  } finally {
    await e.recoger();
  }
});

test('el capirote 18 y la faraona 18 son prendas distintas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const numero = numeroDePrueba();
    await e.prenda(TipoPrenda.CAPIROTE, numero);
    const faraona = await e.prenda(TipoPrenda.FARAONA, numero);
    const nino = await e.hermano();
    await apuntar(nino.id, { puesto: 'Guardería', origenTunica: 'PROPIA', numFaraonaAsignada: numero }, e.meta);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: faraona.id } })).hermanoId, nino.id);
    const capirote = await db.prenda.findUniqueOrThrow({ where: { tipo_numero: { tipo: TipoPrenda.CAPIROTE, numero } } });
    assert.equal(capirote.estado, EstadoPrenda.DISPONIBLE, 'el capirote del mismo número sigue en el ropero');
  } finally {
    await e.recoger();
  }
});

test('la altura de hombro dictada en metros va a la ficha en centímetros; si no se entiende, no se cobra', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    await assert.rejects(
      apuntar(h.id, { puesto: 'Trono', origenTunica: 'PROPIA', alturaHombro: 'alto' }, e.meta),
      (err: unknown) => err instanceof HttpError && /altura de hombro/.test(err.message),
    );
    assert.equal(await db.recibo.count({ where: { hermanoId: h.id } }), 0);
    await apuntar(h.id, { puesto: 'Trono', origenTunica: 'PROPIA', alturaHombro: '1,54' }, e.meta);
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: h.id } })).alturaHombro, 154);
  } finally {
    await e.recoger();
  }
});

test('quien pidió día y viene cierra su cita, aunque la mesa no la señale', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const hoy = new Date();
    const turno = await db.turno.create({ data: { fecha: hoy, horaInicio: hoy, horaFin: new Date(hoy.getTime() + 3_600_000) } });
    e.turnos.push(turno.id);
    const cita = await db.cita.create({ data: { turnoId: turno.id, hermanoId: h.id } });

    assert.ok((await MesaService.esperadosHoy()).some((x) => x.citaId === cita.id), 'sale entre los esperados de hoy');
    const { papeleta } = await apuntar(h.id, { origenTunica: 'PROPIA' }, e.meta);
    assert.equal(papeleta.citaId, cita.id);
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.ATENDIDA);
  } finally {
    await e.recoger();
  }
});

test('la ficha propone la ropa del año pasado y, al cambiar de túnica, la vieja vuelve al ropero', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const vieja = await e.prenda(TipoPrenda.TUNICA, numeroDePrueba(), { estado: EstadoPrenda.PRESTADA, hermanoId: h.id });
    const nueva = await e.prenda(TipoPrenda.TUNICA);

    const ficha = await MesaService.ficha(h.id);
    assert.deepEqual(ficha.propuesta.tunica, { origen: 'ROPERO', numero: vieja.numero });
    assert.deepEqual(ficha.precios, { papeleta: 30, alquiler: 15 });

    await apuntar(h.id, { origenTunica: 'ROPERO', numTunicaAsignada: nueva.numero }, e.meta);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: vieja.id } })).estado, EstadoPrenda.DISPONIBLE);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: nueva.id } })).hermanoId, h.id);
  } finally {
    await e.recoger();
  }
});

test('corregir la ropa de una papeleta presta la nueva y devuelve la cambiada; anular devuelve toda', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const [t1, t2, cap] = [await e.prenda(TipoPrenda.TUNICA), await e.prenda(TipoPrenda.TUNICA), await e.prenda(TipoPrenda.CAPIROTE)];
    const { papeleta } = await apuntar(h.id, { origenTunica: 'ROPERO', numTunicaAsignada: t1.numero, numCapiroteAsignado: cap.numero }, e.meta);

    const corregida = await MesaService.editarPapeleta(papeleta.id, { numTunicaAsignada: t2.numero, puesto: 'Viacrucis' }, e.meta);
    assert.equal(corregida.puesto, 'Viacrucis');
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: t1.id } })).estado, EstadoPrenda.DISPONIBLE);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: t2.id } })).hermanoId, h.id);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: cap.id } })).hermanoId, h.id, 'el capirote no cambia');

    await PapeletasService.anularPapeleta(papeleta.id, e.meta);
    for (const id of [t2.id, cap.id]) {
      assert.equal((await db.prenda.findUniqueOrThrow({ where: { id } })).estado, EstadoPrenda.DISPONIBLE);
    }
  } finally {
    await e.recoger();
  }
});

test('alta en la mesa: un adulto abre su cuenta y su ficha, activa y con número', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  const sufijo = `${process.pid}${Date.now() % 1_000_000}`;
  try {
    const alta = await MesaService.darDeAlta({
      nombre: 'Adán', primerApellido: 'Elena', segundoApellido: 'Sedano', fechaNacimiento: '1990-03-08',
      telefono: '639220861', email: `mesa-${sufijo}@ejemplo.test`, dni: `M${sufijo}`.slice(0, 9),
    }, e.meta);
    const ficha = await db.hermano.findUniqueOrThrow({ where: { id: alta.id }, include: { user: true } });
    e.usuariosExtra.push(ficha.userId);
    assert.equal(ficha.activo, true);
    assert.ok(ficha.numeroHermano);
    assert.equal(ficha.esTitular, true);
    assert.equal(ficha.apellidos, 'Elena Sedano');
    assert.equal(ficha.user.email, `mesa-${sufijo}@ejemplo.test`);
    assert.equal(ficha.user.active, true);

    // Un menor, colgado de la cuenta de su tutor, que ya está en el censo.
    const bebe = await MesaService.darDeAlta({
      nombre: 'Abril', primerApellido: 'López', fechaNacimiento: '2021-09-21', tutor: { hermanoId: alta.id }, parentesco: 'HIJO',
    }, e.meta);
    const fichaBebe = await db.hermano.findUniqueOrThrow({ where: { id: bebe.id } });
    assert.equal(fichaBebe.userId, ficha.userId);
    assert.equal(fichaBebe.esTitular, false);
    assert.equal(fichaBebe.telefono, '639220861', 'hereda el contacto del tutor');

    // Sin DNI no se abre la cuenta de un adulto.
    await assert.rejects(
      MesaService.darDeAlta({ nombre: 'Sin', primerApellido: 'Dni', fechaNacimiento: '1980-01-01', email: 'x@ejemplo.test', telefono: '600000000' }, e.meta),
      (err: unknown) => err instanceof HttpError && /DNI, su correo y su teléfono/.test(err.message),
    );
    // Un adulto no se cuelga de la cuenta de nadie.
    await assert.rejects(
      MesaService.darDeAlta({ nombre: 'Mayor', primerApellido: 'Deedad', fechaNacimiento: '1980-01-01', tutor: { hermanoId: alta.id } }, e.meta),
      (err: unknown) => err instanceof HttpError && /años cumplidos/.test(err.message),
    );
  } finally {
    await e.recoger();
  }
});

test('«editar antes de guardar» corrige la ficha y deja rastro solo de lo que cambia', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const r = await MesaService.corregirFicha(h.id, { primerApellido: 'Galea', segundoApellido: 'Mayorga', telefono: '623577927', alturaHombro: '1,45' }, e.meta);
    assert.equal(r.cambiados, 5, 'apellidos juntos y partidos, teléfono y altura');
    const ficha = await db.hermano.findUniqueOrThrow({ where: { id: h.id } });
    assert.equal(ficha.apellidos, 'Galea Mayorga');
    assert.equal(ficha.alturaHombro, 145);
    assert.equal((await MesaService.corregirFicha(h.id, { telefono: '623577927' }, e.meta)).cambiados, 0);
  } finally {
    await e.recoger();
  }
});

test('por HTTP: la mesa es de la Junta que reparte; reactivar o aprobar, solo de Secretaría', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  const albaceria = await crearUsuarioPrueba(Role.ALBACERIA);
  try {
    const h = await e.hermano({ nombre: 'Buscable' });
    const como = (userId: number, rol: Role, ruta: string, metodo = 'GET') =>
      fetch(`${baseUrl}/api/procesion${ruta}`, { method: metodo, headers: { Cookie: `${COOKIE_CMS}=${generateToken(userId, rol)}` } });

    assert.equal((await como(e.usuario.id, Role.USER, '/admin/mesa/personas?q=Buscable')).status, 403);
    const busqueda = await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas?q=${encodeURIComponent(h.apellidos)}`);
    assert.equal(busqueda.status, 200);
    const [encontrada] = await busqueda.json() as { id: number; situacion: string }[];
    assert.equal(encontrada.id, h.id);
    assert.equal(encontrada.situacion, 'activo');

    assert.equal((await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas/${h.id}/activar`, 'POST')).status, 403);
    assert.equal((await como(albaceria.id, Role.ALBACERIA, '/admin/mesa/prendas?tipo=GORRO&q=1')).status, 400);
  } finally {
    await borrarUsuarioPrueba(albaceria.id);
    await e.recoger();
  }
});
