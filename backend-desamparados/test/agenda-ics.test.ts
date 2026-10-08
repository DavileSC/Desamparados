// test/agenda-ics.test.ts
//
// «Añadir a mi calendario» y la suscripción a la Agenda: el formato iCalendar
// que se escribe a mano (escapes, líneas partidas, actos de varios días, el
// cambio de hora) y los dos extremos públicos. De paso, el cartel de la
// Agenda pública: sus campos se guardan y se limpian al crear y editar.

import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { calendarioIcs, horario, nombreDeFichero, plegar, textoIcs } from '../src/domain/calendario-ics.js';
import { identidad } from '../src/domain/datos-entidad.js';
import { SIN_DB } from './fixtures/sin-db.js';

const actualizado = new Date('2026-09-20T10:00:00Z');
// Horas de Madrid escritas en UTC: en noviembre, una hora menos.
const triduo = {
  id: 7, title: 'Solemne triduo', dedicatoria: 'en honor de Nuestra Señora de los Desamparados',
  description: 'Santo rosario, ejercicio del triduo y santa misa.', location: 'Parroquia de los Padres Pasionistas, Málaga',
  startDate: new Date('2026-11-03T18:00:00Z'), endDate: new Date('2026-11-05T19:00:00Z'), updatedAt: actualizado,
};

// Una sola desconexión, al final de todo: la base se usa en dos bloques.
after(() => db.$disconnect());

describe('el calendario en formato iCalendar', () => {
  test('un triduo es un acto de una hora repetido tres días, en hora de Madrid', () => {
    assert.deepEqual(horario(triduo), { desde: '20261103T190000', hasta: '20261103T200000', dias: 3 });
    const ics = calendarioIcs([triduo], { urlWeb: 'https://desamparados.example', autor: 'Grupo de prueba' });
    assert.match(ics, /DTSTART;TZID=Europe\/Madrid:20261103T190000\r\n/);
    assert.match(ics, /DTEND;TZID=Europe\/Madrid:20261103T200000\r\n/);
    assert.match(ics, /RRULE:FREQ=DAILY;COUNT=3\r\n/);
    assert.match(ics, /UID:evento-7@desamparados\.example\r\n/);
    assert.match(ics, /URL:https:\/\/desamparados\.example\/agenda\r\n/);
    assert.match(ics, /BEGIN:VTIMEZONE[\s\S]*TZID:Europe\/Madrid/);
  });

  test('un quinario que cruza el cambio de hora de marzo sigue a las 20:00 cada día', () => {
    // Del 26 al 30 de marzo de 2027: el 28 cambia la hora. En UTC, el inicio es 19:00Z y el final 18:00Z (ya en verano).
    const quinario = { ...triduo, startDate: new Date('2027-03-26T19:00:00Z'), endDate: new Date('2027-03-30T19:00:00Z') };
    assert.deepEqual(horario(quinario), { desde: '20270326T200000', hasta: '20270326T210000', dias: 5 });
  });

  test('sin final, dura una hora; con final el mismo día, hasta esa hora', () => {
    const suelto = { startDate: new Date('2026-10-24T18:00:00Z'), endDate: null };
    assert.deepEqual(horario(suelto), { desde: '20261024T200000', hasta: '20261024T210000', dias: 1 });
    const reparto = { startDate: new Date('2026-10-13T16:00:00Z'), endDate: new Date('2026-10-13T19:00:00Z') };
    assert.deepEqual(horario(reparto), { desde: '20261013T180000', hasta: '20261013T210000', dias: 1 });
  });

  test('escapa comas, puntos y coma y saltos de línea', () => {
    assert.equal(textoIcs('Rosario; misa, y\nbesamanos'), 'Rosario\\; misa\\, y\\nbesamanos');
    const ics = calendarioIcs([triduo], { urlWeb: 'https://desamparados.example', autor: 'Grupo de prueba' });
    assert.match(ics, /LOCATION:Parroquia de los Padres Pasionistas\\, Málaga/);
  });

  test('parte las líneas largas a 75 octetos, contando las tildes como dos', () => {
    const larga = `SUMMARY:${'Señora '.repeat(20)}`;
    const plegada = plegar(larga);
    for (const trozo of plegada.split('\r\n')) assert.ok(Buffer.byteLength(trozo, 'utf8') <= 75, trozo);
    assert.equal(plegada.split('\r\n').map((t, i) => (i ? t.slice(1) : t)).join(''), larga);
  });

  test('la dedicatoria va en el título y el calendario de suscripción lleva su nombre', () => {
    const ics = calendarioIcs([triduo], { urlWeb: 'https://desamparados.example', nombre: 'Agenda', autor: 'Grupo de prueba' });
    assert.match(ics.replace(/\r\n /g, ''), /SUMMARY:Solemne triduo en honor de Nuestra Señora de los Desamparados/);
    assert.match(ics, /X-WR-CALNAME:Agenda\r\n/);
    assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:PT12H/);
  });

  test('el nombre del fichero va sin tildes ni signos', () => {
    assert.equal(nombreDeFichero('Besamanos a la Sagrada Titular'), 'besamanos-a-la-sagrada-titular.ics');
    assert.equal(nombreDeFichero('¡¿?!'), 'acto.ics');
  });
});

describe('los calendarios por HTTP y el cartel', () => {
  let server: Server;
  let baseUrl: string;
  let dbDisponible = false;
  let secretaria = 0;
  const creados: number[] = [];
  const marca = `Prueba ics ${Date.now()}`;

  before(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    dbDisponible = await db.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    if (!dbDisponible) return;
    secretaria = (await crearUsuarioPrueba(Role.SECRETARIA)).id;
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
    creados.push((await db.evento.create({ data: { title: `${marca}, mañana`, startDate: manana, type: 'CULTO', location: 'Parroquia' } })).id);
  });

  after(async () => {
    server.close();
    if (dbDisponible) {
      await db.evento.deleteMany({ where: { id: { in: creados } } });
      await borrarUsuarioPrueba(secretaria);
    }
  });

  const conSesion = (ruta: string, init: RequestInit = {}) => fetch(`${baseUrl}/api/events${ruta}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Cookie: `${COOKIE_CMS}=${generateToken(secretaria, Role.SECRETARIA)}` },
  });

  test('un acto se descarga como .ics, sin sesión', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await fetch(`${baseUrl}/api/events/${creados[0]}/ics`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /^text\/calendar/);
    assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename="prueba-ics-\d+-manana\.ics"/);
    const cuerpo = await res.text();
    assert.match(cuerpo, /^BEGIN:VCALENDAR\r\n/);
    assert.match(cuerpo, new RegExp(`UID:evento-${creados[0]}@`));
  });

  test('uno que no existe da 404', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await fetch(`${baseUrl}/api/events/999999999/ics`)).status, 404);
  });

  test('la suscripción trae lo que viene, con el nombre del calendario', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await fetch(`${baseUrl}/api/events/calendario.ics`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /^text\/calendar/);
    const cuerpo = await res.text();
    assert.ok(cuerpo.includes(`X-WR-CALNAME:Agenda · ${identidad.nombre}`), 'el calendario lleva el nombre de la corporación');
    assert.match(cuerpo, new RegExp(`UID:evento-${creados[0]}@`));
  });

  test('el cartel se guarda al crear, con los textos limpios, y la lectura pública lo trae', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await conSesion('', {
      method: 'POST',
      body: JSON.stringify({
        title: `${marca} triduo`, startDate: new Date(Date.now() + 2 * 86400000).toISOString(), type: 'CULTO',
        cartel: true, dedicatoria: '  en honor de Nuestra Señora  ', fotoCartel: '',
      }),
    });
    assert.equal(res.status, 201);
    const creado = await res.json() as { id: number; cartel: boolean; dedicatoria: string | null; fotoCartel: string | null };
    creados.push(creado.id);
    assert.equal(creado.cartel, true);
    assert.equal(creado.dedicatoria, 'en honor de Nuestra Señora');
    assert.equal(creado.fotoCartel, null);

    const { data } = await (await fetch(`${baseUrl}/api/events?limit=100`)).json() as { data: { id: number; cartel: boolean; dedicatoria: string | null }[] };
    const publico = data.find((e) => e.id === creado.id);
    assert.equal(publico?.cartel, true);
    assert.equal(publico?.dedicatoria, 'en honor de Nuestra Señora');
  });

  test('editar sin tocar el cartel lo deja como estaba; con null, lo quita', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const id = creados.at(-1)!;
    await conSesion(`/${id}`, { method: 'PUT', body: JSON.stringify({ title: `${marca} triduo cambiado` }) });
    let evento = await db.evento.findUniqueOrThrow({ where: { id } });
    assert.equal(evento.cartel, true);
    assert.equal(evento.dedicatoria, 'en honor de Nuestra Señora');

    const res = await conSesion(`/${id}`, { method: 'PUT', body: JSON.stringify({ cartel: false, dedicatoria: null, fotoCartel: '/storage/public/cartel.jpg' }) });
    assert.equal(res.status, 200);
    evento = await db.evento.findUniqueOrThrow({ where: { id } });
    assert.equal(evento.cartel, false);
    assert.equal(evento.dedicatoria, null);
    assert.equal(evento.fotoCartel, '/storage/public/cartel.jpg');

    // Una foto de fuera no se admite: acabaría en el src de una imagen de la web.
    assert.equal((await conSesion(`/${id}`, { method: 'PUT', body: JSON.stringify({ fotoCartel: 'https://otro.example/x.jpg' }) })).status, 400);
  });
});

describe('la lectura pública, un triduo a medias', () => {
  let server: Server;
  let baseUrl: string;
  let id = 0;
  before(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    if (!(await db.$queryRaw`SELECT 1`.then(() => true).catch(() => false))) return;
    const dia = 24 * 60 * 60 * 1000;
    id = (await db.evento.create({ data: { title: `Prueba triduo a medias ${Date.now()}`, startDate: new Date(Date.now() - dia), endDate: new Date(Date.now() + dia), type: 'CULTO' } })).id;
  });
  after(async () => {
    server.close();
    if (id) await db.evento.deleteMany({ where: { id } });
  });

  test('empezó ayer y acaba mañana: sigue en la agenda', async (t) => {
    if (!id) return t.skip(SIN_DB);
    const { data } = await (await fetch(`${baseUrl}/api/events?limit=100`)).json() as { data: { id: number }[] };
    assert.ok(data.some((e) => e.id === id));
  });
});

describe('la foto del cartel cuenta como en uso', () => {
  let id = 0;
  const nombre = 'ab'.repeat(16) + '.jpg';
  before(async () => {
    if (!(await db.$queryRaw`SELECT 1`.then(() => true).catch(() => false))) return;
    id = (await db.evento.create({ data: { title: `Prueba foto cartel ${Date.now()}`, startDate: new Date(), type: 'CULTO', cartel: true, fotoCartel: `/storage/public/${nombre}` } })).id;
  });
  after(async () => { if (id) await db.evento.deleteMany({ where: { id } }); });

  test('ni la limpieza de huérfanos ni el borrado al editar otra ficha la tocan', async (t) => {
    if (!id) return t.skip(SIN_DB);
    const { contarReferencias, subidasReferenciadas } = await import('../src/utils/ficheros-publicos.js');
    assert.ok((await contarReferencias(nombre)) >= 1);
    assert.ok((await subidasReferenciadas()).has(nombre));
  });
});
