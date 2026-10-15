// test/cuenta-seguridad.test.ts
//
// La seguridad de la propia cuenta:
//  - Cambiar la contraseña con la sesión abierta (no existía: solo se podía
//    con «He olvidado mi contraseña»). Pide la actual, aplica las reglas de
//    la nueva, cierra las demás sesiones, quita el bloqueo del login, deja
//    rastro y avisa por correo.
//  - El bloqueo del doble factor crece por tandas y avisa al titular.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { verified } from '../src/utils/bcrypt.handle.js';
import { COOKIE_HERMANO } from '../src/utils/cookies.js';
import { ponerTransporte } from '../src/services/correos/envio.js';
import type { CorreoParaBuzon } from '../src/utils/buzon-pruebas.js';
import {
  ESCALADA_BLOQUEO_2FA, comprobarBloqueo2FA, limpiarFallos2FA, registrarFallo2FA, textoDePlazo,
} from '../src/services/auth/codigos-2fa.js';
import { HttpError } from '../src/utils/error.handle.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const NUEVA = 'Cirio-Alameda-2026-Verde';

let server: Server;
let baseUrl: string;
let dbDisponible = false;
const creados: number[] = [];
const enviados: CorreoParaBuzon[] = [];

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
  dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
  ponerTransporte({ sendMail: async (correo) => { enviados.push(correo); } });
});

after(async () => {
  ponerTransporte(undefined);
  server.close();
  for (const id of creados) {
    await db.auditLog.deleteMany({ where: { entityType: 'user', entityId: String(id) } });
    await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

async function usuario(role: Role = Role.USER) {
  const u = await crearUsuarioPrueba(role);
  creados.push(u.id);
  return u;
}

const cookieHermano = (id: number, role: Role = Role.USER) => `${COOKIE_HERMANO}=${generateToken(id, role, false, 'hermanos')}`;

function cambiar(cookie: string, cuerpo: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/auth/cambiar-contrasena`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(cuerpo),
  });
}

/** La cookie de sesión que pone la respuesta, lista para mandarla de vuelta. */
function cookieDe(respuesta: Response, nombre: string): string | null {
  const linea = respuesta.headers.getSetCookie().find((c) => c.startsWith(`${nombre}=`));
  return linea ? linea.split(';')[0] : null;
}

const estadoCon = async (cookie: string) => (await fetch(`${baseUrl}/api/hermanos/mis-perfiles`, { headers: { Cookie: cookie } })).status;

async function esperarCorreos() {
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 25));
}

describe('cambiar la contraseña con la sesión abierta', () => {
  test('sin sesión, 401', async () => {
    const r = await fetch(`${baseUrl}/api/auth/cambiar-contrasena`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actual: 'x', nueva: NUEVA }),
    });
    assert.equal(r.status, 401);
  });

  test('cambia la contraseña, corta las demás sesiones, deja la suya, apunta y avisa', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const u = await usuario();
    const esta = cookieHermano(u.id);
    // Otra sesión de la misma cuenta, abierta en otro sitio.
    const otra = cookieHermano(u.id);
    await new Promise((r) => setTimeout(r, 5));
    enviados.length = 0;

    const r = await cambiar(esta, { actual: PASSWORD_PRUEBA, nueva: NUEVA });
    assert.equal(r.status, 200, await r.clone().text());
    const nueva = cookieDe(r, COOKIE_HERMANO);
    assert.ok(nueva, 'la respuesta trae una sesión nueva para esta área');

    const guardada = await db.user.findUnique({ where: { id: u.id }, select: { password: true } });
    assert.ok(await verified(NUEVA, guardada!.password));

    assert.equal(await estadoCon(otra), 401, 'la otra sesión queda fuera');
    assert.equal(await estadoCon(esta), 401, 'la cookie de antes también');
    assert.equal(await estadoCon(nueva!), 200, 'la nueva sirve');

    const rastro = await db.auditLog.findFirst({ where: { action: 'CONTRASENA_CAMBIAR', entityType: 'user', entityId: String(u.id) } });
    assert.ok(rastro, 'queda en la auditoría');

    await esperarCorreos();
    const aviso = enviados.find((c) => c.to === u.email);
    assert.ok(aviso, 'se avisa por correo al titular');
    assert.match(aviso.subject, /contraseña/i);
  });

  test('con la actual equivocada, 400 sin tocar nada; a la quinta, 429', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const u = await usuario();
    const cookie = cookieHermano(u.id);
    for (let i = 0; i < 5; i++) {
      const r = await cambiar(cookie, { actual: 'No-Es-La-Mia-2026', nueva: NUEVA });
      assert.equal(r.status, 400);
      assert.match((await r.json() as { error: string }).error, /actual no es correcta/);
    }
    const bloqueado = await cambiar(cookie, { actual: PASSWORD_PRUEBA, nueva: NUEVA });
    assert.equal(bloqueado.status, 429, 'ni con la buena mientras dura el bloqueo');
    const guardada = await db.user.findUnique({ where: { id: u.id }, select: { password: true } });
    assert.ok(await verified(PASSWORD_PRUEBA, guardada!.password), 'la contraseña no ha cambiado');
  });

  test('la nueva sigue las reglas de la recuperación y no puede ser la misma', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const u = await usuario();
    const cookie = cookieHermano(u.id);
    assert.equal((await cambiar(cookie, { actual: PASSWORD_PRUEBA, nueva: '12345678' })).status, 400);
    const misma = await cambiar(cookie, { actual: PASSWORD_PRUEBA, nueva: PASSWORD_PRUEBA });
    assert.equal(misma.status, 400);
    assert.match((await misma.json() as { error: string }).error, /igual que la actual/);
  });

  test('quita el bloqueo del login: con la nueva se entra a la primera', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const u = await usuario();
    const entrar = (password: string) => fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password, contexto: 'hermanos' }),
    });
    for (let i = 0; i < 5; i++) await entrar('Mal-Escrita-2026-x');
    assert.equal((await entrar(PASSWORD_PRUEBA)).status, 429, 'el login está bloqueado');

    assert.equal((await cambiar(cookieHermano(u.id), { actual: PASSWORD_PRUEBA, nueva: NUEVA })).status, 200);
    assert.equal((await entrar(NUEVA)).status, 200);
  });
});

describe('el bloqueo del doble factor', () => {
  test('el plazo se lee bien', () => {
    assert.deepEqual(ESCALADA_BLOQUEO_2FA.map(textoDePlazo), ['15 minutos', '1 hora', '4 horas', '24 horas']);
  });

  test('al bloquearse, se avisa al titular una vez, y un acierto lo deja a cero', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const u = await usuario(Role.SECRETARIA);
    enviados.length = 0;
    for (let i = 0; i < 4; i++) await registrarFallo2FA(u.id);
    await esperarCorreos();
    assert.equal(enviados.filter((c) => c.to === u.email).length, 0, 'cuatro fallos no bloquean ni avisan');

    await registrarFallo2FA(u.id);
    await esperarCorreos();
    const avisos = enviados.filter((c) => c.to === u.email);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0].html, /15 minutos/);
    await assert.rejects(comprobarBloqueo2FA(u.id), (e: unknown) => e instanceof HttpError && e.status === 429 && /15 minutos/.test(e.message));

    // Un acierto lo deja a cero.
    await limpiarFallos2FA(u.id);
    await assert.doesNotReject(comprobarBloqueo2FA(u.id));
  });
});
