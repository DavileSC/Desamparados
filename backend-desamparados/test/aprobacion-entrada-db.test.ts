// Aprobar la entrada al CMS desde un móvil apuntado, de punta a punta por la
// API: apuntar, entrar, esperar, aprobar, fallar, rechazar, caducar y entrar
// desde el mismo móvil. Los avisos nunca salen a la red (ver aprobacion/push).
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
import { COOKIE_2FA, COOKIE_CMS } from '../src/utils/cookies.js';
import { avisosDePrueba, fijarEnvioDePrueba } from '../src/services/aprobacion/push.js';
import { DobleFactorService } from '../src/services/doble-factor.service.js';
import { hashDeCodigoDeRespaldo } from '../src/services/auth/codigos-2fa.js';
import { cifrarSecretoTotp } from '../src/utils/cifrado-totp.js';
import * as OTPAuth from 'otpauth';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { encenderModulos } from './fixtures/modulos.js';
import { SIN_DB } from './fixtures/sin-db.js';

let server: Server;
let baseUrl: string;
let dbDisponible = false;
let restaurarModulos: (() => Promise<void>) | undefined;
const entornoAntes = { ...process.env };
const creados: number[] = [];

before(async () => {
  // Claves de verdad, para que la función exista; los avisos no salen igual.
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLICA = publicKey;
  process.env.VAPID_PRIVADA = privateKey;
  process.env.VAPID_CONTACTO = 'mailto:pruebas@ejemplo.test';

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (dbDisponible) restaurarModulos = await encenderModulos(['avisos-en-el-movil']);
});

afterEach(() => {
  fijarEnvioDePrueba();
});

after(async () => {
  if (dbDisponible) {
    for (const id of creados) await borrarUsuarioPrueba(id);
    await db.avisoJunta.deleteMany({ where: { creadoPorId: { in: creados } } });
    await restaurarModulos?.();
  }
  for (const nombre of ['VAPID_PUBLICA', 'VAPID_PRIVADA', 'VAPID_CONTACTO']) {
    if (entornoAntes[nombre] === undefined) delete process.env[nombre];
    else process.env[nombre] = entornoAntes[nombre];
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
});

const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

async function cargo(role: Role = Role.SECRETARIA) {
  const u = await crearUsuarioPrueba(role);
  creados.push(u.id);
  return { ...u, cookie: `${COOKIE_CMS}=${generateToken(u.id, role, false, 'cms')}` };
}

function cookieDe(res: Response, nombre: string): string | undefined {
  return res.headers.getSetCookie().find((c) => c.startsWith(`${nombre}=`))?.split(';')[0];
}

async function pedir(ruta: string, opciones: { metodo?: string; cookie?: string; cuerpo?: unknown; ua?: string } = {}) {
  return fetch(`${baseUrl}/api${ruta}`, {
    method: opciones.metodo ?? 'POST',
    headers: {
      ...(opciones.cookie ? { Cookie: opciones.cookie } : {}),
      ...(opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      'User-Agent': opciones.ua ?? UA_PC,
    },
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  });
}

function suscripcion() {
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${crypto.randomBytes(12).toString('hex')}`,
    expirationTime: null,
    keys: { p256dh: crypto.randomBytes(65).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') },
  };
}

/** Apunta un móvil por la API, como «Mi seguridad». */
async function apuntar(c: { cookie: string }, nombre = 'iPhone de prueba', sus = suscripcion()) {
  const res = await pedir('/auth/movil', { cookie: c.cookie, cuerpo: { password: PASSWORD_PRUEBA, nombre, suscripcion: sus } });
  assert.equal(res.status, 201, await res.clone().text());
  const cuerpo = (await res.json()) as { movil: { id: number }; clave: string };
  return { dispositivo: cuerpo.movil.id, clave: cuerpo.clave, endpoint: sus.endpoint };
}

/** El primer paso del acceso al CMS: devuelve la cookie del testigo y lo que dice la respuesta. */
async function entrar(email: string, extra: Record<string, unknown> = {}) {
  const res = await pedir('/auth/login', { cuerpo: { email, password: PASSWORD_PRUEBA, contexto: 'cms', ...extra } });
  assert.equal(res.status, 200, await res.clone().text());
  const testigo = cookieDe(res, COOKIE_2FA);
  assert.ok(testigo, 'sin cookie del testigo');
  return { testigo, cuerpo: (await res.json()) as { status: string; aprobacion?: { numero: number; expiraEn: string }; esteMovil?: boolean } };
}

/** Un código de respaldo para la cuenta (que necesita un secreto TOTP para usarlo). */
async function darRespaldo(userId: number, codigo: string) {
  await db.user.update({ where: { id: userId }, data: { twoFactorSecret: cifrarSecretoTotp(new OTPAuth.Secret({ size: 20 }).base32) } });
  await db.twoFactorBackupCode.create({ data: { userId, codeHash: hashDeCodigoDeRespaldo(codigo) } });
}

const ultimoAviso = () => avisosDePrueba.at(-1)!;

async function esperar(testigo: string) {
  const res = await pedir('/auth/login/aprobacion', { cookie: testigo });
  return { res, cuerpo: (await res.json()) as { estado?: string; status?: string; user?: { id: number } } };
}

test('el flujo entero: apuntar, entrar, ver los números, aprobar y llevarse la sesión', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  const movil = await apuntar(c);

  const avisosAntes = avisosDePrueba.length;
  const { testigo, cuerpo } = await entrar(c.email);
  assert.equal(cuerpo.status, '2FA_NEEDED');
  assert.ok(cuerpo.aprobacion, 'con un móvil apuntado, el login trae el número');
  assert.equal(avisosDePrueba.length, avisosAntes + 1, 'un aviso por móvil');
  const aviso = ultimoAviso();
  assert.equal(aviso.suscripcion.endpoint, movil.endpoint);
  assert.equal(aviso.aviso.cuerpo, 'Entrada al CMS desde Windows · Chrome');
  assert.equal(aviso.aviso.url, `/cms/aprobar/${aviso.aviso.id}`);

  const espera = await esperar(testigo);
  assert.equal(espera.cuerpo.estado, 'PENDIENTE');

  const ver = await pedir(`/auth/aprobacion/${aviso.aviso.id}`, { cuerpo: { dispositivo: movil.dispositivo, clave: movil.clave } });
  const vista = (await ver.json()) as { estado: string; opciones: number[]; desde: string };
  assert.equal(vista.estado, 'PENDIENTE');
  assert.ok(vista.opciones.includes(cuerpo.aprobacion!.numero));
  assert.equal(vista.desde, 'Windows · Chrome');

  const aprobar = await pedir(`/auth/aprobacion/${aviso.aviso.id}/aprobar`, {
    cuerpo: { dispositivo: movil.dispositivo, clave: movil.clave, numero: cuerpo.aprobacion!.numero },
  });
  assert.deepEqual(await aprobar.json(), { estado: 'APROBADA' });

  const final = await esperar(testigo);
  assert.equal(final.res.status, 200);
  assert.equal(final.cuerpo.status, 'OK');
  assert.equal(final.cuerpo.user?.id, c.id);
  assert.ok(cookieDe(final.res, COOKIE_CMS)?.length, 'deja la cookie del CMS');

  // De un solo uso: el mismo testigo ya no da otra sesión.
  const otra = await esperar(testigo);
  assert.notEqual(otra.cuerpo.status, 'OK');
  assert.equal(cookieDe(otra.res, COOKIE_CMS), undefined);

  const apuntes = await db.auditLog.findMany({ where: { userId: c.id }, select: { action: true } });
  assert.ok(apuntes.some((a) => a.action === 'MOVIL_APUNTAR'));
  assert.ok(apuntes.some((a) => a.action === 'ENTRADA_APROBADA'));
  const usado = await db.movilApuntado.findUnique({ where: { id: movil.dispositivo } });
  assert.ok(usado?.usadoEn, 'apunta cuándo se usó el móvil');
});

test('un número equivocado anula la aprobación, sin segundo intento', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  const movil = await apuntar(c);
  const { testigo, cuerpo } = await entrar(c.email);
  const id = ultimoAviso().aviso.id;
  const malo = cuerpo.aprobacion!.numero === 99 ? 98 : cuerpo.aprobacion!.numero + 1;

  const fallo = await pedir(`/auth/aprobacion/${id}/aprobar`, { cuerpo: { dispositivo: movil.dispositivo, clave: movil.clave, numero: malo } });
  assert.deepEqual(await fallo.json(), { estado: 'FALLADA' });
  const otra = await pedir(`/auth/aprobacion/${id}/aprobar`, { cuerpo: { dispositivo: movil.dispositivo, clave: movil.clave, numero: cuerpo.aprobacion!.numero } });
  assert.deepEqual(await otra.json(), { estado: 'FALLADA' });
  assert.equal((await esperar(testigo)).cuerpo.estado, 'FALLADA');
});

test('«No he sido yo» la rechaza, deja sin valor el testigo y avisa a Administración', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  const movil = await apuntar(c);
  // Un código de respaldo, para probar que el testigo ya no sirve ni con él.
  const respaldo = 'ABCD-EFGH-JK23';
  await darRespaldo(c.id, respaldo);
  const { testigo } = await entrar(c.email);
  const id = ultimoAviso().aviso.id;

  const res = await pedir(`/auth/aprobacion/${id}/rechazar`, { cuerpo: { dispositivo: movil.dispositivo, clave: movil.clave } });
  assert.deepEqual(await res.json(), { estado: 'RECHAZADA' });
  assert.equal((await esperar(testigo)).cuerpo.estado, 'RECHAZADA');

  const conCodigo = await pedir('/auth/login/2fa', { cookie: testigo, cuerpo: { token2fa: respaldo } });
  assert.equal(conCodigo.status, 401);
  assert.equal(((await conCodigo.json()) as { error: string }).error, 'PENDING_2FA_REQUIRED');

  const aviso = await db.avisoJunta.findFirst({ where: { creadoPorId: c.id } });
  assert.equal(aviso?.para, Role.ADMIN);
  assert.ok(aviso?.urgente);
});

test('pasados los dos minutos caduca, y se apunta una sola vez', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  const movil = await apuntar(c);
  const { testigo } = await entrar(c.email);
  const id = ultimoAviso().aviso.id;
  await db.aprobacionEntrada.update({ where: { id }, data: { expiraEn: new Date(Date.now() - 1000) } });

  assert.equal((await esperar(testigo)).cuerpo.estado, 'CADUCADA');
  assert.equal((await esperar(testigo)).cuerpo.estado, 'CADUCADA');
  const ver = await pedir(`/auth/aprobacion/${id}`, { cuerpo: { dispositivo: movil.dispositivo, clave: movil.clave } });
  assert.deepEqual(await ver.json(), { estado: 'CADUCADA' });
  assert.equal(await db.auditLog.count({ where: { action: 'ENTRADA_CADUCADA', entityId: id } }), 1);
});

test('el móvil de otra cuenta, o una clave equivocada, no pueden ver ni aprobar', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  const otro = await cargo();
  const movil = await apuntar(c);
  const ajeno = await apuntar(otro, 'Móvil ajeno');
  const { cuerpo } = await entrar(c.email);
  const id = ultimoAviso().aviso.id;

  for (const credenciales of [
    { dispositivo: ajeno.dispositivo, clave: ajeno.clave },
    { dispositivo: movil.dispositivo, clave: crypto.randomBytes(32).toString('base64url') },
  ]) {
    const res = await pedir(`/auth/aprobacion/${id}/aprobar`, { cuerpo: { ...credenciales, numero: cuerpo.aprobacion!.numero } });
    assert.equal(res.status, 403);
    assert.equal(((await res.json()) as { codigo: string }).codigo, 'MOVIL_NO_APUNTADO');
  }
  const sigue = await db.aprobacionEntrada.findUnique({ where: { id } });
  assert.equal(sigue?.estado, 'PENDIENTE');
});

test('mientras una espera no se manda otro aviso', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  await apuntar(c);
  const primera = await entrar(c.email);
  assert.ok(primera.cuerpo.aprobacion);
  const avisos = avisosDePrueba.length;
  const segunda = await entrar(c.email);
  assert.equal(segunda.cuerpo.aprobacion, undefined);
  assert.equal(avisosDePrueba.length, avisos);
});

test('entrar con el código de la app anula la aprobación que esperaba', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  const movil = await apuntar(c);
  const respaldo = 'MNPQ-RSTU-VW45';
  await darRespaldo(c.id, respaldo);
  const { testigo, cuerpo } = await entrar(c.email);
  const id = ultimoAviso().aviso.id;

  const res = await pedir('/auth/login/2fa', { cookie: testigo, cuerpo: { token2fa: respaldo } });
  assert.equal(res.status, 200);
  const tarde = await pedir(`/auth/aprobacion/${id}/aprobar`, { cuerpo: { dispositivo: movil.dispositivo, clave: movil.clave, numero: cuerpo.aprobacion!.numero } });
  assert.deepEqual(await tarde.json(), { estado: 'CADUCADA' });
});

test('desde el mismo móvil: sin aviso a sí mismo, y entra con su clave', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  const movil = await apuntar(c);
  const avisos = avisosDePrueba.length;
  const { testigo, cuerpo } = await entrar(c.email, { dispositivo: movil.dispositivo });
  assert.equal(cuerpo.esteMovil, true);
  assert.equal(cuerpo.aprobacion, undefined, 'su único móvil es este: no hay a quién avisar');
  assert.equal(avisosDePrueba.length, avisos);

  const mala = await pedir('/auth/login/este-movil', { cookie: testigo, cuerpo: { dispositivo: movil.dispositivo, clave: crypto.randomBytes(32).toString('base64url') } });
  assert.equal(mala.status, 403);

  const res = await pedir('/auth/login/este-movil', { cookie: testigo, cuerpo: { dispositivo: movil.dispositivo, clave: movil.clave } });
  assert.equal(res.status, 200);
  assert.ok(cookieDe(res, COOKIE_CMS)?.length);
  const otra = await pedir('/auth/login/este-movil', { cookie: testigo, cuerpo: { dispositivo: movil.dispositivo, clave: movil.clave } });
  assert.equal(otra.status, 401, 'el testigo es de un solo uso');
});

test('apuntar pide la contraseña, y un móvil que el servicio da por muerto se borra', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  const mala = await pedir('/auth/movil', { cookie: c.cookie, cuerpo: { password: 'otra-cosa', nombre: 'Móvil', suscripcion: suscripcion() } });
  assert.equal(mala.status, 400);
  const fuera = await pedir('/auth/movil', {
    cookie: c.cookie,
    cuerpo: { password: PASSWORD_PRUEBA, nombre: 'Móvil', suscripcion: { ...suscripcion(), endpoint: 'https://127.0.0.1/interno' } },
  });
  assert.equal(fuera.status, 400, 'una dirección que no es de un servicio de push no se acepta');

  const movil = await apuntar(c);
  fijarEnvioDePrueba(async () => 'muerta');
  await entrar(c.email);
  for (let i = 0; i < 50 && (await db.movilApuntado.count({ where: { id: movil.dispositivo } })); i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(await db.movilApuntado.count({ where: { id: movil.dispositivo } }), 0);
});

test('el rescate del 2FA quita también los móviles', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  const admin = await cargo(Role.ADMIN);
  await apuntar(c);
  await DobleFactorService.forceDisable2FA(c.id, admin.id);
  assert.equal(await db.movilApuntado.count({ where: { userId: c.id } }), 0);
});

test('«Mi seguridad» lista y quita los móviles propios, no los ajenos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const c = await cargo();
  const otro = await cargo();
  const movil = await apuntar(c, 'Android de prueba');
  const ajeno = await apuntar(otro);

  const lista = await pedir('/auth/moviles', { metodo: 'GET', cookie: c.cookie });
  const cuerpo = (await lista.json()) as { disponible: boolean; clavePublica: string; moviles: { id: number; nombre: string }[] };
  assert.equal(cuerpo.disponible, true);
  assert.equal(cuerpo.clavePublica, process.env.VAPID_PUBLICA);
  assert.deepEqual(cuerpo.moviles.map((m) => m.nombre), ['Android de prueba']);

  assert.equal((await pedir(`/auth/movil/${ajeno.dispositivo}`, { metodo: 'DELETE', cookie: c.cookie })).status, 404);
  assert.equal((await pedir(`/auth/movil/${movil.dispositivo}`, { metodo: 'DELETE', cookie: c.cookie })).status, 204);
  assert.equal(await db.movilApuntado.count({ where: { userId: c.id } }), 0);
});
