import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import * as OTPAuth from 'otpauth';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { verifyToken } from '../src/utils/jwt.handle.js';
import { HttpError, NotFoundError } from '../src/utils/error.handle.js';
import { AuthService } from '../src/services/auth.service.js';
import { cifrarSecretoTotp, leerSecretoTotp, SecretoTotpIlegibleError } from '../src/utils/cifrado-totp.js';
import { validarEntorno } from '../src/config/entorno.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';

/**
 * Rotación de TOTP_ENC_KEY y rescate del 2FA por consola (punto 1 de la
 * revisión). Cambiar la clave a secas dejaba ilegibles todos los secretos: cada
 * login con 2FA daba un 500 con «Código 2FA incorrecto» y, si todos los ADMIN
 * tenían 2FA, nadie podía entrar al CMS.
 *
 * Este proceso trabaja con dos claves propias: la resolución de la clave es
 * perezosa, así que basta con fijarlas antes del primer uso.
 */
const CLAVE_VIEJA = crypto.randomBytes(32);
const CLAVE_NUEVA = crypto.randomBytes(32);
const CLAVE_PERDIDA = crypto.randomBytes(32);
process.env.TOTP_ENC_KEY = CLAVE_NUEVA.toString('hex');
process.env.TOTP_ENC_KEY_ANTERIOR = CLAVE_VIEJA.toString('hex');

let server: Server;
let baseUrl: string;
let dbDisponible = false;
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
});

const SECRETO = 'JBSWY3DPEHPK3PXP';
const codigo = () =>
  new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(SECRETO) }).generate();

let ultimaIp = 0;
const ipUnica = () => `10.7.0.${++ultimaIp}`;

async function conSegundoFactor(id: number, guardado: string) {
  await db.user.update({ where: { id }, data: { twoFactorEnabled: true, twoFactorSecret: guardado } });
}

async function primerFactor(email: string) {
  const respuesta = await AuthService.loginUser({ email, password: PASSWORD_PRUEBA, contexto: 'cms' }, ipUnica());
  if (respuesta.status !== '2FA_NEEDED') throw new Error('se esperaba que pidiera el segundo factor');
  return verifyToken(respuesta.pendingToken, '2fa_pending')!;
}

const soloConLaNueva = { clave: CLAVE_NUEVA, derivada: false, anteriores: [] };

// ---------------------------------------------------------------------------
//  Rotación
// ---------------------------------------------------------------------------

test('durante la rotación, un secreto con la clave anterior sigue entrando y queda con la nueva', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id, cifrarSecretoTotp(SECRETO, CLAVE_VIEJA));
    const testigo = await primerFactor(staff.email);
    assert.equal((await AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', testigo)).status, 'OK');

    const guardado = (await db.user.findUnique({ where: { id: staff.id }, select: { twoFactorSecret: true } }))!.twoFactorSecret!;
    assert.equal(leerSecretoTotp(guardado, soloConLaNueva).secreto, SECRETO, 'tras usarlo, se lee sin la clave anterior');
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('el script recifra con la clave nueva lo que estaba con la anterior e informa de lo ilegible', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const conVieja = await crearUsuarioPrueba(Role.SECRETARIA);
  const perdida = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    const guardadoPerdido = cifrarSecretoTotp(SECRETO, CLAVE_PERDIDA);
    await conSegundoFactor(conVieja.id, cifrarSecretoTotp(SECRETO, CLAVE_VIEJA));
    await conSegundoFactor(perdida.id, guardadoPerdido);

    const resultado = await AuthService.cifrarSecretosPendientes([conVieja.id, perdida.id]);
    assert.deepEqual(resultado, { revisados: 2, cifrados: 1, ilegibles: [perdida.id] });

    const recifrado = (await db.user.findUnique({ where: { id: conVieja.id }, select: { twoFactorSecret: true } }))!.twoFactorSecret!;
    assert.equal(leerSecretoTotp(recifrado, soloConLaNueva).secreto, SECRETO, 'ya no depende de la clave anterior');
    const intacto = (await db.user.findUnique({ where: { id: perdida.id }, select: { twoFactorSecret: true } }))!.twoFactorSecret;
    assert.equal(intacto, guardadoPerdido, 'lo ilegible no se toca: con la clave buena podría recuperarse');

    // Repetirlo no cambia nada más.
    assert.equal((await AuthService.cifrarSecretosPendientes([conVieja.id])).cifrados, 0);
  } finally {
    await borrarUsuarioPrueba(conVieja.id);
    await borrarUsuarioPrueba(perdida.id);
  }
});

// ---------------------------------------------------------------------------
//  Secreto ilegible: error claro, sin culpar al usuario
// ---------------------------------------------------------------------------

test('un secreto ilegible responde que es un problema del servidor, no que el código esté mal', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const errores: string[] = [];
  const consolaOriginal = console.error;
  try {
    await conSegundoFactor(staff.id, cifrarSecretoTotp(SECRETO, CLAVE_PERDIDA));
    const testigo = await primerFactor(staff.email);

    console.error = (...args: unknown[]) => { errores.push(args.map(String).join(' ')); };
    // Varias veces con un código bueno: tampoco debe acabar en un bloqueo por
    // «fallos» que no son del usuario.
    for (let i = 0; i < 6; i++) {
      await assert.rejects(
        AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', testigo),
        (e: unknown) => e instanceof HttpError && e.status === 500
          && /configuración del servidor/.test(e.message) && !/incorrecto/i.test(e.message)
      );
    }
    console.error = consolaOriginal;
    assert.ok(errores.some((l) => l.includes(`usuario ${staff.id}`) && l.includes('TOTP_ENC_KEY')), 'el registro dice qué cuenta y qué clave');
  } finally {
    console.error = consolaOriginal;
    await borrarUsuarioPrueba(staff.id);
  }
});

test('por HTTP, el login 2FA con un secreto ilegible no dice «Código incorrecto»', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id, cifrarSecretoTotp(SECRETO, CLAVE_PERDIDA));
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: staff.email, password: PASSWORD_PRUEBA, contexto: 'cms' })
    });
    const testigo = login.headers.getSetCookie().find((c) => c.startsWith('desamparados_2fa='))!.split(';')[0];
    const res = await fetch(`${baseUrl}/api/auth/login/2fa`, {
      method: 'POST',
      headers: { Cookie: testigo, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token2fa: codigo() })
    });
    assert.equal(res.status, 500);
    const { error } = await res.json() as { error: string };
    assert.match(error, /configuración del servidor/);
    assert.doesNotMatch(error, /incorrecto/i);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

// ---------------------------------------------------------------------------
//  Rescate por consola
// ---------------------------------------------------------------------------

test('el rescate por consola apaga el 2FA, cierra sesiones y queda auditado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  try {
    await conSegundoFactor(admin.id, cifrarSecretoTotp(SECRETO, CLAVE_PERDIDA));
    await db.user.update({ where: { id: admin.id }, data: { twoFactorLastStep: 123 } });
    await db.twoFactorBackupCode.create({ data: { userId: admin.id, codeHash: crypto.randomBytes(32).toString('hex') } });
    const antes = new Date();

    // Con mayúsculas y espacios, como se teclea en una consola.
    const resultado = await AuthService.rescatar2FADesdeConsola(`  ${admin.email.toUpperCase()} `);
    assert.equal(resultado.id, admin.id);
    assert.equal(resultado.antes.twoFactorEnabled, true);

    const cuenta = await db.user.findUnique({
      where: { id: admin.id },
      select: { twoFactorEnabled: true, twoFactorSecret: true, twoFactorLastStep: true, tokenValidAfter: true }
    });
    assert.deepEqual(
      { ...cuenta, tokenValidAfter: undefined },
      { twoFactorEnabled: false, twoFactorSecret: null, twoFactorLastStep: null, tokenValidAfter: undefined }
    );
    assert.ok(cuenta!.tokenValidAfter >= antes, 'sus sesiones abiertas quedan cerradas');
    assert.equal(await db.twoFactorBackupCode.count({ where: { userId: admin.id } }), 0);

    const registro = await db.auditLog.findFirst({
      where: { action: '2FA_RESET_ADMIN', entityId: String(admin.id) },
      orderBy: { id: 'desc' }
    });
    assert.equal((registro?.detalles as { via?: string })?.via, 'consola');
    assert.equal(registro?.ip, 'consola');
  } finally {
    await db.auditLog.deleteMany({ where: { action: '2FA_RESET_ADMIN', entityId: String(admin.id) } });
    await borrarUsuarioPrueba(admin.id);
  }
});

test('el rescate por consola de un correo que no existe lo dice', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await assert.rejects(
    AuthService.rescatar2FADesdeConsola(`no-existe-${Date.now()}@ejemplo.test`),
    (e: unknown) => e instanceof NotFoundError && /No existe ninguna cuenta/.test(e.message)
  );
});

test('el script de rescate funciona de punta a punta desde la consola', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id, cifrarSecretoTotp(SECRETO, CLAVE_PERDIDA));
    const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const ejecucion = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/rescatar-2fa.ts', staff.email], {
      cwd: raiz, encoding: 'utf8', timeout: 60_000
    });
    assert.equal(ejecucion.status, 0, `el script falló: ${ejecucion.stderr}`);
    assert.match(ejecucion.stdout, /Doble factor desactivado/);
    const cuenta = await db.user.findUnique({ where: { id: staff.id }, select: { twoFactorEnabled: true } });
    assert.equal(cuenta?.twoFactorEnabled, false);

    const sinCorreo = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/rescatar-2fa.ts', `no-existe-${Date.now()}@ejemplo.test`], {
      cwd: raiz, encoding: 'utf8', timeout: 60_000
    });
    assert.equal(sinCorreo.status, 1);
  } finally {
    await db.auditLog.deleteMany({ where: { action: '2FA_RESET_ADMIN', entityId: String(staff.id) } });
    await borrarUsuarioPrueba(staff.id);
  }
});

// ---------------------------------------------------------------------------
//  La clave anterior en el arranque (sin base de datos)
// ---------------------------------------------------------------------------

const entornoProduccion = (extra: Record<string, string>) => ({
  NODE_ENV: 'production', FRONTEND_URL: 'https://x.es', API_URL: 'https://x.es', EMAIL_USER: 'a', EMAIL_PASS: 'b',
  NUM_PROXIES: '1', JWT_SECRET: 'x'.repeat(40), TOTP_ENC_KEY: 'ab'.repeat(32), CLAMAV_HOST: '127.0.0.1',
  CLAMAV_REQUIRED: 'true', ...extra
});

test('el arranque avisa de una rotación en curso y rechaza una clave anterior mal escrita o igual', () => {
  const enCurso = validarEntorno(entornoProduccion({ TOTP_ENC_KEY_ANTERIOR: 'cd'.repeat(32) }));
  assert.deepEqual(enCurso.errores, []);
  assert.ok(enCurso.avisos.some((a) => a.includes('TOTP_ENC_KEY_ANTERIOR')));

  const malEscrita = validarEntorno(entornoProduccion({ TOTP_ENC_KEY_ANTERIOR: 'corta' }));
  assert.ok(malEscrita.errores.some((e) => e.includes('TOTP_ENC_KEY_ANTERIOR')));

  const igual = validarEntorno(entornoProduccion({ TOTP_ENC_KEY_ANTERIOR: 'AB'.repeat(32) }));
  assert.ok(igual.errores.some((e) => e.includes('igual que TOTP_ENC_KEY')));
});

test('en producción la clave anterior sirve para leer, pero no la derivada de JWT_SECRET', async () => {
  const { resolverClaveTotp } = await import('../src/utils/cifrado-totp.js');
  const conAnterior = resolverClaveTotp({
    NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40),
    TOTP_ENC_KEY: CLAVE_NUEVA.toString('hex'), TOTP_ENC_KEY_ANTERIOR: CLAVE_VIEJA.toString('hex')
  });
  assert.equal(conAnterior.anteriores.length, 1, 'solo la anterior: en producción no se prueba la derivada');
  assert.deepEqual(leerSecretoTotp(cifrarSecretoTotp(SECRETO, CLAVE_VIEJA), conAnterior), { secreto: SECRETO, recifrar: true });

  const sinAnterior = resolverClaveTotp({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), TOTP_ENC_KEY: CLAVE_NUEVA.toString('hex') });
  assert.throws(() => leerSecretoTotp(cifrarSecretoTotp(SECRETO, CLAVE_VIEJA), sinAnterior), SecretoTotpIlegibleError);
});
