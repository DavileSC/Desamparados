import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import * as OTPAuth from 'otpauth';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken, generatePending2FAToken, verifyToken } from '../src/utils/jwt.handle.js';
import { COOKIE_HERMANO, COOKIE_2FA } from '../src/utils/cookies.js';
import { HttpError } from '../src/utils/error.handle.js';
import { AuthService, Testigo2FACaducadoError, asegurarQueQuedaOtroAdmin } from '../src/services/auth.service.js';
import { EmailService } from '../src/services/email.service.js';
import { cifrarSecretoTotp } from '../src/utils/cifrado-totp.js';
import { VALOR_SUPRIMIDO } from '../src/domain/auditoria-supresion.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { MisDatosService } from '../src/services/mis-datos.service.js';
import { DobleFactorService } from '../src/services/doble-factor.service.js';
import { reclamarTotp } from '../src/services/auth/codigos-2fa.js';
import { SIN_DB } from './fixtures/sin-db.js';

/**
 * Fallos que encontró la revisión independiente de los arreglos de acceso del
 * 11-09-2026 (puntos 2 a 14 del encargo; el 1, la rotación de la clave del
 * 2FA, va en rotacion-totp.test.ts porque necesita su propio entorno).
 *
 * Casi todo va contra el servicio: el limitador de /login deja 20 intentos
 * por IP y este fichero entero los agotaría.
 */

let server: Server;
let baseUrl: string;
let dbDisponible = false;

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
const totpDe = (secreto: string) =>
  new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secreto) });
const codigo = (desplazamiento = 0, secreto = SECRETO) =>
  totpDe(secreto).generate({ timestamp: Date.now() + desplazamiento * 30_000 });

let ultimaIp = 0;
const ipUnica = () => `10.8.${Math.floor(++ultimaIp / 250)}.${ultimaIp % 250}`;

async function conSegundoFactor(id: number, guardado: string = cifrarSecretoTotp(SECRETO)) {
  await db.user.update({ where: { id }, data: { twoFactorEnabled: true, twoFactorSecret: guardado } });
}

async function primerFactor(email: string) {
  const respuesta = await AuthService.loginUser({ email, password: PASSWORD_PRUEBA, contexto: 'cms' }, ipUnica());
  if (respuesta.status !== '2FA_NEEDED') throw new Error('se esperaba que pidiera el segundo factor');
  return verifyToken(respuesta.pendingToken, '2fa_pending')!;
}

const conEstado = (status: number) => (e: unknown) => e instanceof HttpError && e.status === status;
const hashRespaldo = (codigoRespaldo: string) => crypto.createHash('sha256').update(codigoRespaldo).digest('hex');

// ---------------------------------------------------------------------------
//  2. Activar no puede quedarse con un secreto distinto del comprobado
// ---------------------------------------------------------------------------

test('activar el 2FA falla con 409 si el secreto cambia entre la comprobación y la escritura', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  // Un «generar QR» de otra pestaña justo entre el código y la activación: se
  // provoca en ese punto exacto envolviendo la comprobación del TOTP, que el
  // servicio admite sustituir precisamente para esto.
  const comprobarYPisarElSecreto: typeof reclamarTotp = async (user, codigo) => {
    const resultado = await reclamarTotp(user, codigo);
    await db.user.update({ where: { id: staff.id }, data: { twoFactorSecret: cifrarSecretoTotp('KRSXG5CTMVRXEZLU') } });
    return resultado;
  };
  try {
    await db.user.update({ where: { id: staff.id }, data: { twoFactorSecret: cifrarSecretoTotp(SECRETO) } });

    await assert.rejects(DobleFactorService.enable2FA(staff.id, codigo(), comprobarYPisarElSecreto), conEstado(409));
    const cuenta = await db.user.findUnique({ where: { id: staff.id }, select: { twoFactorEnabled: true } });
    assert.equal(cuenta?.twoFactorEnabled, false, 'no puede quedar activo con un secreto que nadie ha escaneado');
    assert.equal(await db.twoFactorBackupCode.count({ where: { userId: staff.id } }), 0);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

// ---------------------------------------------------------------------------
//  3. El testigo del primer factor muere con la cuenta tal como estaba
// ---------------------------------------------------------------------------

test('un cambio de contraseña entre los dos pasos invalida el testigo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    const testigo = await primerFactor(staff.email);

    const enlace = await AuthService.crearEnlaceDeContrasena(staff.id, 1);
    await AuthService.resetPassword(enlace, 'Otra-Clave-Distinta-2026');

    await assert.rejects(
      AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', testigo),
      (e: unknown) => e instanceof Testigo2FACaducadoError
    );
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('cerrar todas las sesiones entre los dos pasos invalida el testigo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    const testigo = await primerFactor(staff.email);
    await AuthService.cerrarSesionesDe(staff.id);
    await assert.rejects(
      AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', testigo),
      (e: unknown) => e instanceof Testigo2FACaducadoError
    );
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('una cuenta desactivada entre los dos pasos no recibe sesión', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    const testigo = await primerFactor(staff.email);
    await db.user.update({ where: { id: staff.id }, data: { active: false } });
    await assert.rejects(
      AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', testigo),
      (e: unknown) => e instanceof Testigo2FACaducadoError
    );
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('un testigo sin momento de emisión no vale', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    await assert.rejects(
      AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', { paso2fa: null }),
      (e: unknown) => e instanceof Testigo2FACaducadoError
    );
    // Y con él, el mismo código entra: lo que falla es el testigo, no el código.
    const bueno = verifyToken(generatePending2FAToken(staff.id, false, 'cms', null), '2fa_pending')!;
    assert.equal((await AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', bueno)).status, 'OK');
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

// ---------------------------------------------------------------------------
//  4. Bloqueo por red IPv6 y sin dejar fuera al dueño
// ---------------------------------------------------------------------------

test('cinco fallos desde una misma red IPv6 /56 bloquean toda esa red', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  const intento = (ip: string, password = 'Contraseña-Equivocada-1') =>
    AuthService.loginUser({ email: hermano.email, password, contexto: 'hermanos' }, ip);
  try {
    // Cada fallo desde una /128 distinta, como haría quien tiene un /64 entero.
    for (let i = 1; i <= 5; i++) {
      await assert.rejects(intento(`2001:db8:abcd:1200::${i}`), conEstado(401));
    }
    await assert.rejects(intento('2001:db8:abcd:12ff::9', PASSWORD_PRUEBA), conEstado(429), 'misma /56, bloqueada');
    const otraRed = await intento('2001:db8:abcd:1300::1', PASSWORD_PRUEBA);
    assert.equal(otraRed.status, 'OK', 'otra /56 no está bloqueada');
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('el bloqueo global por email no deja fuera al dueño desde la red en la que ya entró', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  const intento = (ip: string, password = 'Contraseña-Equivocada-1') =>
    AuthService.loginUser({ email: hermano.email, password, contexto: 'hermanos' }, ip);
  try {
    const suya = ipUnica();
    assert.equal((await intento(suya, PASSWORD_PRUEBA)).status, 'OK');

    // Ataque repartido: un fallo por IP hasta el umbral global.
    for (let i = 0; i < 50; i++) await intento(ipUnica()).catch(() => undefined);

    await assert.rejects(intento(ipUnica(), PASSWORD_PRUEBA), conEstado(429), 'desde una red nueva, bloqueado');
    assert.equal((await intento(suya, PASSWORD_PRUEBA)).status, 'OK', 'desde su red de siempre, entra');
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

// ---------------------------------------------------------------------------
//  6. Un respaldo no se gasta sin dar sesión
// ---------------------------------------------------------------------------

test('respaldo y TOTP con el mismo testigo a la vez: entra uno y el respaldo solo se gasta si gana', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const staff = await crearUsuarioPrueba(Role.SECRETARIA);
    try {
      await conSegundoFactor(staff.id);
      const respaldo = `RESP-ALDO-${staff.id}`;
      await db.twoFactorBackupCode.create({ data: { userId: staff.id, codeHash: hashRespaldo(respaldo) } });
      const testigo = await primerFactor(staff.email);

      const [conRespaldo, conTotp] = await Promise.allSettled([
        AuthService.verifyLogin2FA(staff.id, respaldo, false, 'cms', testigo),
        AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', testigo)
      ]);
      const ganadores = [conRespaldo, conTotp].filter((r) => r.status === 'fulfilled').length;
      assert.equal(ganadores, 1, `vuelta ${vuelta}: debe entrar exactamente una`);

      const usado = await db.twoFactorBackupCode.findFirst({ where: { userId: staff.id }, select: { usedAt: true } });
      if (conRespaldo.status === 'rejected') {
        assert.equal(usado?.usedAt, null, `vuelta ${vuelta}: el respaldo perdió y no puede quedar gastado`);
      } else {
        assert.notEqual(usado?.usedAt, null);
      }
    } finally {
      await borrarUsuarioPrueba(staff.id);
    }
  }
});

test('un respaldo equivocado no gasta el testigo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    const testigo = await primerFactor(staff.email);
    await assert.rejects(AuthService.verifyLogin2FA(staff.id, 'ZZZZ-ZZZZ-ZZZZ', false, 'cms', testigo), conEstado(401));
    // Con el mismo testigo, el código bueno sigue entrando.
    assert.equal((await AuthService.verifyLogin2FA(staff.id, codigo(), false, 'cms', testigo)).status, 'OK');
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

// ---------------------------------------------------------------------------
//  7. Desactivar deja el intervalo a cero
// ---------------------------------------------------------------------------

test('desactivar el 2FA limpia el último intervalo y se puede reactivar al momento', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    await DobleFactorService.disable2FA(staff.id, codigo());
    const tras = await db.user.findUnique({ where: { id: staff.id }, select: { twoFactorLastStep: true, twoFactorEnabled: true } });
    assert.deepEqual(tras, { twoFactorLastStep: null, twoFactorEnabled: false });

    // En el mismo intervalo, con el secreto nuevo: antes daba «ya se ha usado».
    const { secret } = await DobleFactorService.generate2FAQR(staff.id);
    const activado = await DobleFactorService.enable2FA(staff.id, codigo(0, secret));
    assert.equal(activado.backupCodes.length, 8);
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

// ---------------------------------------------------------------------------
//  8. Un testigo caducado no se lleva la cookie de sesión
// ---------------------------------------------------------------------------

test('un testigo gastado o ausente solo borra la cookie del 2FA', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await conSegundoFactor(staff.id);
    const sesionHermanos = `${COOKIE_HERMANO}=${generateToken(staff.id, Role.SECRETARIA, false, 'hermanos')}`;
    // Testigo de otro intervalo: gastado a efectos de la cuenta.
    const gastado = generatePending2FAToken(staff.id, false, 'cms', 12345);

    for (const cookies of [sesionHermanos, `${sesionHermanos}; ${COOKIE_2FA}=${gastado}`]) {
      const res = await fetch(`${baseUrl}/api/auth/login/2fa`, {
        method: 'POST',
        headers: { Cookie: cookies, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token2fa: codigo() })
      });
      assert.equal(res.status, 401);
      assert.equal((await res.json() as { error?: string }).error, 'PENDING_2FA_REQUIRED');
      const puestas = res.headers.getSetCookie();
      assert.ok(!puestas.some((c) => c.startsWith(`${COOKIE_HERMANO}=`)), 'la sesión del área de hermanos sigue siendo buena');
      assert.ok(puestas.some((c) => c.startsWith(`${COOKIE_2FA}=`)));
    }
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

// ---------------------------------------------------------------------------
//  9. El último ADMIN, con bloqueo de filas
// ---------------------------------------------------------------------------

test('la comprobación del último ADMIN bloquea las filas de los ADMIN activos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  const intentarBloquear = () => db.$transaction((tx) =>
    tx.$queryRaw`SELECT id FROM \`User\` WHERE role = 'ADMIN' AND active = TRUE FOR UPDATE NOWAIT`);
  try {
    // Sin nadie reteniéndolas, se pueden bloquear: el test distingue.
    await intentarBloquear();

    const cancelar = new Error('deshacer: el test no borra nada');
    await assert.rejects(db.$transaction(async (tx) => {
      await asegurarQueQuedaOtroAdmin(tx, Role.ADMIN);
      // Otra transacción, como la de un segundo ADMIN borrándose a la vez,
      // no puede hacerse con ellas hasta que esta termine.
      const [otra] = await Promise.allSettled([intentarBloquear()]);
      assert.equal(otra.status, 'rejected', 'las filas deberían estar bloqueadas por la primera transacción');
      throw cancelar;
    }, { timeout: 15_000 }), (e: unknown) => e === cancelar);
  } finally {
    await borrarUsuarioPrueba(admin.id);
  }
});

// ---------------------------------------------------------------------------
//  11 y 12. Recuperación de contraseña
// ---------------------------------------------------------------------------

test('pedir la recuperación responde sin esperar al trabajo, exista o no el correo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  const original = AuthService.prepararRecuperacion;
  const pedidos: string[] = [];
  try {
    // El trabajo de verdad tarda medio segundo: si la respuesta lo esperara, se notaría.
    AuthService.prepararRecuperacion = async (email: string) => {
      pedidos.push(email);
      await new Promise((resolve) => setTimeout(resolve, 500));
    };
    for (const email of [hermano.email, `no-existe-${Date.now()}@ejemplo.test`]) {
      const inicio = performance.now();
      const respuesta = await AuthService.requestPasswordReset(email);
      const duracion = performance.now() - inicio;
      assert.match(respuesta.message, /Si el correo está registrado/);
      assert.ok(duracion < 100, `respondió en ${duracion.toFixed(0)} ms: está esperando al trabajo`);
    }
    assert.equal(pedidos.length, 2, 'el trabajo se lanza en los dos casos');
  } finally {
    AuthService.prepararRecuperacion = original;
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('el trabajo de la recuperación guarda el enlace y manda el correo solo si la cuenta existe', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  const original = EmailService.enviarRecuperacionContrasena;
  const enviados: string[] = [];
  try {
    EmailService.enviarRecuperacionContrasena = (async (email: string) => { enviados.push(email); return true; }) as typeof original;

    await AuthService.prepararRecuperacion(`no-existe-${Date.now()}@ejemplo.test`);
    assert.equal(enviados.length, 0);

    await AuthService.prepararRecuperacion(hermano.email);
    assert.deepEqual(enviados, [hermano.email]);
    const cuenta = await db.user.findUnique({ where: { id: hermano.id }, select: { resetPasswordToken: true, resetPasswordExpires: true } });
    assert.ok(cuenta?.resetPasswordToken, 'debe quedar guardado el hash del enlace');
    assert.ok(cuenta!.resetPasswordExpires! > new Date());
  } finally {
    EmailService.enviarRecuperacionContrasena = original;
    await borrarUsuarioPrueba(hermano.id);
  }
});

// Quien la pide desde la entrada del CMS vuelve a la del CMS al terminar: el
// enlace lo dice. La de hermanos no es la suya y puede estar apagada.
test('la recuperación pedida desde el CMS manda el enlace del CMS', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const cargo = await crearUsuarioPrueba(Role.SECRETARIA);
  const original = EmailService.enviarRecuperacionContrasena;
  const areas: (string | undefined)[] = [];
  try {
    EmailService.enviarRecuperacionContrasena = (async (_e: string, _n: string, _t: string, opciones?: { area?: string }) => {
      areas.push(opciones?.area); return true;
    }) as typeof original;

    await AuthService.prepararRecuperacion(cargo.email, 'cms');
    await AuthService.prepararRecuperacion(cargo.email);
    assert.deepEqual(areas, ['cms', 'hermanos']);
  } finally {
    EmailService.enviarRecuperacionContrasena = original;
    await borrarUsuarioPrueba(cargo.id);
  }
});

test('el mismo enlace de recuperación usado dos veces a la vez solo vale una', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const enlace = await AuthService.crearEnlaceDeContrasena(hermano.id, 1);
    const claves = ['Primera-Clave-Segura-26', 'Segunda-Clave-Segura-26'];
    const resultados = await Promise.allSettled(claves.map((clave) => AuthService.resetPassword(enlace, clave)));

    assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
    const perdedor = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.ok(perdedor.reason instanceof HttpError && perdedor.reason.status === 400);

    // La contraseña que queda es la de quien ganó, no la de quien llegó el último.
    const ganadora = claves[resultados.findIndex((r) => r.status === 'fulfilled')];
    const entrada = await AuthService.loginUser({ email: hermano.email, password: ganadora, contexto: 'hermanos' }, ipUnica());
    assert.equal(entrada.status, 'OK');
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('un enlace de recuperación caducado no cambia la contraseña', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const enlace = await AuthService.crearEnlaceDeContrasena(hermano.id, 1);
    await db.user.update({ where: { id: hermano.id }, data: { resetPasswordExpires: new Date(Date.now() - 1000) } });
    await assert.rejects(AuthService.resetPassword(enlace, 'Otra-Clave-Segura-2026'), conEstado(400));
    const entrada = await AuthService.loginUser({ email: hermano.email, password: PASSWORD_PRUEBA, contexto: 'hermanos' }, ipUnica());
    assert.equal(entrada.status, 'OK', 'la contraseña de antes sigue valiendo');
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

// ---------------------------------------------------------------------------
//  13 y 14. Suprimir la cuenta: fichas según su estado y auditoría sin datos
// ---------------------------------------------------------------------------

test('suprimir la cuenta trata cada ficha según su estado y suprime los datos de su auditoría', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const cuenta = await crearUsuarioPrueba(Role.USER);
  const ajena = await crearUsuarioPrueba(Role.USER);
  const fichas: number[] = [];
  const recibos: number[] = [];
  const registros: number[] = [];
  const bajaAntigua = new Date(Date.UTC(2020, 0, 15));
  const numero = 2_000_000_000 + (Date.now() % 100_000_000);

  const ficha = async (userId: number, datos: Record<string, unknown>) => {
    const creada = await db.hermano.create({
      data: {
        userId, nombre: 'Prueba', apellidos: 'Supresión', fechaNacimiento: new Date(Date.UTC(1990, 0, 1)),
        email: 'contacto@ejemplo.test', telefono: '600000000', direccion: 'Calle Falsa 1', ...datos
      }
    });
    fichas.push(creada.id);
    return creada.id;
  };

  try {
    const activa = await ficha(cuenta.id, { activo: true, numeroHermano: numero });
    const pendiente = await ficha(cuenta.id, { activo: false });
    const pendienteConHistorial = await ficha(cuenta.id, { activo: false });
    const deBaja = await ficha(cuenta.id, { activo: false, fechaBaja: bajaAntigua });
    const deOtro = await ficha(ajena.id, { activo: true });
    const recibo = await db.recibo.create({ data: { hermanoId: pendienteConHistorial, year: 2026, concepto: 'Prueba supresión', importe: 10 } });
    recibos.push(recibo.id);

    // Lo que dejan las actualizaciones de ficha y la emancipación.
    const cambio = { antes: { email: 'viejo@ejemplo.test', direccion: 'Calle Vieja 1', activo: true }, despues: { email: 'nuevo@ejemplo.test', direccion: 'Calle Nueva 2', activo: true } };
    for (const [entityType, entityId] of [['hermano', activa], ['hermano', pendiente], ['user', cuenta.id], ['hermano', deOtro]] as const) {
      const r = await db.auditLog.create({ data: { action: 'HERMANO_ACTUALIZAR', entityType, entityId: String(entityId), detalles: cambio } });
      registros.push(r.id);
    }
    const antesDeSuprimir = await db.auditLog.findMany({ where: { id: { in: registros } }, select: { id: true, createdAt: true } });

    await MisDatosService.deleteOwnAccount(cuenta.id, PASSWORD_PRUEBA, 'hermanos');

    // 13. Cada ficha según su estado.
    const leer = (id: number) => db.hermano.findUnique({
      where: { id }, select: { activo: true, fechaBaja: true, numeroHermano: true, email: true, telefono: true, direccion: true }
    });
    const hoy = new Date().toISOString().slice(0, 10);

    const trasActiva = await leer(activa);
    assert.equal(trasActiva?.activo, false);
    assert.equal(trasActiva?.fechaBaja?.toISOString().slice(0, 10), hoy);
    assert.equal(trasActiva?.numeroHermano, null, 'una ficha de baja no retiene su número');
    assert.equal(trasActiva?.email, null);

    assert.equal(await leer(pendiente), null, 'la solicitud pendiente sin historial se retira');

    const trasConHistorial = await leer(pendienteConHistorial);
    assert.equal(trasConHistorial?.fechaBaja?.toISOString().slice(0, 10), hoy, 'con historial no se borra: pasa a baja');

    const trasBaja = await leer(deBaja);
    assert.equal(trasBaja?.fechaBaja?.toISOString(), bajaAntigua.toISOString(), 'la fecha de baja real no se pisa');
    assert.equal(trasBaja?.direccion, null, 'el contacto sí se limpia');

    assert.equal((await leer(deOtro))?.email, 'contacto@ejemplo.test', 'las fichas de otra cuenta no se tocan');

    // 14. Auditoría: valores personales fuera, estructura y fechas dentro.
    const despues = await db.auditLog.findMany({ where: { id: { in: registros } }, select: { id: true, entityType: true, entityId: true, detalles: true, createdAt: true } });
    for (const r of despues) {
      const detalles = r.detalles as { antes: Record<string, unknown>; despues: Record<string, unknown> };
      const creado = antesDeSuprimir.find((a) => a.id === r.id)!.createdAt;
      assert.equal(r.createdAt.getTime(), creado.getTime(), 'la fecha del registro se conserva');
      if (r.entityId === String(deOtro)) {
        assert.equal(detalles.antes.email, 'viejo@ejemplo.test', 'los registros de otra cuenta no se tocan');
        continue;
      }
      assert.deepEqual(Object.keys(detalles.antes).sort(), ['activo', 'direccion', 'email'], 'se sigue sabiendo qué campos cambiaron');
      assert.equal(detalles.antes.email, VALOR_SUPRIMIDO, `${r.entityType} ${r.entityId}`);
      assert.equal(detalles.despues.direccion, VALOR_SUPRIMIDO);
      assert.equal(detalles.antes.activo, true, 'lo que no es de la persona se conserva');
    }
  } finally {
    await db.auditLog.deleteMany({ where: { OR: [{ id: { in: registros } }, { action: 'CUENTA_AUTODELETE', entityId: String(cuenta.id) }] } });
    await db.recibo.deleteMany({ where: { id: { in: recibos } } });
    await db.hermano.deleteMany({ where: { id: { in: fichas } } });
    await borrarUsuarioPrueba(cuenta.id);
    await borrarUsuarioPrueba(ajena.id);
  }
});

