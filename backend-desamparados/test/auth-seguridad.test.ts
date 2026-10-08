import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import * as OTPAuth from 'otpauth';
import { Prisma, Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken, verifyToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO, nombreCookie } from '../src/utils/cookies.js';
import { HttpError } from '../src/utils/error.handle.js';
import { checkRole } from '../src/middleware/checkRole.js';
import { AuthService, Testigo2FACaducadoError, asegurarQueQuedaOtroAdmin } from '../src/services/auth.service.js';
import { cifrarSecretoTotp, leerSecretoTotp } from '../src/utils/cifrado-totp.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { DobleFactorService } from '../src/services/doble-factor.service.js';
import { RegistroService } from '../src/services/registro.service.js';
import { consumirCodigoDeRespaldo } from '../src/services/auth/codigos-2fa.js';

/**
 * Arreglos de acceso y sesión de la auditoría del 11-09-2026 (A1-A10 y el
 * cifrado del secreto TOTP). Los que necesitan MariaDB se omiten con motivo si
 * no está levantada: omitido no es pasado.
 *
 * Casi todo va contra el servicio y no por HTTP: el limitador de /login y
 * /login/2fa deja 20 intentos por IP y este fichero entero los agotaría.
 */

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

// ---------------------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------------------

const SECRETO = 'JBSWY3DPEHPK3PXP';
const totp = new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(SECRETO) });

/** Código del intervalo actual, o de uno desplazado (+1 = el siguiente). */
const codigo = (desplazamiento = 0) => totp.generate({ timestamp: Date.now() + desplazamiento * 30_000 });

/** Un código de 6 dígitos que no vale en ninguno de los tres intervalos admitidos. */
function codigoIncorrecto(): string {
  const validos = new Set([codigo(-1), codigo(0), codigo(1)]);
  for (let n = 0; ; n++) {
    const candidato = String(n).padStart(6, '0');
    if (!validos.has(candidato)) return candidato;
  }
}

let ultimaIp = 0;
/** Cada llamada, una IP distinta: así los bloqueos por email + IP no se cruzan entre tests. */
const ipUnica = () => `10.9.${Math.floor(++ultimaIp / 250)}.${ultimaIp % 250}`;

/** Cuenta con 2FA activo. Por defecto el secreto va en claro, como los de antes del cifrado. */
async function conSegundoFactor(id: number, guardado: string = SECRETO) {
  await db.user.update({ where: { id }, data: { twoFactorEnabled: true, twoFactorSecret: guardado } });
}

async function secretoGuardado(id: number) {
  return db.user.findUnique({ where: { id }, select: { twoFactorSecret: true, twoFactorEnabled: true, twoFactorLastStep: true } });
}

const cookieSesion = (id: number, role: Role, origen: 'cms' | 'hermanos' = 'cms') =>
  `${nombreCookie(origen)}=${generateToken(id, role, false, origen)}`;

async function peticion(ruta: string, cookie: string, metodo = 'POST', cuerpo?: unknown) {
  return fetch(`${baseUrl}/api${ruta}`, {
    method: metodo,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
}

/** Primer factor por el servicio: devuelve el testigo pendiente ya decodificado. */
async function primerFactor(email: string) {
  const respuesta = await AuthService.loginUser({ email, password: PASSWORD_PRUEBA, contexto: 'cms' }, ipUnica());
  if (respuesta.status !== '2FA_NEEDED') throw new Error('se esperaba que pidiera el segundo factor');
  return verifyToken(respuesta.pendingToken, '2fa_pending')!;
}

const conEstado = (status: number) => (e: unknown) => e instanceof HttpError && e.status === status;

function cookieDe(res: Response, nombre: string): string | undefined {
  return res.headers.getSetCookie().find((c) => c.startsWith(`${nombre}=`))?.split(';')[0];
}

// ---------------------------------------------------------------------------
//  A1: desactivar el 2FA exige sesión del CMS y cuenta los fallos
// ---------------------------------------------------------------------------

test('desactivar el 2FA desde una sesión del área de hermanos responde 403 y no lo apaga', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    const res = await peticion('/auth/2fa/disable', cookieSesion(staff.id, Role.SECRETARIA, 'hermanos'), 'POST', { token2fa: codigo() });
    assert.equal(res.status, 403, 'una sesión sin 2FA no puede quitar el 2FA');
    assert.equal((await secretoGuardado(staff.id))?.twoFactorEnabled, true);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('los fallos al desactivar el 2FA cuentan para el mismo bloqueo que el login', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    const cookie = cookieSesion(staff.id, Role.SECRETARIA);

    for (let i = 0; i < 5; i++) {
      const fallo = await peticion('/auth/2fa/disable', cookie, 'POST', { token2fa: codigoIncorrecto() });
      // 400 y no 401: el frontend trata un 401 como sesión caducada.
      assert.equal(fallo.status, 400, `intento ${i + 1}`);
    }

    const bloqueado = await peticion('/auth/2fa/disable', cookie, 'POST', { token2fa: codigo() });
    assert.equal(bloqueado.status, 429, 'tras cinco fallos ni el código bueno pasa');
    assert.equal((await secretoGuardado(staff.id))?.twoFactorEnabled, true);

    // Y el mismo contador cierra el login con 2FA de esa cuenta.
    await assert.rejects(AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', { paso2fa: null }), conEstado(429));
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

// ---------------------------------------------------------------------------
//  A2: el rescate del 2FA
// ---------------------------------------------------------------------------

test('el rescate del 2FA es solo para ADMIN', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
  const objetivo = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    await conSegundoFactor(objetivo.id);
    const res = await peticion(`/auth/admin/reset-2fa/${objetivo.id}`, cookieSesion(secretaria.id, Role.SECRETARIA));
    assert.equal(res.status, 403);
    assert.equal((await secretoGuardado(objetivo.id))?.twoFactorEnabled, true);
  } finally {
    await borrarUsuarioPrueba(secretaria.id);
    await borrarUsuarioPrueba(objetivo.id);
  }
});

test('un ADMIN no puede rescatar su propia cuenta', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  try {
    await conSegundoFactor(admin.id);
    const res = await peticion(`/auth/admin/reset-2fa/${admin.id}`, cookieSesion(admin.id, Role.ADMIN));
    assert.equal(res.status, 403);
    assert.equal((await secretoGuardado(admin.id))?.twoFactorEnabled, true);
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

test('el rescate de un id que no existe responde 404, no 500', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  try {
    const res = await peticion('/auth/admin/reset-2fa/2147483000', cookieSesion(admin.id, Role.ADMIN));
    assert.equal(res.status, 404);
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

test('el rescate apaga el 2FA, cierra sus sesiones y queda auditado con el antes y el después', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  const objetivo = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    await conSegundoFactor(objetivo.id);
    const sesionObjetivo = cookieSesion(objetivo.id, Role.TESORERIA);

    const res = await peticion(`/auth/admin/reset-2fa/${objetivo.id}`, cookieSesion(admin.id, Role.ADMIN));
    assert.equal(res.status, 200);

    const estado = await secretoGuardado(objetivo.id);
    assert.equal(estado?.twoFactorEnabled, false);
    assert.equal(estado?.twoFactorSecret, null);
    // /auth/me ya no da 401 (responde 200 siempre, tarea 7): la sesión muerta
    // se comprueba contra una ruta que sigue exigiendo sesión de verdad.
    assert.equal((await peticion('/auth/mis-datos', sesionObjetivo, 'GET')).status, 401, 'sus sesiones abiertas deben caer');

    const registro = await db.auditLog.findFirst({
      where: { action: '2FA_RESET_ADMIN', entityType: 'user', entityId: String(objetivo.id) },
      orderBy: { id: 'desc' }
    });
    assert.ok(registro, 'el rescate debe quedar en la auditoría');
    assert.equal(registro.userId, admin.id);
    const detalles = registro.detalles as { antes?: { twoFactorEnabled?: boolean }; despues?: { twoFactorEnabled?: boolean } };
    assert.equal(detalles.antes?.twoFactorEnabled, true);
    assert.equal(detalles.despues?.twoFactorEnabled, false);
  } finally {
    await db.auditLog.deleteMany({ where: { action: '2FA_RESET_ADMIN', entityId: String(objetivo.id) } });
    await borrarUsuarioPrueba(admin.id);
    await borrarUsuarioPrueba(objetivo.id);
  }
});

// ---------------------------------------------------------------------------
//  A3: repetición de códigos y testigo de un solo uso
// ---------------------------------------------------------------------------

test('un TOTP aceptado en el login no vale una segunda vez', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    const bueno = codigo();

    const primero = await primerFactor(staff.email);
    const entrada = await AuthService.verifyLogin2FA(staff.id, bueno, false, 'cms', primero);
    assert.equal(entrada.status, 'OK');

    // Testigo nuevo (contraseña otra vez), mismo código: ya se gastó.
    const segundo = await primerFactor(staff.email);
    await assert.rejects(
      AuthService.verifyLogin2FA(staff.id, bueno, false, 'cms', segundo),
      (e: unknown) => e instanceof HttpError && e.status === 401 && /ya se ha usado/.test(e.message)
    );
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('el testigo del primer factor es de un solo uso', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: staff.email, password: PASSWORD_PRUEBA, contexto: 'cms' })
    });
    const testigo = cookieDe(login, 'desamparados_2fa');
    assert.ok(testigo, 'el primer factor debe dejar el testigo');

    const verificar = (token2fa: string) => fetch(`${baseUrl}/api/auth/login/2fa`, {
      method: 'POST',
      headers: { Cookie: testigo!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token2fa })
    });

    assert.equal((await verificar(codigo())).status, 200);

    // El mismo testigo copiado, con un código nuevo y bueno: no debe dar otra sesión.
    const repetido = await verificar(codigo(1));
    assert.equal(repetido.status, 401);
    assert.equal((await repetido.json() as { error?: string }).error, 'PENDING_2FA_REQUIRED');
    // Ni sesión nueva ni borrado de la que hubiera: solo se va la cookie del 2FA.
    assert.equal(cookieDe(repetido, COOKIE_CMS), undefined, 'la cookie del CMS no se toca');
    assert.equal(cookieDe(repetido, COOKIE_HERMANO), undefined, 'ni la del área de hermanos');
    assert.ok(cookieDe(repetido, 'desamparados_2fa') !== undefined, 'la del testigo sí se borra');
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('dos verificaciones simultáneas con el mismo código: solo entra una', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id, cifrarSecretoTotp(SECRETO));
    const testigo = await primerFactor(staff.email);
    const bueno = codigo();

    const resultados = await Promise.allSettled([
      AuthService.verifyLogin2FA(staff.id, bueno, false, 'cms', testigo),
      AuthService.verifyLogin2FA(staff.id, bueno, false, 'cms', testigo)
    ]);
    assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
    const perdedor = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.ok(perdedor.reason instanceof HttpError, `el perdedor debe recibir un error de negocio, no ${perdedor.reason}`);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('el código usado para entrar no sirve para desactivar el 2FA', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    const bueno = codigo();
    const testigo = await primerFactor(staff.email);
    await AuthService.verifyLogin2FA(staff.id, bueno, false, 'cms', testigo);

    await assert.rejects(
      DobleFactorService.disable2FA(staff.id, bueno),
      (e: unknown) => e instanceof HttpError && e.status === 400 && /ya se ha usado/.test(e.message)
    );
    assert.equal((await secretoGuardado(staff.id))?.twoFactorEnabled, true);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('un código de respaldo también gasta el testigo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    // El hash es único en toda la tabla: el código lleva el id para no chocar.
    const propio = `ABCD-EFGH-${staff.id}`;
    await db.twoFactorBackupCode.create({
      data: { userId: staff.id, codeHash: crypto.createHash('sha256').update(propio).digest('hex') }
    });

    const testigo = await primerFactor(staff.email);
    const entrada = await AuthService.verifyLogin2FA(staff.id, propio, false, 'cms', testigo);
    assert.equal(entrada.status, 'OK');

    await assert.rejects(
      AuthService.verifyLogin2FA(staff.id, codigo(1), false, 'cms', testigo),
      (e: unknown) => e instanceof Testigo2FACaducadoError
    );
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('la activación rechaza un código de un intervalo ya usado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    const pasoActual = OTPAuth.TOTP.counter({ period: 30 });
    await db.user.update({
      where: { id: staff.id },
      data: { twoFactorSecret: cifrarSecretoTotp(SECRETO), twoFactorLastStep: pasoActual + 1 }
    });
    await assert.rejects(
      DobleFactorService.enable2FA(staff.id, codigo()),
      (e: unknown) => e instanceof HttpError && /ya se ha usado/.test(e.message)
    );
    assert.equal((await secretoGuardado(staff.id))?.twoFactorEnabled, false);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

// ---------------------------------------------------------------------------
//  A4 y cifrado: generar el QR
// ---------------------------------------------------------------------------

test('generar el QR con el 2FA activo responde 409 y no toca el secreto', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    const guardado = cifrarSecretoTotp(SECRETO);
    await conSegundoFactor(staff.id, guardado);
    const res = await peticion('/auth/2fa/generate', cookieSesion(staff.id, Role.SECRETARIA));
    assert.equal(res.status, 409);
    assert.match((await res.json() as { error: string }).error, /desactívalo primero/i);
    assert.equal((await secretoGuardado(staff.id))?.twoFactorSecret, guardado);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('generar el QR ya no se sirve por GET', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    const res = await peticion('/auth/2fa/generate', cookieSesion(staff.id, Role.SECRETARIA), 'GET');
    assert.equal(res.status, 404);
    assert.equal((await secretoGuardado(staff.id))?.twoFactorSecret, null);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('el QR nuevo guarda el secreto cifrado y se activa con su código', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    const cookie = cookieSesion(staff.id, Role.SECRETARIA);
    const res = await peticion('/auth/2fa/generate', cookie);
    assert.equal(res.status, 200);
    const { secret } = await res.json() as { secret: string };

    const guardado = (await secretoGuardado(staff.id))!.twoFactorSecret!;
    assert.ok(guardado.startsWith('v1:'), 'el secreto debe guardarse cifrado');
    assert.ok(!guardado.includes(secret));
    assert.equal(leerSecretoTotp(guardado).secreto, secret);

    const suyo = new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
    const activar = await peticion('/auth/2fa/enable', cookie, 'POST', { token2fa: suyo.generate() });
    assert.equal(activar.status, 200);
    assert.equal((await activar.json() as { backupCodes: string[] }).backupCodes.length, 8);
    assert.equal((await secretoGuardado(staff.id))?.twoFactorEnabled, true);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('un secreto antiguo en claro sigue valiendo y se cifra al usarlo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id, SECRETO);
    const testigo = await primerFactor(staff.email);
    const entrada = await AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', testigo);
    assert.equal(entrada.status, 'OK');

    const guardado = (await secretoGuardado(staff.id))!.twoFactorSecret!;
    assert.ok(guardado.startsWith('v1:'), 'tras usarlo debe quedar cifrado');
    assert.equal(leerSecretoTotp(guardado).secreto, SECRETO);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('el script cifra los secretos en claro y se puede repetir sin efecto', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const enClaro = await crearUsuarioPrueba(Role.SECRETARIA);
  const yaCifrado = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    await conSegundoFactor(enClaro.id, SECRETO);
    const cifrado = cifrarSecretoTotp(SECRETO);
    await conSegundoFactor(yaCifrado.id, cifrado);

    const primera = await DobleFactorService.cifrarSecretosPendientes([enClaro.id, yaCifrado.id]);
    assert.deepEqual(primera, { revisados: 2, cifrados: 1, ilegibles: [] });
    assert.ok((await secretoGuardado(enClaro.id))!.twoFactorSecret!.startsWith('v1:'));
    assert.equal((await secretoGuardado(yaCifrado.id))!.twoFactorSecret, cifrado, 'el ya cifrado no se reescribe');

    const segunda = await DobleFactorService.cifrarSecretosPendientes([enClaro.id, yaCifrado.id]);
    assert.equal(segunda.cifrados, 0);
  } finally {
    await borrarUsuarioPrueba(enClaro.id);
    await borrarUsuarioPrueba(yaCifrado.id);
  }
});

// ---------------------------------------------------------------------------
//  A5 y A7: login sin pistas y bloqueos acotados
// ---------------------------------------------------------------------------

async function tiempoDeLogin(email: string): Promise<number> {
  const inicio = performance.now();
  await AuthService.loginUser({ email, password: 'Contraseña-Equivocada-1', contexto: 'hermanos' }, ipUnica()).catch(() => undefined);
  return performance.now() - inicio;
}

const mediana = (valores: number[]) => [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)];

test('un email que no existe tarda lo mismo que una contraseña equivocada', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const inexistente = `no-existe-${Date.now()}@ejemplo.test`;
    // Calentamiento: la primera consulta de cada tipo paga la conexión.
    await tiempoDeLogin(hermano.email);
    await tiempoDeLogin(inexistente);

    const existente: number[] = [];
    const noExiste: number[] = [];
    for (let i = 0; i < 3; i++) {
      existente.push(await tiempoDeLogin(hermano.email));
      noExiste.push(await tiempoDeLogin(inexistente));
    }
    // Sin el señuelo, el inexistente se ahorraba el bcrypt entero: unas veinte
    // veces más rápido. La mitad deja margen de sobra al ruido.
    assert.ok(
      mediana(noExiste) >= mediana(existente) * 0.5,
      `inexistente ${mediana(noExiste).toFixed(1)} ms frente a existente ${mediana(existente).toFixed(1)} ms`
    );
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('un email que no existe también acaba bloqueado, igual que uno real', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const email = `no-existe-bloqueo-${Date.now()}@ejemplo.test`;
  const ip = ipUnica();
  for (let i = 0; i < 5; i++) {
    await assert.rejects(AuthService.loginUser({ email, password: 'x', contexto: 'hermanos' }, ip), conEstado(401));
  }
  // Si solo se bloquearan los reales, el 429 diría qué correos existen.
  await assert.rejects(AuthService.loginUser({ email, password: 'x', contexto: 'hermanos' }, ip), conEstado(429));
});

test('cinco fallos desde una IP no dejan fuera a la cuenta desde otra', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const atacante = ipUnica();
    for (let i = 0; i < 5; i++) {
      await assert.rejects(
        AuthService.loginUser({ email: hermano.email, password: 'Contraseña-Equivocada-1', contexto: 'hermanos' }, atacante),
        conEstado(401)
      );
    }
    await assert.rejects(
      AuthService.loginUser({ email: hermano.email, password: PASSWORD_PRUEBA, contexto: 'hermanos' }, atacante),
      conEstado(429),
      'desde la IP que falló, bloqueado aunque acierte'
    );

    const suya = await AuthService.loginUser({ email: hermano.email, password: PASSWORD_PRUEBA, contexto: 'hermanos' }, ipUnica());
    assert.equal(suya.status, 'OK', 'desde otra IP, el dueño entra');
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

// Quien recupera la contraseña suele venir de fallar varias veces: con la
// nueva recién puesta, el acceso le seguía diciendo que esperara 15 minutos.
test('restablecer la contraseña quita el bloqueo y se entra con la nueva', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const suIp = ipUnica();
    for (let i = 0; i < 5; i++) {
      await assert.rejects(
        AuthService.loginUser({ email: hermano.email, password: 'Contraseña-Equivocada-1', contexto: 'hermanos' }, suIp),
        conEstado(401)
      );
    }
    // Y el bloqueo por cuenta, que se dispara desde muchas redes.
    for (let i = 0; i < 50; i++) {
      await AuthService.loginUser({ email: hermano.email, password: 'Contraseña-Equivocada-1', contexto: 'hermanos' }, ipUnica())
        .catch(() => undefined);
    }

    const nueva = 'Cirio-Granate-Nueva-2026';
    const enlace = await AuthService.crearEnlaceDeContrasena(hermano.id, 1);
    await AuthService.resetPassword(enlace, nueva);

    const entrada = await AuthService.loginUser({ email: hermano.email, password: nueva, contexto: 'hermanos' }, suIp);
    assert.equal(entrada.status, 'OK', 'desde la misma red en que falló, entra con la contraseña nueva');
    await assert.rejects(
      AuthService.loginUser({ email: hermano.email, password: PASSWORD_PRUEBA, contexto: 'hermanos' }, ipUnica()),
      conEstado(401),
      'la contraseña vieja ya no vale'
    );
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('muchos fallos repartidos entre IP bloquean la cuenta en todas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    // Un fallo por IP: el primer nivel no ve nada, el umbral por email sí.
    for (let i = 0; i < 50; i++) {
      await AuthService.loginUser({ email: hermano.email, password: 'Contraseña-Equivocada-1', contexto: 'hermanos' }, ipUnica())
        .catch(() => undefined);
    }
    await assert.rejects(
      AuthService.loginUser({ email: hermano.email, password: PASSWORD_PRUEBA, contexto: 'hermanos' }, ipUnica()),
      conEstado(429)
    );
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

// ---------------------------------------------------------------------------
//  A8: consumo atómico del código de respaldo
// ---------------------------------------------------------------------------

test('un código de respaldo solo se consume una vez aunque lleguen dos a la vez', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    const codigoRespaldo = `CARR-ERAS-${staff.id}`;
    await db.twoFactorBackupCode.create({
      data: { userId: staff.id, codeHash: crypto.createHash('sha256').update(codigoRespaldo).digest('hex') }
    });

    // Se llama directo para medir la carrera sin el resto del login alrededor.
    // Antes hacía falta un `as unknown as` para alcanzarlo, porque era un
    // método privado del servicio; ahora es una función de `auth/codigos-2fa`.
    const resultados = await Promise.all([
      consumirCodigoDeRespaldo(staff.id, codigoRespaldo),
      consumirCodigoDeRespaldo(staff.id, codigoRespaldo),
    ]);
    assert.deepEqual([...resultados].sort(), [false, true], 'uno gana y el otro recibe false, no un 500');
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

// ---------------------------------------------------------------------------
//  A6: cerrar sesión revoca el token
// ---------------------------------------------------------------------------

test('cerrar sesión revoca el token en todos los dispositivos y deja entrar al instante', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  const entrar = async () => cookieDe(await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: hermano.email, password: PASSWORD_PRUEBA, contexto: 'hermanos' })
  }), COOKIE_HERMANO)!;

  // /auth/me responde 200 siempre desde la tarea 7 (aunque el token esté
  // muerto): para comprobar de verdad si una sesión sigue viva hace falta una
  // ruta que exija authenticateToken de verdad.
  const sesionViva = (cookie: string) => peticion('/auth/mis-datos', cookie, 'GET');

  try {
    const movil = await entrar();
    const ordenador = await entrar();
    assert.equal((await sesionViva(movil)).status, 200);

    const salida = await peticion('/auth/logout', ordenador);
    assert.equal(salida.status, 204);

    assert.equal((await sesionViva(ordenador)).status, 401, 'el token copiado de este equipo ya no vale');
    assert.equal((await sesionViva(movil)).status, 401, 'y tampoco el del otro dispositivo');

    // Justo después, en el mismo segundo casi seguro: el login nuevo vale.
    const otraVez = await entrar();
    assert.equal((await sesionViva(otraVez)).status, 200, 'la granularidad de segundos no puede tumbar el login siguiente');
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

// ---------------------------------------------------------------------------
//  A9: borrar la propia cuenta
// ---------------------------------------------------------------------------

test('un cargo no puede borrar su cuenta desde una sesión del área de hermanos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    const res = await peticion('/auth/mi-cuenta', cookieSesion(staff.id, Role.TESORERIA, 'hermanos'), 'DELETE', { password: PASSWORD_PRUEBA });
    assert.equal(res.status, 403);
    const sigue = await db.user.findUnique({ where: { id: staff.id }, select: { active: true, email: true } });
    assert.equal(sigue?.active, true);
    assert.equal(sigue?.email, staff.email);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

// La regla del último ADMIN se prueba con una transacción de mentira: la base
// de desarrollo tiene su propio ADMIN y no se puede vaciar para el test.
test('el último ADMIN activo no puede borrarse', async () => {
  const txCon = (admins: number) =>
    ({ $queryRaw: async () => Array.from({ length: admins }, (_, i) => ({ id: i + 1 })) }) as unknown as Prisma.TransactionClient;

  await assert.rejects(asegurarQueQuedaOtroAdmin(txCon(1), Role.ADMIN), conEstado(409));
  await asegurarQueQuedaOtroAdmin(txCon(2), Role.ADMIN);

  // A quien no es ADMIN ni se le cuenta.
  const sinContar = { $queryRaw: async () => { throw new Error('no debería contar'); } } as unknown as Prisma.TransactionClient;
  await asegurarQueQuedaOtroAdmin(sinContar, Role.SECRETARIA);
});

test('un ADMIN con otros administradores activos sí puede borrarse desde el CMS', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  try {
    const activos = await db.user.count({ where: { role: Role.ADMIN, active: true } });
    if (activos < 2) return t.skip('la base de desarrollo no tiene otro ADMIN activo: este sería el último');

    const res = await peticion('/auth/mi-cuenta', cookieSesion(admin.id, Role.ADMIN), 'DELETE', { password: PASSWORD_PRUEBA });
    assert.equal(res.status, 200);
    const despues = await db.user.findUnique({ where: { id: admin.id }, select: { active: true, email: true } });
    assert.equal(despues?.active, false);
    assert.equal(despues?.email, `anon-${admin.id}@eliminado.local`);

    const registro = await db.auditLog.findFirst({ where: { action: 'CUENTA_AUTODELETE', entityId: String(admin.id) } });
    assert.ok(registro, 'el borrado confirmado debe quedar auditado');
  } finally {
    await db.auditLog.deleteMany({ where: { action: 'CUENTA_AUTODELETE', entityId: String(admin.id) } });
    await borrarUsuarioPrueba(admin.id);
  }
});

// Quien vuelve tras una baja conserva su ficha con el DNI: registrarse de nuevo
// chocaba con el índice único de `Hermano.dni` y daba un 500.
// Y no responde 409: eso diría quién está en el censo (ver alta-sin-delatar.test.ts).
test('registrarse con el DNI de una ficha que ya existe no crea nada', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const antiguo = await crearUsuarioPrueba(Role.USER);
  const dni = `F${Date.now()}`;
  const emailNuevo = `prueba-registro-${Date.now()}@ejemplo.test`;
  const ficha = await db.hermano.create({
    data: {
      userId: antiguo.id, nombre: 'Prueba', apellidos: 'De baja', dni, fechaNacimiento: new Date('1990-01-01'),
      activo: false, fechaBaja: new Date(), esTitular: true
    }
  });
  try {
    const respuesta = await RegistroService.registerUser({
      usuario: { email: emailNuevo, dni, password: PASSWORD_PRUEBA, nombre: 'Prueba', apellidos: 'Vuelve', telefono: '600000000' },
      titular: { fechaNacimiento: '1990-01-01', sexo: 'HOMBRE', estadoCivil: 'SOLTERO', fechaBautismo: '1990-12-28' }
    } as never);
    assert.equal(respuesta.creada, false);
    assert.equal(await db.user.count({ where: { email: emailNuevo } }), 0, 'no debe quedar una cuenta a medias');
  } finally {
    await db.user.deleteMany({ where: { email: emailNuevo } });
    await db.hermano.deleteMany({ where: { id: ficha.id } });
    await borrarUsuarioPrueba(antiguo.id);
  }
});

// ---------------------------------------------------------------------------
//  A10: checkRole mira req.sesiones, nunca req.user
// ---------------------------------------------------------------------------
//
// Antes, un token sin claim de origen llegaba a checkRole como req.user y
// producía el 403 SESION_NO_CMS. Con la tarea 5, checkRole ya no mira
// req.user: mira req.sesiones.cms, y ese caso ya no puede darse, porque
// validateSessionAgainstDb rechaza antes cualquier token sin origen (no llega
// ni a rellenar req.sesiones.cms ni req.sesiones.hermano). Lo que importa
// ahora son los dos casos reales de req.sesiones que resolverSesiones deja.

test('con sesión de hermanos pero sin la del CMS, checkRole responde 403 con el código de sesión no CMS', () => {
  let estado = 0;
  let cuerpo: { error?: string } = {};
  let siguiente = false;
  const res = {
    status(codigoHttp: number) { estado = codigoHttp; return this; },
    json(datos: { error?: string }) { cuerpo = datos; return this; }
  };
  const req = { sesiones: { cms: null, hermano: { id: 1, role: Role.ADMIN, typ: 'session' as const, origen: 'hermanos' as const } } };
  checkRole([Role.ADMIN])(req as never, res as never, () => { siguiente = true; });
  assert.equal(siguiente, false);
  assert.equal(estado, 403);
  // El frontend distingue por este código una sesión perdida para el CMS de un 403 de permisos.
  assert.equal(cuerpo.error, 'SESION_NO_CMS');
});

test('sin ninguna sesión, checkRole responde 401 y no el código de sesión no CMS', () => {
  let estado = 0;
  let cuerpo: { error?: string } = {};
  let siguiente = false;
  const res = {
    status(codigoHttp: number) { estado = codigoHttp; return this; },
    json(datos: { error?: string }) { cuerpo = datos; return this; }
  };
  const req = { sesiones: { cms: null, hermano: null } };
  checkRole([Role.ADMIN])(req as never, res as never, () => { siguiente = true; });
  assert.equal(siguiente, false);
  assert.equal(estado, 401);
  // Sin ninguna sesión es un 401 normal, no el 403 de "te falta el CMS".
  assert.notEqual(cuerpo.error, 'SESION_NO_CMS');
});

test('el 403 de permisos no lleva el código de sesión no CMS', () => {
  let cuerpo: { error?: string } = {};
  const res = {
    status() { return this; },
    json(datos: { error?: string }) { cuerpo = datos; return this; }
  };
  const req = { user: { id: 1, role: Role.REDES, typ: 'session', origen: 'cms' } };
  checkRole([Role.ADMIN])(req as never, res as never, () => undefined);
  assert.notEqual(cuerpo.error, 'SESION_NO_CMS');
});

test('un testigo de 2FA sin origen da una sesión que no entra en el CMS', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  try {
    await conSegundoFactor(admin.id);
    // Como los testigos de antes del claim: sin `origen`.
    const testigo = jwt.sign(
      { id: admin.id, role: '', typ: '2fa_pending', rem: false, paso2fa: null, emitidoMs: Date.now() },
      process.env.JWT_SECRET!,
      { expiresIn: 300, algorithm: 'HS256' }
    );
    const res = await fetch(`${baseUrl}/api/auth/login/2fa`, {
      method: 'POST',
      headers: { Cookie: `desamparados_2fa=${testigo}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token2fa: codigo() })
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json() as { user: { origen: string } }).user.origen, 'hermanos');

    const cms = await peticion('/news/admin/archive', cookieDe(res, COOKIE_HERMANO)!, 'GET');
    assert.equal(cms.status, 403);
    assert.equal((await cms.json() as { error?: string }).error, 'SESION_NO_CMS');
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

// ---------------------------------------------------------------------------
//  El acceso del CMS no da sesión a quien no es del equipo
// ---------------------------------------------------------------------------

test('el acceso del CMS no crea sesión para una cuenta de hermano', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: hermano.email, password: PASSWORD_PRUEBA, contexto: 'cms' })
    });
    assert.equal(res.status, 403);
    assert.equal((await res.json() as { error?: string }).error, 'CUENTA_SIN_CMS');
    assert.equal(cookieDe(res, COOKIE_CMS), undefined, 'ni se crea la sesión del CMS que antes el frontend tenía que cerrar');
    assert.equal(cookieDe(res, COOKIE_HERMANO), undefined, 'ni tampoco una del área de hermanos');
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

// El limitador por IP de la entrada contaba también los aciertos: veinte
// personas que entraban bien desde una misma red (el wifi de la casa de
// hermandad, los móviles que comparten IP en su operadora) dejaban a la
// siguiente quince minutos fuera con la contraseña buena.
test('entrar bien muchas veces desde una misma IP no agota el limitador', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    for (let i = 0; i < 25; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: hermano.email, password: PASSWORD_PRUEBA, contexto: 'hermanos' })
      });
      assert.equal(res.status, 200, `el acceso n.º ${i + 1} tiene que entrar`);
    }
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});
