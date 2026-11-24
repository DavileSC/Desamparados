// Los rebotes de correo contra MariaDB: el informe que llega al buzón marca la
// dirección y pasa a «Rebotó» el último envío; la cola ya no le escribe; la
// ficha del censo lo dice y se puede quitar. Y la baja en un clic de Gmail.
// Fichas con una población inventada, como en comunicados-db.test.ts, un
// transporte de correo de mentira y un buzón de mentira.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoEnvio, Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { ponerTransporte } from '../src/services/correos/envio.js';
import { ComunicadosService, envioTerminado } from '../src/services/comunicados.service.js';
import { CARPETA_DE_REBOTES, revisarBuzon, type BuzonAbierto } from '../src/services/correos/buzon-de-rebotes.js';
import { RebotesService } from '../src/services/correos/rebotes.service.js';
import { informeDeRebote } from './fixtures/rebotes.js';
import { tokenDeBaja } from '../src/domain/comunicados.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;
const enviados: { to: string; headers?: Record<string, string> }[] = [];
const pausaPrevia = process.env.COMUNICADOS_PAUSA_MS;

before(async () => {
  process.env.COMUNICADOS_PAUSA_MS = '0';
  ponerTransporte({ sendMail: async (c) => { enviados.push(c as { to: string; headers?: Record<string, string> }); } });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  ponerTransporte(undefined);
  if (pausaPrevia === undefined) delete process.env.COMUNICADOS_PAUSA_MS;
  else process.env.COMUNICADOS_PAUSA_MS = pausaPrevia;
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

/** Un buzón de mentira con estos correos sin leer (UID 1, 2…); apunta qué se hizo con cada uno. */
function buzonCon(correos: (string | null)[]) {
  const hecho = { apartados: [] as number[], carpeta: '', leidos: [] as number[], cerrado: false };
  const buzon: BuzonAbierto = {
    noLeidos: async () => correos.map((_, i) => i + 1),
    fuente: async (uid) => correos[uid - 1],
    apartar: async (uids, carpeta) => { hecho.apartados.push(...uids); hecho.carpeta = carpeta; },
    marcarLeidos: async (uids) => { hecho.leidos.push(...uids); },
    cerrar: async () => { hecho.cerrado = true; },
  };
  return { abrir: async () => buzon, hecho };
}

async function escenario() {
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const familia = await crearUsuarioPrueba(Role.USER);
  const pueblo = `Villarrebote${Date.now()}`;
  const sufijo = `${Date.now()}${process.pid}`;
  const correo = (nombre: string) => `${nombre}.${sufijo}@ejemplo.test`;
  const hermanos: number[] = [];
  const comunicados: number[] = [];
  const ficha = async (nombre: string, email: string | null, boletin = true) => {
    const h = await db.hermano.create({
      data: { userId: familia.id, nombre, apellidos: 'Rebote', poblacion: pueblo, fechaNacimiento: new Date('1980-01-01T00:00:00Z'), email, boletin },
    });
    hermanos.push(h.id);
    return h;
  };
  const boletin = async () => {
    const c = await ComunicadosService.crear({ tipo: 'BOLETIN', asunto: 'Cultos', cuerpo: '<p>Os esperamos.</p>', segmento: { poblacion: pueblo } }, { userId: staff.id });
    comunicados.push(c.id);
    await ComunicadosService.enviar(c.id, { userId: staff.id });
    await envioTerminado();
    return c.id;
  };
  const recoger = async () => {
    await db.correoQueRebota.deleteMany({ where: { email: { endsWith: `.${sufijo}@ejemplo.test` } } });
    await db.comunicado.deleteMany({ where: { id: { in: comunicados } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    await db.auditLog.deleteMany({ where: { OR: [{ userId: staff.id }, { action: { in: ['CORREO_REBOTA', 'BOLETIN_BAJA'] }, createdAt: { gte: new Date(Date.now() - 120_000) } }] } });
    await borrarUsuarioPrueba(familia.id);
    await borrarUsuarioPrueba(staff.id);
  };
  const cookie = { Cookie: `${COOKIE_CMS}=${generateToken(staff.id, Role.SECRETARIA)}` };
  return { staff, pueblo, correo, ficha, boletin, recoger, cookie };
}

test('en el buzón, los rebotes se apuntan y se apartan; lo demás se marca leído y se queda', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const sufijo = `${Date.now()}${process.pid}`;
  const perdida = `perdida.${sufijo}@ejemplo.test`;
  const { abrir, hecho } = buzonCon([
    'From: Luis <luis@ejemplo.test>\r\nSubject: Una duda\r\n\r\n¿A qué hora es el triduo?\r\n',
    informeDeRebote([{ email: perdida, estado: '5.1.1' }]),
    // No se pudo bajar: se deja sin tocar para la vuelta siguiente.
    null,
  ]);
  try {
    assert.equal(await revisarBuzon(abrir), 1);
    assert.deepEqual(hecho, { apartados: [2], carpeta: CARPETA_DE_REBOTES, leidos: [1], cerrado: true });
    assert.equal((await db.correoQueRebota.findUniqueOrThrow({ where: { email: perdida } })).motivo, 'INVALIDO');
  } finally {
    await db.correoQueRebota.deleteMany({ where: { email: perdida } });
    await db.auditLog.deleteMany({ where: { action: 'CORREO_REBOTA', createdAt: { gte: new Date(Date.now() - 120_000) } } });
  }
});

test('un fallo a mitad de vuelta cierra el buzón igualmente', async () => {
  let cerrado = false;
  const buzon: BuzonAbierto = {
    noLeidos: async () => [1],
    fuente: async () => { throw new Error('conexión cortada'); },
    apartar: async () => {}, marcarLeidos: async () => {},
    cerrar: async () => { cerrado = true; },
  };
  await assert.rejects(revisarBuzon(async () => buzon), /conexión cortada/);
  assert.ok(cerrado);
});

test('un rebote marca la dirección, el envío pasa a «Rebotó» y el siguiente boletín ya no le escribe', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const ana = await e.ficha('Ana', e.correo('ana'));
    await e.ficha('Luis', e.correo('luis'));
    const primero = await e.boletin();
    assert.equal(enviados.filter((c) => c.to === e.correo('ana')).length, 1);

    // El informe trae la dirección en mayúsculas.
    await revisarBuzon(buzonCon([informeDeRebote([{ email: e.correo('ana').toUpperCase(), estado: '5.2.1', diagnostico: 'smtp; 550 5.2.1 Mailbox disabled' }])]).abrir);

    const marca = await db.correoQueRebota.findUniqueOrThrow({ where: { email: e.correo('ana') } });
    assert.equal(marca.motivo, 'REBOTE');
    assert.equal(marca.detalle, '550 5.2.1 Mailbox disabled');
    const envio = await db.comunicadoEnvio.findFirstOrThrow({ where: { comunicadoId: primero, email: e.correo('ana') } });
    assert.equal(envio.estado, EstadoEnvio.REBOTADO);
    const lista = (await ComunicadosService.listar()).find((c) => c.id === primero)!;
    assert.deepEqual([lista.envios.enviados, lista.envios.rebotados], [1, 1]);

    // El siguiente no le gasta cupo: queda como rebotado sin salir.
    const antes = enviados.length;
    const segundo = await e.boletin();
    assert.deepEqual(enviados.slice(antes).map((c) => c.to), [e.correo('luis')]);
    assert.equal((await db.comunicadoEnvio.findFirstOrThrow({ where: { comunicadoId: segundo, email: e.correo('ana') } })).estado, EstadoEnvio.REBOTADO);

    // La ficha lo dice, el filtro del censo la encuentra y Secretaría quita la marca.
    const ficha = await (await fetch(`${baseUrl}/api/hermanos/admin/${ana.id}`, { headers: e.cookie })).json() as { correoRebota: { motivo: string } | null };
    assert.equal(ficha.correoRebota?.motivo, 'REBOTE');
    const busqueda = await (await fetch(`${baseUrl}/api/hermanos/admin/search?q=Rebote&correo=rebota`, { headers: e.cookie })).json() as { data: { id: number }[] };
    assert.deepEqual(busqueda.data.map((h) => h.id), [ana.id]);
    assert.equal((await fetch(`${baseUrl}/api/hermanos/admin/${ana.id}/correo-rebota`, { method: 'DELETE', headers: e.cookie })).status, 200);
    assert.equal(await db.correoQueRebota.count({ where: { email: e.correo('ana') } }), 0);
    assert.equal((await fetch(`${baseUrl}/api/hermanos/admin/${ana.id}/correo-rebota`, { method: 'DELETE', headers: e.cookie })).status, 409);
  } finally {
    await e.recoger();
  }
});

// Ningún servidor de hoy avisa de quejas ni de bajas (lo hacía Brevo), pero el
// registro las sigue entendiendo: las marcas SPAM de antes siguen en la base.
test('una queja de spam marca la dirección y la da de baja del boletín; una baja solo quita el boletín', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const eva = await e.ficha('Eva', e.correo('eva'));
    const otra = await e.ficha('Otra', e.correo('otra'));
    await RebotesService.registrar([
      { email: e.correo('eva'), motivo: 'SPAM', bajaDelBoletin: true, detalle: null },
      { email: e.correo('otra'), motivo: null, bajaDelBoletin: true, detalle: null },
    ]);
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: eva.id } })).boletin, false);
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: otra.id } })).boletin, false);
    assert.equal((await db.correoQueRebota.findUniqueOrThrow({ where: { email: e.correo('eva') } })).motivo, 'SPAM');
    // Darse de baja no es que el correo no llegue: no se marca.
    assert.equal(await db.correoQueRebota.count({ where: { email: e.correo('otra') } }), 0);
  } finally {
    await e.recoger();
  }
});

test('el boletín lleva la baja en un clic, y el POST de Gmail da de baja; un GET solo lleva a la web', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const ana = await e.ficha('Ana', e.correo('ana'));
    const antes = enviados.length;
    await e.boletin();
    const correo = enviados.slice(antes).find((c) => c.to === e.correo('ana'))!;
    assert.equal(correo.headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    const url = new URL(/^<(.+)>$/.exec(correo.headers!['List-Unsubscribe'])![1]);
    const enEstaApi = `${baseUrl}${url.pathname}${url.search}`;

    const get = await fetch(enEstaApi, { redirect: 'manual' });
    assert.equal(get.status, 303);
    assert.match(get.headers.get('location') ?? '', /\/boletin\/baja\?t=/);
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: ana.id } })).boletin, true, 'un GET no da de baja');

    const post = await fetch(enEstaApi, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
    assert.equal(post.status, 200);
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: ana.id } })).boletin, false);

    const mal = await fetch(`${baseUrl}/api/boletin/baja-directa?t=${encodeURIComponent(tokenDeBaja(e.correo('ana'), 'otro-secreto'))}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
    assert.equal(mal.status, 400);
  } finally {
    await e.recoger();
  }
});
