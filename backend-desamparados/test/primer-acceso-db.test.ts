// El primer acceso del censo importado contra MariaDB: la invitación sale por
// correo y queda apuntada; su enlace saluda sin gastarse, pone la contraseña y
// abre la sesión de una vez, y no vale dos veces; confirmar exige los
// obligatorios de cada ficha y el parentesco de las fichas a cargo, y quita la
// marca para siempre; Secretaría ve en qué está cada invitación (vale,
// caducó, la pisó una recuperación o ya se estrenó), y un correo que no sale
// no pisa el enlace que ya llegó; «no es de mi familia» devuelve la ficha a la custodia con un aviso para Secretaría. Y
// las rutas: el listado y las invitaciones son de quien lleva el censo.

import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Prisma, Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken, verifyToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { ponerTransporte } from '../src/services/correos/envio.js';
import { PrimerAccesoService } from '../src/services/primer-acceso.service.js';
import { AuthService } from '../src/services/auth.service.js';
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
    // La sesión nace después del corte que acaba de poner la contraseña, no en
    // el mismo milisegundo: con una base rápida, si no, nacía ya cortada.
    const emitida = verifyToken(decodeURIComponent(cookie.split(';')[0].split('=')[1]), 'session');
    const { tokenValidAfter } = await db.user.findUniqueOrThrow({ where: { id: e.cuenta.id }, select: { tokenValidAfter: true } });
    assert.ok(emitida?.emitidoMs !== undefined && emitida.emitidoMs >= tokenValidAfter.getTime(), 'emitida después del corte');

    // Ya gastado: ni saluda ni vuelve a abrir nada.
    assert.equal((await pedir('/api/auth/primer-acceso/datos', { metodo: 'POST', cuerpo: { token } })).status, 400);
    assert.equal((await pedir('/api/auth/primer-acceso', { metodo: 'POST', cuerpo: { token, newPassword: CONTRASENA } })).status, 400);
  } finally {
    await e.recoger();
  }
});

test('AC7: la sesión del estreno nace después del corte aunque el reloj no haya avanzado (reloj parado)', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const { token, datos } = AuthService.enlaceSinGuardar(1, { invitacion: true });
    await db.user.update({ where: { id: e.cuenta.id }, data: datos });
    // Con el reloj de verdad, la sesión salía en el mismo milisegundo que el
    // corte solo a veces (una base rápida). Parado, sale siempre: `Date.now`
    // no avanza hasta que vence un temporizador, y entonces avanza lo que
    // ese temporizador esperaba. Sin la espera de `estrenar`, falla siempre.
    let ahora = Date.now();
    const temporizador = globalThis.setTimeout;
    const reloj = mock.method(Date, 'now', () => ahora);
    const esperas = mock.method(globalThis, 'setTimeout', ((fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) =>
      temporizador(() => { ahora += Math.max(1, Number(ms) || 0); fn(...args); }, ms)) as typeof setTimeout);
    let sesion: string;
    try {
      sesion = (await PrimerAccesoService.estrenar(token, CONTRASENA, false)).token;
    } finally {
      esperas.mock.restore();
      reloj.mock.restore();
    }
    const emitida = verifyToken(sesion, 'session');
    const { tokenValidAfter } = await db.user.findUniqueOrThrow({ where: { id: e.cuenta.id }, select: { tokenValidAfter: true } });
    assert.ok(emitida?.emitidoMs !== undefined, 'la sesión lleva su milisegundo');
    assert.ok(emitida.emitidoMs >= tokenValidAfter.getTime(), `emitida (${emitida.emitidoMs}) después del corte (${tokenValidAfter.getTime()})`);
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

type Invitacion = { estado: string; caducaEn: string | null } | null;

/** Lo que ve Secretaría de esa cuenta: su invitación y en qué filtro sale. */
async function vistaDeSecretaria(e: Awaited<ReturnType<typeof escenario>>) {
  const listar = async (estado?: string) => {
    const res = await pedir(`/api/hermanos/admin/primer-acceso?${estado ? `estado=${estado}&` : ''}q=${encodeURIComponent(e.cuenta.email)}`, { cookie: e.sesionStaff });
    assert.equal(res.status, 200);
    return (await res.json() as { data: { id: number; invitacion: Invitacion }[] }).data;
  };
  const [todas, sinInvitar, invitados] = await Promise.all([listar(), listar('sin-invitar'), listar('invitado')]);
  assert.deepEqual(todas.map((c) => c.id), [e.cuenta.id]);
  return {
    invitacion: todas[0]!.invitacion,
    filtro: sinInvitar.length ? 'sin-invitar' : invitados.length ? 'invitado' : 'ninguno',
  };
}

/** Invita (o reenvía) por la ruta del CMS y devuelve el token del correo. */
async function invitarYEsperar(e: Awaited<ReturnType<typeof escenario>>) {
  const inv = await pedir('/api/hermanos/admin/primer-acceso/invitar', { metodo: 'POST', cookie: e.sesionStaff, cuerpo: { ids: [e.cuenta.id] } });
  assert.equal(inv.status, 202);
  await PrimerAccesoService.esperarCola();
  const correo = enviados.filter((c) => c.to === e.cuenta.email).at(-1);
  const token = /\/primer-acceso\?token=([a-f0-9]{64})/.exec(String(correo?.html))?.[1];
  assert.ok(token, 'el correo lleva el enlace del primer acceso');
  return token;
}

const CATORCE_DIAS = 14 * 24 * 3600_000;

test('Secretaría ve si el enlace de la invitación vale, caducó o lo sustituyó una recuperación', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    assert.deepEqual(await vistaDeSecretaria(e), { invitacion: { estado: 'sin-invitar', caducaEn: null }, filtro: 'sin-invitar' });

    // Invitada: vale catorce días desde que se crea su enlace.
    const antes = Date.now();
    await invitarYEsperar(e);
    let vista = await vistaDeSecretaria(e);
    assert.equal(vista.invitacion?.estado, 'vigente');
    assert.equal(vista.filtro, 'invitado');
    const caduca = Date.parse(vista.invitacion!.caducaEn!);
    assert.ok(caduca >= antes + CATORCE_DIAS - 1000 && caduca <= Date.now() + CATORCE_DIAS, 'caduca a los catorce días');
    const { invitadoEn } = await db.user.findUniqueOrThrow({ where: { id: e.cuenta.id } });

    // Pide una recuperación: su enlace pisa el de la invitación. El CMS no
    // enseña la hora de la recuperación ni toca cuándo se le invitó.
    await AuthService.prepararRecuperacion(e.cuenta.email);
    vista = await vistaDeSecretaria(e);
    assert.deepEqual(vista, { invitacion: { estado: 'sustituida', caducaEn: null }, filtro: 'invitado' });
    assert.deepEqual((await db.user.findUniqueOrThrow({ where: { id: e.cuenta.id } })).invitadoEn, invitadoEn);

    // Reenviar la deja viva otra vez.
    await invitarYEsperar(e);
    assert.equal((await vistaDeSecretaria(e)).invitacion?.estado, 'vigente');

    // Pasado el plazo sin usarla: caducada, con su fecha, y sigue entre los invitados.
    const vencida = new Date(Date.now() - 24 * 3600_000);
    await db.user.update({ where: { id: e.cuenta.id }, data: { invitacionCaducaEn: vencida, resetPasswordExpires: vencida } });
    assert.deepEqual(await vistaDeSecretaria(e), { invitacion: { estado: 'caducada', caducaEn: vencida.toISOString() }, filtro: 'invitado' });

    // Y reenviar una caducada, también.
    await invitarYEsperar(e);
    assert.equal((await vistaDeSecretaria(e)).invitacion?.estado, 'vigente');
  } finally {
    await e.recoger();
  }
});

// El enlace nuevo se guardaba antes de mandar el correo: un reenvío que no
// salía dejaba sin valor el enlace anterior, que sí había llegado, y el CMS
// decía «vale hasta…» de un correo que nadie recibió.
test('un reenvío que no sale deja la invitación anterior como estaba, y su enlace sigue valiendo', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  const campos = { resetPasswordToken: true, resetPasswordExpires: true, invitacionCaducaEn: true, invitadoEn: true } as const;
  const falla = () => ponerTransporte({ sendMail: async () => { throw new Error('cupo agotado'); } });
  const funciona = () => ponerTransporte({ sendMail: async (correo) => { enviados.push(correo); } });
  try {
    // La primera, si no sale, no deja ni token ni invitación.
    falla();
    await pedir('/api/hermanos/admin/primer-acceso/invitar', { metodo: 'POST', cookie: e.sesionStaff, cuerpo: { ids: [e.cuenta.id] } });
    await PrimerAccesoService.esperarCola();
    assert.deepEqual(await db.user.findUniqueOrThrow({ where: { id: e.cuenta.id }, select: campos }),
      { resetPasswordToken: null, resetPasswordExpires: null, invitacionCaducaEn: null, invitadoEn: null });
    assert.deepEqual(await vistaDeSecretaria(e), { invitacion: { estado: 'sin-invitar', caducaEn: null }, filtro: 'sin-invitar' });

    funciona();
    const token = await invitarYEsperar(e);
    const antes = await db.user.findUniqueOrThrow({ where: { id: e.cuenta.id }, select: campos });
    const vistaAntes = await vistaDeSecretaria(e);
    assert.equal(vistaAntes.invitacion?.estado, 'vigente');

    falla();
    const reenvio = await pedir('/api/hermanos/admin/primer-acceso/invitar', { metodo: 'POST', cookie: e.sesionStaff, cuerpo: { ids: [e.cuenta.id] } });
    assert.equal(reenvio.status, 202);
    await PrimerAccesoService.esperarCola();
    assert.deepEqual(await db.user.findUniqueOrThrow({ where: { id: e.cuenta.id }, select: campos }), antes);
    assert.deepEqual(await vistaDeSecretaria(e), vistaAntes);
    assert.equal((await pedir('/api/auth/primer-acceso/datos', { metodo: 'POST', cuerpo: { token } })).status, 200, 'el enlace que llegó sigue valiendo');

    // Y uno que sale deja la nueva, vigente con su fecha, y el enlace de antes ya no vale.
    funciona();
    const nuevo = await invitarYEsperar(e);
    assert.notEqual(nuevo, token);
    const vista = await vistaDeSecretaria(e);
    assert.equal(vista.invitacion?.estado, 'vigente');
    assert.ok(Date.parse(vista.invitacion!.caducaEn!) >= Date.parse(vistaAntes.invitacion!.caducaEn!));
    assert.equal((await pedir('/api/auth/primer-acceso/datos', { metodo: 'POST', cuerpo: { token } })).status, 400);
    assert.equal((await pedir('/api/auth/primer-acceso/datos', { metodo: 'POST', cuerpo: { token: nuevo } })).status, 200);
  } finally {
    funciona();
    await e.recoger();
  }
});

test('una recuperación cuyo correo no sale tampoco pisa la invitación', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const token = await invitarYEsperar(e);
    const vista = await vistaDeSecretaria(e);
    ponerTransporte({ sendMail: async () => { throw new Error('cupo agotado'); } });
    await AuthService.prepararRecuperacion(e.cuenta.email);
    assert.deepEqual(await vistaDeSecretaria(e), vista);
    assert.equal((await pedir('/api/auth/primer-acceso/datos', { metodo: 'POST', cuerpo: { token } })).status, 200);
  } finally {
    ponerTransporte({ sendMail: async (correo) => { enviados.push(correo); } });
    await e.recoger();
  }
});

test('quien estrenó la invitación sale como que ya entró, aunque después pida una recuperación', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const token = await invitarYEsperar(e);
    const estreno = await pedir('/api/auth/primer-acceso', { metodo: 'POST', cuerpo: { token, newPassword: CONTRASENA } });
    assert.equal(estreno.status, 200);
    // Estrenar corta las sesiones de antes: confirma con la que abre.
    const sesion = estreno.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_HERMANO}=`))!.split(';')[0];
    assert.deepEqual(await vistaDeSecretaria(e), { invitacion: { estado: 'estrenada', caducaEn: null }, filtro: 'invitado' });

    // Una recuperación que no usa vuelve a dejar un token, pero no una invitación.
    await AuthService.prepararRecuperacion(e.cuenta.email);
    assert.deepEqual(await vistaDeSecretaria(e), { invitacion: { estado: 'estrenada', caducaEn: null }, filtro: 'invitado' });

    // Confirmada, ya no hay invitación de la que hablar.
    await db.hermano.update({ where: { id: e.hija.id }, data: { parentesco: 'HIJO' } });
    assert.equal((await pedir('/api/hermanos/primer-acceso/confirmar', { metodo: 'POST', cookie: sesion })).status, 200);
    const res = await pedir(`/api/hermanos/admin/primer-acceso?estado=confirmado&q=${encodeURIComponent(e.cuenta.email)}`, { cookie: e.sesionStaff });
    assert.deepEqual((await res.json() as { data: { invitacion: Invitacion }[] }).data.map((c) => c.invitacion), [null]);
  } finally {
    await e.recoger();
  }
});

test('quien entra con una recuperación sin haber sido invitado deja de contar como «sin invitar»', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    // El censo trae su correo: puede entrar por «¿Has olvidado tu contraseña?»
    // antes de que Secretaría le invite, y «Invitar a los que faltan» no debe
    // mandarle una invitación que ya no necesita.
    const token = await AuthService.crearEnlaceDeContrasena(e.cuenta.id, 1);
    assert.deepEqual(await vistaDeSecretaria(e), { invitacion: { estado: 'sin-invitar', caducaEn: null }, filtro: 'sin-invitar' });
    await AuthService.resetPassword(token, CONTRASENA);
    assert.deepEqual(await vistaDeSecretaria(e), { invitacion: { estado: 'estrenada', caducaEn: null }, filtro: 'invitado' });
  } finally {
    await e.recoger();
  }
});

test('cambiar la contraseña con la sesión abierta también gasta el enlace de la invitación', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const token = await invitarYEsperar(e);
    await AuthService.resetPassword(token, CONTRASENA);
    await invitarYEsperar(e);
    assert.equal((await vistaDeSecretaria(e)).invitacion?.estado, 'vigente');
    await AuthService.cambiarContrasena(e.cuenta.id, CONTRASENA, `${CONTRASENA}-2`, []);
    assert.deepEqual((await vistaDeSecretaria(e)).invitacion, { estado: 'estrenada', caducaEn: null });
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
    // El aviso apunta a la ficha, y el Inicio del CMS lo devuelve con ella para enlazarla.
    assert.equal(aviso.hermanoId, e.hija.id);
    const panel = await (await pedir('/api/panel', { cookie: e.sesionStaff })).json() as { avisos: { id: number; hermanoId: number | null }[] };
    assert.equal(panel.avisos.find((a) => a.id === aviso.id)?.hermanoId, e.hija.id);
    // Lleva nombres de una familia: Redes, que no ve el censo, no lo recibe.
    const redes = await crearUsuarioPrueba(Role.REDES);
    try {
      const suyo = await (await pedir('/api/panel', { cookie: `${COOKIE_CMS}=${generateToken(redes.id, Role.REDES, false, 'cms')}` })).json() as { avisos: { id: number }[] };
      assert.ok(Array.isArray(suyo.avisos), 'el panel de Redes responde con sus avisos');
      assert.equal(suyo.avisos.some((a) => a.id === aviso.id), false);
    } finally {
      await borrarUsuarioPrueba(redes.id);
    }

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
