// Los hermanos difuntos y sus sufragios, de punta a punta (octubre de 2026):
// la baja por fallecimiento con su día, el registro, a quién de la familia se
// escribe (nunca a la cuenta del difunto), el sufragio en la Agenda con su
// aviso, y el pésame.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { ponerTransporte, type TransporteDeCorreo } from '../src/services/correos/envio.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;
const enviados: Parameters<TransporteDeCorreo['sendMail']>[0][] = [];

before(async () => {
  ponerTransporte({ sendMail: async (c) => { enviados.push(c); return {}; } });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  ponerTransporte(undefined);
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

test('del fallecimiento al pésame: registro, familia, sufragio en la Agenda y aviso', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
  const albacea = await crearUsuarioPrueba(Role.ALBACERIA);
  const cuenta = await crearUsuarioPrueba(Role.USER);
  const marca = `Difunto${Date.now().toString(36)}`;
  const madre = await db.hermano.create({
    data: { userId: cuenta.id, nombre: 'Carmen', apellidos: `${marca} Gil`, email: 'carmen@example.com', fechaNacimiento: new Date(Date.UTC(1970, 1, 1)), activo: true, esTitular: true, fechaAlta: new Date(Date.UTC(1990, 0, 10)) },
  });
  const hijo = await db.hermano.create({
    data: { userId: cuenta.id, nombre: 'Andrés', apellidos: `${marca} Gil`, sexo: 'HOMBRE', fechaNacimiento: new Date(Date.UTC(2000, 1, 1)), activo: true, esTitular: false, parentesco: 'HIJO', fechaAlta: new Date(Date.UTC(2005, 4, 3)) },
  });
  const como = (userId: number, rol: Role, ruta: string, init: { method?: string; json?: unknown } = {}) => fetch(`${baseUrl}/api/hermanos${ruta}`, {
    method: init.method ?? 'GET',
    headers: { Cookie: `${COOKIE_CMS}=${generateToken(userId, rol)}`, ...(init.json !== undefined && { 'Content-Type': 'application/json' }) },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  const secre = (ruta: string, init?: { method?: string; json?: unknown }) => como(secretaria.id, Role.SECRETARIA, ruta, init);
  const eventos: number[] = [];
  try {
    // La baja por fallecimiento, con el día en que falleció.
    const baja = await secre(`/admin/${hijo.id}/baja`, { method: 'DELETE', json: { motivo: 'FALLECIMIENTO', fechaDefuncion: '2026-09-20' } });
    assert.equal(baja.status, 200);

    // El registro y la ficha.
    const lista = await (await secre(`/admin/difuntos?q=${encodeURIComponent(marca)}`)).json() as { id: number; aniosDeHermano: number; aniversario: { dia: string } }[];
    assert.deepEqual(lista.map((d) => d.id), [hijo.id], 'la madre sigue viva: no sale');
    assert.equal(lista[0].aniosDeHermano, 21);
    assert.equal(lista[0].aniversario.dia, '2027-09-20', 'el primero, al año siguiente');
    const ficha = await (await secre(`/admin/difuntos/${hijo.id}`)).json() as { familia: { nombre: string; email: string } | null; fechaDefuncion: string };
    assert.deepEqual(ficha.familia, { nombre: `Carmen ${marca} Gil`, email: 'carmen@example.com' }, 'a la madre, que sigue en la familia');
    assert.equal((await secre(`/admin/difuntos/${madre.id}`)).status, 404, 'quien no ha fallecido no tiene ficha de difunto');
    assert.equal((await como(albacea.id, Role.ALBACERIA, '/admin/difuntos')).status, 403);

    // El día se corrige; futuro, no.
    assert.equal((await secre(`/admin/difuntos/${hijo.id}/defuncion`, { method: 'PUT', json: { fecha: '2026-09-19' } })).status, 200);
    assert.equal((await secre(`/admin/difuntos/${hijo.id}/defuncion`, { method: 'PUT', json: { fecha: '2099-01-01' } })).status, 400);

    // Un sufragio en la Agenda, con aviso a la familia.
    const creado = await secre(`/admin/difuntos/${hijo.id}/sufragios`, {
      method: 'POST', json: { tipo: 'MISA_ANIVERSARIO', fecha: '2027-09-19T19:30', lugar: 'Parroquia', enAgenda: true, avisarA: 'carmen@example.com' },
    });
    assert.equal(creado.status, 200);
    const sufragio = await creado.json() as { id: number; eventoId: number; familiaAvisada: boolean };
    eventos.push(sufragio.eventoId);
    assert.equal(sufragio.familiaAvisada, true);
    const acto = await db.evento.findUniqueOrThrow({ where: { id: sufragio.eventoId } });
    assert.equal(acto.title, `Misa de aniversario por Andrés ${marca} Gil`);
    assert.equal(acto.type, 'CULTO');
    assert.equal(acto.startDate.toISOString(), '2027-09-19T17:30:00.000Z', '19:30 en Madrid, en horario de verano');
    const aviso = enviados.find((c) => c.to === 'carmen@example.com' && /Misa de aniversario/.test(c.subject));
    assert.ok(aviso, 'a la familia le llega el aviso');
    assert.match(aviso.html, /Parroquia/);

    // Borrarlo quita también el acto de la Agenda.
    assert.equal((await secre(`/admin/sufragios/${sufragio.id}`, { method: 'DELETE' })).status, 200);
    assert.equal(await db.evento.count({ where: { id: sufragio.eventoId } }), 0);

    // El pésame.
    assert.equal((await secre(`/admin/difuntos/${hijo.id}/pesame`, { method: 'POST', json: { email: 'carmen@example.com' } })).status, 200);
    const pesame = enviados.find((c) => c.to === 'carmen@example.com' && /pésame/.test(c.subject));
    assert.ok(pesame);
    assert.match(pesame.html, /hermano de esta corporación/);

    // Si fallece la titular y no queda nadie con correo, no hay a quién proponer.
    await secre(`/admin/${madre.id}/baja`, { method: 'DELETE', json: { motivo: 'FALLECIMIENTO' } });
    assert.equal(((await (await secre(`/admin/difuntos/${madre.id}`)).json()) as { familia: unknown }).familia, null, 'nunca a la cuenta del propio difunto');
    assert.equal(((await (await secre(`/admin/difuntos/${hijo.id}`)).json()) as { familia: unknown }).familia, null, 'ni a la de la titular fallecida');
  } finally {
    await db.evento.deleteMany({ where: { id: { in: eventos } } });
    await db.sufragio.deleteMany({ where: { hermanoId: { in: [madre.id, hijo.id] } } });
    await db.auditLog.deleteMany({ where: { userId: secretaria.id } });
    await db.hermano.deleteMany({ where: { id: { in: [madre.id, hijo.id] } } });
    for (const u of [secretaria, albacea, cuenta]) await borrarUsuarioPrueba(u.id);
  }
});
