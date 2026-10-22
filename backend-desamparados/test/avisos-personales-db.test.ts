// Los avisos personales (20-10-2026): lo que va a una sola cuenta se guarda
// para la página Avisos y llega al móvil o, si no tiene, por correo; nunca los
// dos. Y el recordatorio de la cita la víspera, uno por cuenta.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, afterEach, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import webpush from 'web-push';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_HERMANO } from '../src/utils/cookies.js';
import { avisosDePrueba, fijarEnvioDePrueba } from '../src/services/push.js';
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
const entornoAntes = { ...process.env };
const usuarios: number[] = [];
const turnos: number[] = [];
const enviados: { to: string; subject: string }[] = [];

before(async () => {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLICA = publicKey;
  process.env.VAPID_PRIVADA = privateKey;
  process.env.VAPID_CONTACTO = 'mailto:pruebas@ejemplo.test';

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (dbDisponible) restaurarModulos = await encenderModulos(['avisos-a-los-hermanos', 'area-hermanos', 'procesion']);
  ponerTransporte({ sendMail: async (correo) => { enviados.push({ to: correo.to, subject: correo.subject }); return {}; } });
});

afterEach(() => { fijarEnvioDePrueba(); });

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
  for (const nombre of ['VAPID_PUBLICA', 'VAPID_PRIVADA', 'VAPID_CONTACTO']) {
    if (entornoAntes[nombre] === undefined) delete process.env[nombre];
    else process.env[nombre] = entornoAntes[nombre];
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
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
}

async function activarMovil(h: { cookie: string }) {
  const suscripcion = {
    endpoint: `https://fcm.googleapis.com/fcm/send/${crypto.randomBytes(12).toString('hex')}`,
    expirationTime: null,
    keys: { p256dh: crypto.randomBytes(65).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') },
  };
  const res = await pedir('/hermanos/mis-avisos-movil', h.cookie, 'POST', { nombre: 'Android · Chrome', suscripcion });
  assert.equal(res.status, 201, await res.clone().text());
}

const justificante = () => EmailService.correoJustificantePago('Ana', 'MUJER', {
  total: '30,00 €', metodo: 'Bizum', fecha: '20/10/2026 18:00', pedido: '000123', lineas: [{ concepto: 'Cuota 2026', detalle: 'Ana Prueba', importe: '30,00 €' }],
});

test('con móvil, el aviso llega al móvil y no por correo; sin móvil, por correo; los dos quedan en Avisos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const conMovil = await cuenta();
  const sinMovil = await cuenta();
  await activarMovil(conMovil);
  const antes = avisosDePrueba.length;

  await AvisosPersonalesService.mandar({ userId: conMovil.id, email: conMovil.email }, await justificante());
  await AvisosPersonalesService.mandar({ userId: sinMovil.id, email: sinMovil.email }, await justificante());

  assert.ok(!enviados.some((e) => e.to === conMovil.email), 'sin correo para quien lo recibió en el móvil');
  assert.ok(enviados.some((e) => e.to === sinMovil.email && /^Justificante de su pago de 30,00/.test(e.subject)));

  const lista = await (await pedir('/hermanos/mis-avisos', conMovil.cookie)).json() as { id: number; tipo: string; asunto: string; extracto: string }[];
  const mio = lista.find((a) => a.tipo === 'personal');
  assert.ok(mio, 'el justificante está en Avisos');
  assert.match(mio!.asunto, /^Justificante de su pago/);

  const alMovil = avisosDePrueba.slice(antes).find((a) => a.aviso.url === `/area-hermano/avisos/personal/${mio!.id}`);
  assert.ok(alMovil, 'el aviso del móvil abre su página');
  assert.equal(alMovil!.aviso.titulo, mio!.asunto);
  assert.ok(alMovil!.aviso.cuerpo.length > 0 && alMovil!.aviso.cuerpo.length <= 140);

  // Entero, con el escudo dentro (una imagen `cid:` no se ve en el navegador); a otra cuenta, no.
  const entero = await (await pedir(`/hermanos/mis-avisos/personales/${mio!.id}`, conMovil.cookie)).json() as { html: string };
  assert.match(entero.html, /Cuota 2026/);
  assert.doesNotMatch(entero.html, /src="cid:/);
  assert.equal((await pedir(`/hermanos/mis-avisos/personales/${mio!.id}`, sinMovil.cookie)).status, 404);
});

test('si el móvil ya no existe, el aviso sale por correo y sigue en Avisos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const h = await cuenta();
  await activarMovil(h);
  fijarEnvioDePrueba(async () => 'muerta');

  await AvisosPersonalesService.mandar({ userId: h.id, email: h.email }, await justificante());
  assert.ok(enviados.some((e) => e.to === h.email));
  assert.equal(await db.avisoPersonal.count({ where: { userId: h.id } }), 1);
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
  await activarMovil(familia);
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
  assert.equal(enCola.find((c) => c.userId === familia.id)?.estado, 'MOVIL');
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

test('al borrar la cuenta se van sus móviles, lo que esperaba en la cola y su dirección del registro de envíos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const ana = await cuenta('Ana');
  await activarMovil(ana);
  const comunicado = await db.comunicado.create({ data: { tipo: 'BOLETIN', asunto: 'Boletín de prueba', cuerpo: '<p>x</p>', segmento: {}, estado: 'ENVIANDO' } });
  const otro = await db.comunicado.create({ data: { tipo: 'BOLETIN', asunto: 'Boletín anterior', cuerpo: '<p>x</p>', segmento: {}, estado: 'ENVIADO' } });
  try {
    await db.comunicadoEnvio.create({ data: { comunicadoId: comunicado.id, email: ana.email, nombre: 'Ana', userId: ana.id } });
    await db.comunicadoEnvio.create({ data: { comunicadoId: otro.id, email: ana.email, nombre: 'Ana', userId: ana.id, estado: 'ENVIADO', enviadoEl: new Date() } });
    await db.correoEnCola.create({ data: { lote: 'prueba-supresion', titulo: 'Prueba', userId: ana.id, para: ana.email, asunto: 'Aviso', html: '<p>Ana Prueba</p>', uso: 'prueba' } });
    await db.correoEnCola.create({ data: { lote: 'prueba-supresion', titulo: 'Prueba', userId: ana.id, para: ana.email, asunto: 'Aviso', html: '<p>Ana Prueba</p>', uso: 'prueba', estado: 'ENVIADO', enviadoEl: new Date() } });

    // Antes de irse, «Descargar mis datos» trae también los móviles y los comunicados (art. 15).
    const datos = await (await pedir('/auth/mis-datos', ana.cookie)).json() as { usuario: { movilesDeAvisos: { nombre: string; endpoint?: string }[] }; comunicadosRecibidos: { comunicado: { asunto: string } }[]; pagosEnLinea: unknown[] };
    assert.deepEqual(datos.usuario.movilesDeAvisos.map((m) => [m.nombre, m.endpoint]), [['Android · Chrome', undefined]]);
    assert.deepEqual(datos.comunicadosRecibidos.map((c) => c.comunicado.asunto).sort(), ['Boletín anterior', 'Boletín de prueba']);
    assert.deepEqual(datos.pagosEnLinea, []);

    const res = await pedir('/auth/mi-cuenta', ana.cookie, 'DELETE', { password: PASSWORD_PRUEBA });
    assert.equal(res.status, 200, await res.clone().text());

    assert.equal(await db.movilDeAvisos.count({ where: { userId: ana.id } }), 0, 'sin móviles');
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
