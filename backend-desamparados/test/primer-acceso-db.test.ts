// El primer acceso del censo importado contra MariaDB: la invitación sale por
// correo y queda apuntada; su enlace saluda sin gastarse, pone la contraseña y
// abre la sesión de una vez, y no vale dos veces; confirmar exige los
// obligatorios de cada ficha y el parentesco de las fichas a cargo, y quita la
// marca para siempre; «no es de
// mi familia» devuelve la ficha a la custodia con un aviso para Secretaría. Y
// las rutas: el listado y las invitaciones son de quien lleva el censo.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Prisma, Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { ponerTransporte } from '../src/services/correos/envio.js';
import { PrimerAccesoService } from '../src/services/primer-acceso.service.js';
import { CUENTA_CENSO_IMPORTADO } from '../src/services/censo-hoja.service.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;
const enviados: { to?: unknown; html?: unknown }[] = [];
const pausaAntes = process.env.COMUNICADOS_PAUSA_MS;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  ponerTransporte({ sendMail: async (correo) => { enviados.push(correo); } });
  process.env.COMUNICADOS_PAUSA_MS = '0';
});

after(async () => {
  ponerTransporte(undefined);
  if (pausaAntes === undefined) delete process.env.COMUNICADOS_PAUSA_MS;
  else process.env.COMUNICADOS_PAUSA_MS = pausaAntes;
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

const CONTRASENA = 'Trono-Alameda-84-Verde';

/** Una cuenta como las que deja el importador: sin contraseña útil, con su ficha completa y una hija colgada sin parentesco. */
async function escenario() {
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const cuenta = await crearUsuarioPrueba(Role.USER);
  await db.user.update({ where: { id: cuenta.id }, data: { primerAccesoPendiente: true, nombre: 'Antonio', apellidos: 'Ruiz Montes' } });
  const ficha = (datos: { nombre: string; esTitular: boolean } & Partial<Prisma.HermanoUncheckedCreateInput>) => db.hermano.create({
    data: {
      userId: cuenta.id, apellidos: 'Ruiz Montes', fechaNacimiento: new Date(Date.UTC(1980, 0, 1)),
      email: cuenta.email, telefono: '600000000', direccion: 'Calle Lagunillas 34', activo: true, sexo: 'HOMBRE', ...datos,
    },
  });
  const titular = await ficha({
    nombre: 'Antonio', esTitular: true, primerApellido: 'Ruiz', dni: cuenta.dni, estadoCivil: 'CASADO',
    fechaBautismo: new Date(Date.UTC(1980, 2, 1)), codigoPostal: '29012', poblacion: 'Málaga',
  });
  const hija = await ficha({ nombre: 'Lucía', esTitular: false });
  const custodiaAntes = await db.user.findUnique({ where: { email: CUENTA_CENSO_IMPORTADO.email }, select: { id: true } });
  const recoger = async () => {
    await db.hermano.deleteMany({ where: { id: { in: [titular.id, hija.id] } } });
    await db.avisoJunta.deleteMany({ where: { creadoPorId: cuenta.id } });
    await db.auditLog.deleteMany({ where: { userId: { in: [staff.id, cuenta.id] } } });
    await borrarUsuarioPrueba(cuenta.id);
    await borrarUsuarioPrueba(staff.id);
    // La custodia solo se va si la creó esta prueba y se ha quedado vacía.
    const custodia = await db.user.findUnique({ where: { email: CUENTA_CENSO_IMPORTADO.email }, select: { id: true } });
    if (custodia && !custodiaAntes && (await db.hermano.count({ where: { userId: custodia.id } })) === 0) await db.user.delete({ where: { id: custodia.id } });
  };
  const sesionHermano = `${COOKIE_HERMANO}=${generateToken(cuenta.id, Role.USER, false, 'hermanos')}`;
  const sesionStaff = `${COOKIE_CMS}=${generateToken(staff.id, Role.SECRETARIA, false, 'cms')}`;
  return { staff, cuenta, titular, hija, recoger, sesionHermano, sesionStaff };
}

const pedir = (ruta: string, opciones: { metodo?: string; cookie?: string; cuerpo?: unknown } = {}) => fetch(`${baseUrl}${ruta}`, {
  method: opciones.metodo ?? 'GET',
  headers: { 'Content-Type': 'application/json', ...(opciones.cookie ? { Cookie: opciones.cookie } : {}) },
  body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
});

test('la invitación sale por correo y su enlace pone la contraseña y abre la sesión, una sola vez', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const inv = await pedir('/api/hermanos/admin/primer-acceso/invitar', { metodo: 'POST', cookie: e.sesionStaff, cuerpo: { ids: [e.cuenta.id] } });
    assert.equal(inv.status, 202);
    assert.deepEqual(await inv.json(), { encoladas: 1 });
    await PrimerAccesoService.esperarCola();

    const correo = enviados.find((c) => c.to === e.cuenta.email);
    assert.ok(correo, 'la invitación tiene que salir');
    const token = /\/primer-acceso\?token=([a-f0-9]{64})/.exec(String(correo.html))?.[1];
    assert.ok(token, 'el correo lleva el enlace del primer acceso');
    assert.ok((await db.user.findUniqueOrThrow({ where: { id: e.cuenta.id } })).invitadoEn);
    assert.ok(await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.PRIMER_ACCESO_INVITAR, userId: e.staff.id } }));

    // Leer el enlace saluda y no lo gasta.
    const datos = await pedir('/api/auth/primer-acceso/datos', { metodo: 'POST', cuerpo: { token } });
    assert.equal(datos.status, 200);
    assert.deepEqual(await datos.json(), { nombre: 'Antonio', email: e.cuenta.email });

    // Una contraseña floja no pasa, y el enlace sigue valiendo.
    assert.equal((await pedir('/api/auth/primer-acceso', { metodo: 'POST', cuerpo: { token, newPassword: '12345678' } })).status, 400);

    const estreno = await pedir('/api/auth/primer-acceso', { metodo: 'POST', cuerpo: { token, newPassword: CONTRASENA } });
    assert.equal(estreno.status, 200);
    const cuerpo = await estreno.json() as { user: { id: number; primerAccesoPendiente: boolean } };
    assert.equal(cuerpo.user.id, e.cuenta.id);
    assert.equal(cuerpo.user.primerAccesoPendiente, true);
    const cookie = estreno.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_HERMANO}=`));
    assert.ok(cookie, 'deja abierta la sesión del área de hermanos');
    const me = await pedir('/api/auth/me', { cookie: cookie.split(';')[0] });
    assert.equal((await me.json() as { hermano: { id: number } | null }).hermano?.id, e.cuenta.id);

    // Ya gastado: ni saluda ni vuelve a abrir nada.
    assert.equal((await pedir('/api/auth/primer-acceso/datos', { metodo: 'POST', cuerpo: { token } })).status, 400);
    assert.equal((await pedir('/api/auth/primer-acceso', { metodo: 'POST', cuerpo: { token, newPassword: CONTRASENA } })).status, 400);
  } finally {
    await e.recoger();
  }
});

test('confirmar pide los obligatorios y el parentesco de las fichas a cargo, y quita la marca para siempre', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    // Lo que el Excel no traía no se da por bueno: hay que rellenarlo.
    await db.hermano.update({ where: { id: e.titular.id }, data: { telefono: null, estadoCivil: null } });
    const incompleta = await pedir('/api/hermanos/primer-acceso/confirmar', { metodo: 'POST', cookie: e.sesionHermano });
    assert.equal(incompleta.status, 409);
    const cuerpoIncompleta = await incompleta.json() as { error: string; fichaIncompleta?: unknown };
    assert.match(cuerpoIncompleta.error, /tu ficha: estado civil y teléfono móvil/);
    // Además de la frase, qué ficha y qué campos: la web puede llevar ahí.
    assert.deepEqual(cuerpoIncompleta.fichaIncompleta, { id: e.titular.id, nombre: 'Antonio', esTitular: true, campos: ['estadoCivil', 'telefono'] });
    await db.hermano.update({ where: { id: e.titular.id }, data: { telefono: '600000000', estadoCivil: 'CASADO' } });

    const sinParentesco = await pedir('/api/hermanos/primer-acceso/confirmar', { metodo: 'POST', cookie: e.sesionHermano });
    assert.equal(sinParentesco.status, 409);
    const cuerpoSinParentesco = await sinParentesco.json() as { error: string; fichaIncompleta?: unknown };
    // «el parentesco», no la etiqueta del formulario («Qué es para ti»), que
    // en una frase del servidor no se entiende.
    assert.equal(cuerpoSinParentesco.error, 'Faltan datos obligatorios en la ficha de Lucía: el parentesco.');
    assert.deepEqual(cuerpoSinParentesco.fichaIncompleta, { id: e.hija.id, nombre: 'Lucía', esTitular: false, campos: ['parentesco'] });

    await db.hermano.update({ where: { id: e.hija.id }, data: { parentesco: 'HIJO' } });
    assert.equal((await pedir('/api/hermanos/primer-acceso/confirmar', { metodo: 'POST', cookie: e.sesionHermano })).status, 200);
    const cuenta = await db.user.findUniqueOrThrow({ where: { id: e.cuenta.id } });
    assert.equal(cuenta.primerAccesoPendiente, false);
    assert.ok(cuenta.fichaConfirmadaEn);

    // Otra vez (dos pestañas): no es un error.
    assert.equal((await pedir('/api/hermanos/primer-acceso/confirmar', { metodo: 'POST', cookie: e.sesionHermano })).status, 200);

    // Confirmada, ya no se le puede volver a invitar.
    const reenvio = await pedir('/api/hermanos/admin/primer-acceso/invitar', { metodo: 'POST', cookie: e.sesionStaff, cuerpo: { ids: [e.cuenta.id] } });
    assert.equal(reenvio.status, 409);
    const listado = await pedir(`/api/hermanos/admin/primer-acceso?estado=confirmado&q=${encodeURIComponent(e.cuenta.email)}`, { cookie: e.sesionStaff });
    const { data } = await listado.json() as { data: { id: number; aCargo: number }[] };
    assert.deepEqual(data.map((c) => [c.id, c.aCargo]), [[e.cuenta.id, 1]]);
  } finally {
    await e.recoger();
  }
});

test('Secretaría ve cuándo caduca cada invitación, también las ya caducadas', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const listar = async (estado?: string) => {
      const res = await pedir(`/api/hermanos/admin/primer-acceso?${estado ? `estado=${estado}&` : ''}q=${encodeURIComponent(e.cuenta.email)}`, { cookie: e.sesionStaff });
      assert.equal(res.status, 200);
      return (await res.json() as { data: { id: number; invitacionCaducaEn: string | null }[] }).data;
    };
    // Sin invitar: no hay nada que caduque.
    assert.deepEqual((await listar()).map((c) => [c.id, c.invitacionCaducaEn]), [[e.cuenta.id, null]]);

    const caducada = new Date(Date.now() - 3 * 24 * 3600_000);
    await db.user.update({
      where: { id: e.cuenta.id },
      data: { invitadoEn: new Date(Date.now() - 20 * 24 * 3600_000), resetPasswordToken: 'x'.repeat(64), resetPasswordExpires: caducada },
    });
    // Caducada, sigue entre los invitados, con la fecha para decir «caducó el…».
    const invitados = await listar('invitado');
    assert.deepEqual(invitados.map((c) => [c.id, c.invitacionCaducaEn]), [[e.cuenta.id, caducada.toISOString()]]);

    // Estrenada (el enlace ya se gastó) o confirmada: ya no hay invitación viva.
    await db.user.update({ where: { id: e.cuenta.id }, data: { resetPasswordToken: null, resetPasswordExpires: null } });
    assert.equal((await listar('invitado'))[0]?.invitacionCaducaEn, null);
    await db.user.update({
      where: { id: e.cuenta.id },
      data: { primerAccesoPendiente: false, fichaConfirmadaEn: new Date(), resetPasswordToken: 'y'.repeat(64), resetPasswordExpires: new Date(Date.now() + 3600_000) },
    });
    assert.equal((await listar('confirmado'))[0]?.invitacionCaducaEn, null);
  } finally {
    await e.recoger();
  }
});

test('«no es de mi familia» devuelve la ficha a la custodia y avisa a Secretaría', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    // La suya no se puede devolver.
    assert.equal((await pedir(`/api/hermanos/primer-acceso/fichas/${e.titular.id}/ajena`, { metodo: 'POST', cookie: e.sesionHermano })).status, 404);

    assert.equal((await pedir(`/api/hermanos/primer-acceso/fichas/${e.hija.id}/ajena`, { metodo: 'POST', cookie: e.sesionHermano })).status, 200);
    const hija = await db.hermano.findUniqueOrThrow({ where: { id: e.hija.id }, include: { user: true } });
    assert.equal(hija.user.email, CUENTA_CENSO_IMPORTADO.email);
    const aviso = await db.avisoJunta.findFirstOrThrow({ where: { creadoPorId: e.cuenta.id } });
    assert.equal(aviso.para, Role.SECRETARIA);
    assert.match(aviso.texto, /Lucía Ruiz Montes/);

    // Sin fichas a cargo, ya puede confirmar.
    assert.equal((await pedir('/api/hermanos/primer-acceso/confirmar', { metodo: 'POST', cookie: e.sesionHermano })).status, 200);
  } finally {
    await e.recoger();
  }
});

test('las rutas del primer acceso piden su sesión', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    assert.equal((await pedir('/api/hermanos/admin/primer-acceso')).status, 401);
    assert.equal((await pedir('/api/hermanos/admin/primer-acceso/invitar', { metodo: 'POST', cuerpo: {} })).status, 401);
    assert.equal((await pedir('/api/hermanos/primer-acceso/confirmar', { metodo: 'POST' })).status, 401);
    // Un hermano no ve el listado ni manda invitaciones.
    assert.equal((await pedir('/api/hermanos/admin/primer-acceso', { cookie: e.sesionHermano })).status, 403);
    assert.equal((await pedir('/api/hermanos/admin/primer-acceso/invitar', { metodo: 'POST', cookie: e.sesionHermano, cuerpo: {} })).status, 403);
    assert.equal((await pedir('/api/hermanos/admin/primer-acceso', { cookie: e.sesionStaff })).status, 200);
  } finally {
    await e.recoger();
  }
});
