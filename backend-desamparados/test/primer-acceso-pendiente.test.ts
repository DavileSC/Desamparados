// La guarda del servidor sobre las cuentas con el primer acceso pendiente:
// hasta confirmar la ficha, la sesión del área de hermanos solo abre lo que
// necesita la revisión (la sesión, cerrar sesión, leer y corregir las fichas
// y el propio primer acceso). Lo demás responde 403 PRIMER_ACCESO_PENDIENTE,
// también lo que la web ya esconde: la web no es la única que llama. Tras
// confirmar, todo vuelve a abrirse con la misma sesión.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { PRIMER_ACCESO_PENDIENTE } from '../src/middleware/session.js';
import { CUENTA_CENSO_IMPORTADO } from '../src/services/censo-hoja.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { encenderModulos } from './fixtures/modulos.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;
let restaurarModulos: (() => Promise<void>) | null = null;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (dbDisponible) restaurarModulos = await encenderModulos(['area-hermanos', 'procesion']);
});

after(async () => {
  if (restaurarModulos) await restaurarModulos();
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

/** Una cuenta del censo importado, con su ficha completa y un hijo a cargo. */
async function escenario(role: Role = Role.USER) {
  const cuenta = await crearUsuarioPrueba(role);
  await db.user.update({ where: { id: cuenta.id }, data: { primerAccesoPendiente: true } });
  const comun = {
    userId: cuenta.id, apellidos: 'Ruiz Montes', primerApellido: 'Ruiz', email: cuenta.email, telefono: '600000000',
    direccion: 'Calle Lagunillas 34', codigoPostal: '29012', poblacion: 'Málaga', activo: true, sexo: 'HOMBRE' as const,
  };
  const titular = await db.hermano.create({
    data: {
      ...comun, nombre: 'Antonio', esTitular: true, dni: cuenta.dni, estadoCivil: 'CASADO',
      fechaNacimiento: new Date(Date.UTC(1980, 0, 1)), fechaBautismo: new Date(Date.UTC(1980, 2, 1)),
    },
  });
  const hijo = await db.hermano.create({
    data: { ...comun, nombre: 'Pablo', esTitular: false, parentesco: 'HIJO', fechaNacimiento: new Date(Date.UTC(2015, 0, 1)) },
  });
  const recoger = async () => {
    await db.hermano.deleteMany({ where: { userId: cuenta.id } });
    await db.auditLog.deleteMany({ where: { userId: cuenta.id } });
    await borrarUsuarioPrueba(cuenta.id);
  };
  const sesionHermano = `${COOKIE_HERMANO}=${generateToken(cuenta.id, role, false, 'hermanos')}`;
  return { cuenta, titular, hijo, recoger, sesionHermano };
}

const pedir = (ruta: string, opciones: { metodo?: string; cookie?: string; cuerpo?: unknown } = {}) => fetch(`${baseUrl}${ruta}`, {
  method: opciones.metodo ?? 'GET',
  headers: { 'Content-Type': 'application/json', ...(opciones.cookie ? { Cookie: opciones.cookie } : {}) },
  body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
});

/** Las del área que la revisión no necesita: con la cuenta pendiente, ninguna se abre. */
const fueraDeLaRevision = (hijoId: number) => [
  { ruta: '/api/procesion/mi-estado' },
  { ruta: '/api/recibos/mis-recibos' },
  { ruta: '/api/hermanos/mis-perfiles', metodo: 'POST', cuerpo: { nombre: 'Ana', fechaNacimiento: '2018-01-01', parentesco: 'HIJO' } },
  { ruta: `/api/hermanos/mis-perfiles/${hijoId}`, metodo: 'DELETE' },
  { ruta: `/api/hermanos/mis-perfiles/${hijoId}/emancipar`, metodo: 'POST', cuerpo: { newEmail: 'pablo@ejemplo.test', newPassword: 'Trono-Alameda-84-Verde' } },
];

test('con el primer acceso pendiente, el área responde 403 PRIMER_ACCESO_PENDIENTE fuera de la revisión', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    for (const { ruta, metodo, cuerpo } of fueraDeLaRevision(e.hijo.id)) {
      const res = await pedir(ruta, { metodo, cuerpo, cookie: e.sesionHermano });
      assert.equal(res.status, 403, `${metodo ?? 'GET'} ${ruta}`);
      const cuerpoRes = await res.json() as { error?: string; message?: string };
      assert.equal(cuerpoRes.error, PRIMER_ACCESO_PENDIENTE, `${metodo ?? 'GET'} ${ruta}`);
      assert.ok(cuerpoRes.message, 'lleva un mensaje para la persona');
    }
    // La baja del familiar no llegó a hacerse.
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: e.hijo.id } })).fechaBaja, null);
  } finally {
    await e.recoger();
  }
});

test('con el primer acceso pendiente, la revisión sí se abre', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const me = await pedir('/api/auth/me', { cookie: e.sesionHermano });
    assert.equal(me.status, 200);
    assert.equal((await me.json() as { hermano: { primerAccesoPendiente: boolean } | null }).hermano?.primerAccesoPendiente, true);

    assert.equal((await pedir('/api/hermanos/mis-perfiles', { cookie: e.sesionHermano })).status, 200);
    assert.equal((await pedir('/api/hermanos/mis-perfiles?page=1&limit=50', { cookie: e.sesionHermano })).status, 200);
    const corregir = await pedir(`/api/hermanos/mis-perfiles/${e.titular.id}`, { metodo: 'PUT', cookie: e.sesionHermano, cuerpo: { poblacion: 'Torremolinos' } });
    assert.equal(corregir.status, 200);

    // Los derechos del RGPD no esperan a la ficha: descargar los datos se abre ya.
    assert.equal((await pedir('/api/auth/mis-datos', { cookie: e.sesionHermano })).status, 200);

    // Confirmar es de la revisión: con la ficha completa, abre el resto.
    assert.equal((await pedir('/api/hermanos/primer-acceso/confirmar', { metodo: 'POST', cookie: e.sesionHermano })).status, 200);

    // Con la misma sesión, lo de antes ya responde.
    assert.equal((await pedir('/api/procesion/mi-estado', { cookie: e.sesionHermano })).status, 200);
    assert.equal((await pedir('/api/recibos/mis-recibos', { cookie: e.sesionHermano })).status, 200);

    // Y cerrar sesión siempre se puede.
    assert.equal((await pedir('/api/auth/logout', { metodo: 'POST', cookie: e.sesionHermano, cuerpo: { area: 'hermanos' } })).status, 204);
  } finally {
    await e.recoger();
  }
});

test('«no es de mi familia» y cerrar sesión se abren con la cuenta pendiente', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  const custodiaAntes = await db.user.findUnique({ where: { email: CUENTA_CENSO_IMPORTADO.email }, select: { id: true } });
  try {
    assert.equal((await pedir(`/api/hermanos/primer-acceso/fichas/${e.hijo.id}/ajena`, { metodo: 'POST', cookie: e.sesionHermano })).status, 200);
    assert.equal((await pedir('/api/auth/logout', { metodo: 'POST', cookie: e.sesionHermano, cuerpo: { area: 'hermanos' } })).status, 204);
  } finally {
    // La ficha devuelta cuelga ya de la custodia: se borra aparte.
    await db.avisoJunta.deleteMany({ where: { creadoPorId: e.cuenta.id } });
    await db.hermano.deleteMany({ where: { id: e.hijo.id } });
    await e.recoger();
    // La custodia solo se va si la creó esta prueba y se ha quedado vacía.
    const custodia = await db.user.findUnique({ where: { email: CUENTA_CENSO_IMPORTADO.email }, select: { id: true } });
    if (custodia && !custodiaAntes && (await db.hermano.count({ where: { userId: custodia.id } })) === 0) await db.user.delete({ where: { id: custodia.id } });
  }
});

test('una cuenta del equipo con el primer acceso pendiente sigue entrando al CMS con su sesión del CMS', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario(Role.SECRETARIA);
  try {
    const sesionCms = `${COOKIE_CMS}=${generateToken(e.cuenta.id, Role.SECRETARIA, false, 'cms')}`;
    // Las dos cookies a la vez, como en un navegador con las dos áreas abiertas.
    const res = await pedir('/api/hermanos/admin/primer-acceso', { cookie: `${sesionCms}; ${e.sesionHermano}` });
    assert.equal(res.status, 200);
    // Solo con la del área, el CMS sigue cerrado como siempre.
    assert.equal((await pedir('/api/hermanos/admin/primer-acceso', { cookie: e.sesionHermano })).status, 403);
  } finally {
    await e.recoger();
  }
});

test('borrar la cuenta (RGPD) se abre con el primer acceso pendiente', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    // Con la contraseña equivocada: basta con ver que llega al servicio (400/401) y no se queda en el 403.
    const res = await pedir('/api/auth/mi-cuenta', { metodo: 'DELETE', cookie: e.sesionHermano, cuerpo: { password: 'no-es-la-buena-1A' } });
    assert.notEqual(res.status, 403);
    assert.notEqual((await res.json() as { error?: string }).error, PRIMER_ACCESO_PENDIENTE);
  } finally {
    await e.recoger();
  }
});

test('con el primer acceso pendiente, la sesión del CMS tampoco abre el área', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario(Role.TESORERIA);
  try {
    // Solo la cookie del CMS: un cargo recién nombrado que aún no ha revisado su ficha.
    const sesionCms = `${COOKIE_CMS}=${generateToken(e.cuenta.id, Role.TESORERIA, false, 'cms')}`;
    for (const { ruta, metodo, cuerpo } of fueraDeLaRevision(e.hijo.id)) {
      const res = await pedir(ruta, { metodo, cuerpo, cookie: sesionCms });
      assert.equal(res.status, 403, `${metodo ?? 'GET'} ${ruta}`);
      assert.equal((await res.json() as { error?: string }).error, PRIMER_ACCESO_PENDIENTE, `${metodo ?? 'GET'} ${ruta}`);
    }
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: e.hijo.id } })).fechaBaja, null);
    // Lo suyo del CMS sigue abierto: la guarda es solo de las rutas del área.
    // (Sin 2FA puede responder otro 403; lo que no puede es pararse en el primer acceso.)
    const cms = await pedir('/api/recibos/admin/resumen', { cookie: sesionCms });
    assert.notEqual((await cms.json() as { error?: string }).error, PRIMER_ACCESO_PENDIENTE);
  } finally {
    await e.recoger();
  }
});
