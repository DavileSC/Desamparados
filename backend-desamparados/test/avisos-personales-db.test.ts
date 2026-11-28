// Los avisos personales: lo de la papeleta pendiente (sin recoger, la cita
// para recogerla) va por correo y se guarda para la página Avisos del área.
// Y el recordatorio de la cita la víspera, uno por cuenta.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_HERMANO } from '../src/utils/cookies.js';
import { colaTerminada } from '../src/services/correos/cola.js';
import { ponerTransporte } from '../src/services/correos/envio.js';
import { EmailService } from '../src/services/email.service.js';
import { AvisosPersonalesService } from '../src/services/avisos-personales.service.js';
import { recordarCitas } from '../src/services/procesion/recordatorio-citas.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { encenderModulos } from './fixtures/modulos.js';
import { idDeSalida } from './fixtures/salidas.js';
import { SIN_DB } from './fixtures/sin-db.js';

let server: Server;
let baseUrl: string;
let dbDisponible = false;
let restaurarModulos: (() => Promise<void>) | undefined;
const usuarios: number[] = [];
const turnos: number[] = [];
const enviados: { to: string; subject: string }[] = [];

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (dbDisponible) restaurarModulos = await encenderModulos(['area-hermanos', 'procesion']);
  ponerTransporte({ sendMail: async (correo) => { enviados.push({ to: correo.to, subject: correo.subject }); return {}; } });
});

after(async () => {
  ponerTransporte(undefined);
  if (dbDisponible) {
    await colaTerminada();
    await db.correoEnCola.deleteMany({ where: { userId: { in: usuarios } } });
    await db.cita.deleteMany({ where: { turnoId: { in: turnos } } });
    await db.turno.deleteMany({ where: { id: { in: turnos } } });
    await db.hermano.deleteMany({ where: { userId: { in: usuarios } } });
    for (const id of usuarios) await borrarUsuarioPrueba(id);
    await restaurarModulos?.();
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
});

async function cuenta(nombre = 'Ana') {
  const u = await crearUsuarioPrueba(Role.USER);
  usuarios.push(u.id);
  const ficha = await db.hermano.create({
    data: { userId: u.id, nombre, apellidos: 'Prueba', fechaNacimiento: new Date(Date.UTC(1980, 0, 1)), activo: true, esTitular: true, sexo: 'MUJER' },
  });
  return { ...u, ficha, cookie: `${COOKIE_HERMANO}=${generateToken(u.id, Role.USER, false, 'hermanos')}` };
}

async function pedir(ruta: string, cookie: string, metodo = 'GET', cuerpo?: unknown) {
  return fetch(`${baseUrl}/api${ruta}`, {
    method: metodo,
    headers: { Cookie: cookie, ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(cuerpo !== undefined && { body: JSON.stringify(cuerpo) }),
  });
}

/** Un correo cualquiera ya compuesto: lo que importa es dónde acaba, no qué dice. */
const correo = () => EmailService.correoJustificantePago('Ana', 'MUJER', {
  total: '30,00 €', metodo: 'Bizum', fecha: '20/10/2026 18:00', pedido: '000123', lineas: [{ concepto: 'Cuota 2026', detalle: 'Ana Prueba', importe: '30,00 €' }],
});

test('el aviso sale por correo y queda en Avisos para leerlo entero; a otra cuenta, no', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const ana = await cuenta();
  const otra = await cuenta();

  assert.equal(await AvisosPersonalesService.ponerEnCola('prueba-avisos', 'Prueba', [{ userId: ana.id, email: ana.email, correo: await correo() }]), 1);
  await colaTerminada();
  assert.ok(enviados.some((e) => e.to === ana.email), 'por correo');

  const lista = await (await pedir('/hermanos/mis-avisos', ana.cookie)).json() as { id: number; asunto: string }[];
  assert.equal(lista.length, 1);
  assert.match(lista[0].asunto, /^Justificante de su pago/);

  // Entero, con el escudo dentro (una imagen `cid:` no se ve en el navegador); a otra cuenta, no.
  const entero = await (await pedir(`/hermanos/mis-avisos/personales/${lista[0].id}`, ana.cookie)).json() as { html: string };
  assert.match(entero.html, /Cuota 2026/);
  assert.doesNotMatch(entero.html, /src="cid:/);
  assert.equal((await pedir(`/hermanos/mis-avisos/personales/${lista[0].id}`, otra.cookie)).status, 404);
  await db.correoEnCola.deleteMany({ where: { lote: 'prueba-avisos' } });
});

test('la víspera de la cita, a partir de las diez, un recordatorio por cuenta con todas sus fichas, y solo una vez', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // Un día lejano, para no tocar las citas de verdad que haya en la base de pruebas.
  const ahora = new Date(Date.UTC(2099, 2, 10, 10, 30)); // 11:30 en Madrid
  const turno = await db.turno.create({
    data: {
      fecha: new Date(Date.UTC(2099, 2, 11)), horaInicio: new Date(Date.UTC(2099, 2, 11, 18)), horaFin: new Date(Date.UTC(2099, 2, 11, 20)),
      capacidadEstimada: 100, salidaId: await idDeSalida(),
    },
  });
  turnos.push(turno.id);

  const familia = await cuenta('Ana');
  const hijo = await db.hermano.create({ data: { userId: familia.id, nombre: 'Pablo', apellidos: 'Prueba', fechaNacimiento: new Date(Date.UTC(2012, 0, 1)), activo: true } });
  const otra = await cuenta('Luisa');
  const deHoy = await cuenta('Marta');
  await db.cita.createMany({
    data: [
      { turnoId: turno.id, hermanoId: familia.ficha.id },
      { turnoId: turno.id, hermanoId: hijo.id },
      { turnoId: turno.id, hermanoId: otra.ficha.id },
      // Pedida el mismo día: quien acaba de elegirlo lo tiene delante.
      { turnoId: turno.id, hermanoId: deHoy.ficha.id, createdAt: ahora },
    ],
  });

  assert.equal(await recordarCitas(new Date(Date.UTC(2099, 2, 10, 7))), 0, 'a las ocho de la mañana, todavía no');
  assert.equal(await recordarCitas(ahora), 2, 'uno para la familia y otro para Luisa');
  assert.equal(await recordarCitas(ahora), 0, 'la segunda vuelta no repite');
  await colaTerminada();

  const enCola = await db.correoEnCola.findMany({ where: { lote: 'cita:2099-03-11' } });
  assert.equal(enCola.find((c) => c.userId === familia.id)?.estado, 'ENVIADO');
  assert.equal(enCola.find((c) => c.userId === otra.id)?.estado, 'ENVIADO');
  assert.ok(!enCola.some((c) => c.userId === deHoy.id));

  const aviso = await db.avisoPersonal.findFirstOrThrow({ where: { userId: familia.id, uso: 'cita_manana' } });
  assert.match(aviso.html, /Ana Prueba[\s\S]*Pablo Prueba/);
  assert.match(aviso.html, /miércoles, 11 de marzo/);
  assert.match(aviso.html, /de 19:00 a 21:00/);
  assert.equal(await db.cita.count({ where: { turnoId: turno.id, recordadaEl: null } }), 1, 'solo queda sin recordar la de hoy');
});

test('si preparar el recordatorio falla, las citas no se dan por recordadas y la siguiente vuelta lo manda', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const ahora = new Date(Date.UTC(2099, 3, 14, 10, 30));
  const turno = await db.turno.create({
    data: {
      fecha: new Date(Date.UTC(2099, 3, 15)), horaInicio: new Date(Date.UTC(2099, 3, 15, 17)), horaFin: new Date(Date.UTC(2099, 3, 15, 19)),
      capacidadEstimada: 100, salidaId: await idDeSalida(),
    },
  });
  turnos.push(turno.id);
  const ana = await cuenta('Ana');
  await db.cita.create({ data: { turnoId: turno.id, hermanoId: ana.ficha.id } });

  const fallo = t.mock.method(EmailService, 'correoRecordatorioCita', async () => { throw new Error('la plantilla no se pudo leer'); });
  await assert.rejects(recordarCitas(ahora), /la plantilla no se pudo leer/);
  assert.equal(await db.cita.count({ where: { turnoId: turno.id, recordadaEl: null } }), 1, 'la cita sigue sin recordar');

  fallo.mock.restore();
  assert.equal(await recordarCitas(ahora), 1);
  await colaTerminada();
  assert.equal(await db.correoEnCola.count({ where: { lote: 'cita:2099-04-15', userId: ana.id } }), 1);
});

test('al borrar la cuenta se va lo que esperaba en la cola y su dirección del registro de envíos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const ana = await cuenta('Ana');
  const comunicado = await db.comunicado.create({ data: { tipo: 'BOLETIN', asunto: 'Boletín de prueba', cuerpo: '<p>x</p>', segmento: {}, estado: 'ENVIANDO' } });
  const otro = await db.comunicado.create({ data: { tipo: 'BOLETIN', asunto: 'Boletín anterior', cuerpo: '<p>x</p>', segmento: {}, estado: 'ENVIADO' } });
  try {
    await db.comunicadoEnvio.create({ data: { comunicadoId: comunicado.id, email: ana.email, nombre: 'Ana', userId: ana.id } });
    await db.comunicadoEnvio.create({ data: { comunicadoId: otro.id, email: ana.email, nombre: 'Ana', userId: ana.id, estado: 'ENVIADO', enviadoEl: new Date() } });
    await db.correoEnCola.create({ data: { lote: 'prueba-supresion', titulo: 'Prueba', userId: ana.id, para: ana.email, asunto: 'Aviso', html: '<p>Ana Prueba</p>', uso: 'prueba' } });
    await db.correoEnCola.create({ data: { lote: 'prueba-supresion', titulo: 'Prueba', userId: ana.id, para: ana.email, asunto: 'Aviso', html: '<p>Ana Prueba</p>', uso: 'prueba', estado: 'ENVIADO', enviadoEl: new Date() } });

    // Antes de irse, «Descargar mis datos» trae también los comunicados (art. 15).
    const datos = await (await pedir('/auth/mis-datos', ana.cookie)).json() as { comunicadosRecibidos: { comunicado: { asunto: string } }[]; pagosEnLinea: unknown[] };
    assert.deepEqual(datos.comunicadosRecibidos.map((c) => c.comunicado.asunto).sort(), ['Boletín anterior', 'Boletín de prueba']);
    assert.deepEqual(datos.pagosEnLinea, []);

    const res = await pedir('/auth/mi-cuenta', ana.cookie, 'DELETE', { password: PASSWORD_PRUEBA });
    assert.equal(res.status, 200, await res.clone().text());

    assert.equal(await db.comunicadoEnvio.count({ where: { userId: ana.id, estado: 'PENDIENTE' } }), 0, 'el boletín pendiente ya no sale');
    assert.equal((await db.comunicado.findUniqueOrThrow({ where: { id: comunicado.id } })).estado, 'ENVIADO', 'y el comunicado no se queda «enviándose»');
    const enviado = await db.comunicadoEnvio.findFirstOrThrow({ where: { comunicadoId: otro.id, userId: ana.id } });
    assert.ok(!enviado.email.includes(ana.email) && enviado.nombre === null, 'el registro de envíos ya no dice quién era');
    const cola = await db.correoEnCola.findMany({ where: { lote: 'prueba-supresion' } });
    assert.deepEqual(cola.map((c) => c.estado), ['ENVIADO']);
    assert.ok(cola[0].para !== ana.email && cola[0].html === '');
  } finally {
    await db.comunicado.deleteMany({ where: { id: { in: [comunicado.id, otro.id] } } });
    await db.correoEnCola.deleteMany({ where: { lote: 'prueba-supresion' } });
  }
});
