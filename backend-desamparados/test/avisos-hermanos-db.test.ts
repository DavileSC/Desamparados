// Los avisos al móvil del área de hermanos y la cola de correos con tope
// diario (traspaso-2026-10-14 §5): activar y quitar móviles por la API, un
// aviso de la Junta que llega al móvil en vez de por correo, el correo de
// reserva si el móvil ya no existe, el tope del día y la página «Avisos».
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, afterEach, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role, TipoComunicado } from '@prisma/client';
import webpush from 'web-push';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_HERMANO } from '../src/utils/cookies.js';
import { avisosDePrueba, fijarEnvioDePrueba } from '../src/services/push.js';
import { ComunicadosService, envioTerminado } from '../src/services/comunicados.service.js';
import { colaTerminada, despertarCola, enviadosHoy, resumenDeEnvios } from '../src/services/correos/cola.js';
import { ponerTransporte } from '../src/services/correos/envio.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { encenderModulos } from './fixtures/modulos.js';
import { SIN_DB } from './fixtures/sin-db.js';

let server: Server;
let baseUrl: string;
let dbDisponible = false;
let restaurarModulos: (() => Promise<void>) | undefined;
const entornoAntes = { ...process.env };
const usuarios: number[] = [];
const comunicados: number[] = [];
const enviados: string[] = [];

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
  if (dbDisponible) restaurarModulos = await encenderModulos(['avisos-a-los-hermanos', 'comunicados', 'area-hermanos']);
  // Un transporte de mentira que apunta a quién se manda.
  ponerTransporte({ sendMail: async (correo) => { enviados.push(correo.to); return {}; } });
});

afterEach(() => {
  fijarEnvioDePrueba();
  delete process.env.CORREOS_MASIVOS_POR_DIA;
});

after(async () => {
  ponerTransporte(undefined);
  if (dbDisponible) {
    await db.comunicado.deleteMany({ where: { id: { in: comunicados } } });
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

/** Un hermano con su ficha activa en un pueblo propio de la prueba, para que el segmento sea solo suyo. */
async function hermano(pueblo: string) {
  const u = await crearUsuarioPrueba(Role.USER);
  usuarios.push(u.id);
  await db.hermano.create({
    data: { userId: u.id, nombre: 'Ana', apellidos: 'Prueba', fechaNacimiento: new Date(Date.UTC(1980, 0, 1)), activo: true, esTitular: true, poblacion: pueblo },
  });
  return { ...u, cookie: `${COOKIE_HERMANO}=${generateToken(u.id, Role.USER, false, 'hermanos')}` };
}

function suscripcion() {
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${crypto.randomBytes(12).toString('hex')}`,
    expirationTime: null,
    keys: { p256dh: crypto.randomBytes(65).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') },
  };
}

async function pedir(ruta: string, cookie: string, metodo = 'GET', cuerpo?: unknown) {
  return fetch(`${baseUrl}/api${ruta}`, {
    method: metodo,
    headers: { Cookie: cookie, ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
}

async function activar(h: { cookie: string }, sus = suscripcion()) {
  const res = await pedir('/hermanos/mis-avisos-movil', h.cookie, 'POST', { nombre: 'Android · Chrome', suscripcion: sus });
  assert.equal(res.status, 201, await res.clone().text());
  return (await res.json()) as { id: number; nombre: string };
}

/** Un aviso de la Junta solo al pueblo de la prueba, ya repartido. */
async function avisoAlPueblo(pueblo: string, tipo: TipoComunicado = TipoComunicado.AVISO) {
  const c = await ComunicadosService.crear({ tipo, asunto: 'Reparto de túnicas', cuerpo: '<p>El sábado se reparten las túnicas en la casa de hermandad.</p>', segmento: { poblacion: pueblo } });
  comunicados.push(c.id);
  await ComunicadosService.enviar(c.id);
  await envioTerminado();
  return c;
}

test('activar, ver y quitar los avisos del móvil; el mismo navegador con otra cuenta pasa a la nueva', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const pueblo = `Pueblo-${crypto.randomUUID()}`;
  const ana = await hermano(pueblo);
  const luis = await hermano(pueblo);

  const vacio = await (await pedir('/hermanos/mis-avisos-movil', ana.cookie)).json() as { disponible: boolean; clavePublica: string | null; moviles: unknown[] };
  assert.equal(vacio.disponible, true);
  assert.equal(vacio.clavePublica, process.env.VAPID_PUBLICA);
  assert.deepEqual(vacio.moviles, []);

  const sus = suscripcion();
  const movil = await activar(ana, sus);
  const lista = await (await pedir('/hermanos/mis-avisos-movil', ana.cookie)).json() as { moviles: { id: number; nombre: string }[] };
  assert.deepEqual(lista.moviles.map((m) => m.nombre), ['Android · Chrome']);

  // Luis entra en el mismo navegador: los avisos son ya para él.
  await activar(luis, sus);
  assert.equal(await db.movilDeAvisos.count({ where: { userId: ana.id } }), 0);
  assert.equal((await pedir(`/hermanos/mis-avisos-movil/${movil.id}`, ana.cookie, 'DELETE')).status, 404, 'ese móvil ya no es de Ana');

  const deLuis = await db.movilDeAvisos.findFirstOrThrow({ where: { userId: luis.id } });
  assert.equal((await pedir(`/hermanos/mis-avisos-movil/${deLuis.id}`, ana.cookie, 'DELETE')).status, 404, 'no se quitan los de otro');
  assert.equal((await pedir(`/hermanos/mis-avisos-movil/${deLuis.id}`, luis.cookie, 'DELETE')).status, 204);

  const malo = await pedir('/hermanos/mis-avisos-movil', ana.cookie, 'POST', { nombre: 'x', suscripcion: { ...suscripcion(), endpoint: 'https://ejemplo.test/push' } });
  assert.equal(malo.status, 400, 'solo servicios de avisos conocidos');
});

test('un aviso de la Junta llega al móvil de quien lo tiene y por correo a los demás; el boletín, siempre por correo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const pueblo = `Pueblo-${crypto.randomUUID()}`;
  const conMovil = await hermano(pueblo);
  const sinMovil = await hermano(pueblo);
  await activar(conMovil);
  const antes = avisosDePrueba.length;

  const c = await avisoAlPueblo(pueblo);
  const envios = await db.comunicadoEnvio.findMany({ where: { comunicadoId: c.id } });
  assert.equal(envios.find((e) => e.userId === conMovil.id)?.estado, 'MOVIL');
  assert.equal(envios.find((e) => e.userId === sinMovil.id)?.estado, 'ENVIADO');
  assert.ok(!enviados.includes(conMovil.email), 'sin correo para quien lo recibió en el móvil');
  assert.ok(enviados.includes(sinMovil.email));
  assert.equal((await db.comunicado.findUniqueOrThrow({ where: { id: c.id } })).estado, 'ENVIADO');

  const aviso = avisosDePrueba.slice(antes).find((a) => a.aviso.tipo === 'aviso');
  assert.ok(aviso);
  assert.equal(aviso!.aviso.url, `/area-hermano/avisos/${c.id}`);
  assert.equal(aviso!.aviso.titulo, 'Reparto de túnicas');

  // En la página «Avisos» del área, entero; a quien no lo recibió, no.
  const lista = await (await pedir('/hermanos/mis-avisos', conMovil.cookie)).json() as { id: number; extracto: string }[];
  assert.ok(lista.some((a) => a.id === c.id && a.extracto.startsWith('El sábado')));
  const entero = await (await pedir(`/hermanos/mis-avisos/${c.id}`, sinMovil.cookie)).json() as { cuerpo: string };
  assert.match(entero.cuerpo, /túnicas/);
  const otro = await hermano(`Otro-${crypto.randomUUID()}`);
  assert.equal((await pedir(`/hermanos/mis-avisos/${c.id}`, otro.cookie)).status, 404);

  const boletin = await avisoAlPueblo(pueblo, TipoComunicado.BOLETIN).catch(() => null);
  // Las fichas de la prueba no están suscritas al boletín: no hay a quién mandarlo.
  assert.equal(boletin, null);
  await db.hermano.updateMany({ where: { userId: { in: [conMovil.id, sinMovil.id] } }, data: { boletin: true } });
  const b = await avisoAlPueblo(pueblo, TipoComunicado.BOLETIN);
  const deBoletin = await db.comunicadoEnvio.findMany({ where: { comunicadoId: b.id } });
  assert.ok(deBoletin.every((e) => e.estado === 'ENVIADO' && !e.porMovil), 'el boletín no va al móvil');
});

test('si el móvil ya no existe, se borra y el aviso sale por correo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const pueblo = `Pueblo-${crypto.randomUUID()}`;
  const h = await hermano(pueblo);
  await activar(h);
  fijarEnvioDePrueba(async () => 'muerta');

  const c = await avisoAlPueblo(pueblo);
  const envio = await db.comunicadoEnvio.findFirstOrThrow({ where: { comunicadoId: c.id, userId: h.id } });
  assert.equal(envio.estado, 'ENVIADO');
  assert.equal(envio.porMovil, false);
  assert.equal(await db.movilDeAvisos.count({ where: { userId: h.id } }), 0);
  assert.ok(enviados.includes(h.email));
});

test('con el tope del día alcanzado, lo que falta espera y la lista lo dice', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const lote = `prueba:${crypto.randomUUID()}`.slice(0, 60);
  // Muy antiguos: salen antes que cualquier otra cosa que espere en la base de pruebas.
  const viejo = new Date(Date.UTC(2000, 0, 1));
  await db.correoEnCola.createMany({
    data: [1, 2, 3].map((n) => ({ lote, titulo: 'Prueba del tope', para: `tope-${n}-${crypto.randomUUID()}@ejemplo.test`, asunto: 'Tope', html: '<p>Tope</p>', uso: 'prueba', creadoEn: viejo })),
  });
  try {
    await colaTerminada();
    process.env.CORREOS_MASIVOS_POR_DIA = String((await enviadosHoy()) + 1);
    await despertarCola();
    await colaTerminada();

    const filas = await db.correoEnCola.findMany({ where: { lote }, orderBy: { id: 'asc' } });
    assert.deepEqual(filas.map((f) => f.estado), ['ENVIADO', 'PENDIENTE', 'PENDIENTE']);
    const envio = (await resumenDeEnvios()).envios.find((e) => e.clave === lote);
    assert.equal(envio?.estado, 'SIGUE_MANANA');
    assert.equal(envio?.enviados, 1);
    assert.equal(envio?.pendientes, 2);
  } finally {
    await db.correoEnCola.deleteMany({ where: { lote } });
  }
});

