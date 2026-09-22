// El plazo de la solicitud de papeletas y la ficha completa del área de
// hermanos (septiembre de 2026).
//
// Con el plazo cerrado no se reserva día de reparto, lo intente la pantalla o
// alguien a mano. Abrirlo exige días de reparto por delante y, si se pide,
// deja un borrador de noticia. La ficha se edita entera desde el área: los
// apellidos por separado, la cuenta bancaria (que nunca vuelve entera) y el
// parentesco solo en las fichas a cargo.

import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { EmailService } from '../src/services/email.service.js';
import { MiProcesionService } from '../src/services/procesion/mi-procesion.service.js';
import { CLAVE_PLAZO, PlazoPapeletasService } from '../src/services/procesion/plazo.service.js';
import { apellidosTrasCambio, componerApellidos, partirApellidos } from '../src/domain/apellidos.js';
import { enmascararIban } from '../src/domain/iban.js';
import { esIbanValido, normalizarIban } from '../src/config/common.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;
let server: Server;
let baseUrl: string;
let plazoPrevio: string | null = null;

const avisosDeApertura = mock.method(EmailService, 'enviarAperturaPapeletas', async () => undefined);

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (dbDisponible) plazoPrevio = (await db.configuracion.findUnique({ where: { key: CLAVE_PLAZO } }))?.value ?? null;
});

after(async () => {
  mock.restoreAll();
  if (dbDisponible) {
    if (plazoPrevio === null) await db.configuracion.deleteMany({ where: { key: CLAVE_PLAZO } });
    else await db.configuracion.update({ where: { key: CLAVE_PLAZO }, data: { value: plazoPrevio } });
  }
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

const fijarPlazo = (abierto: boolean) => db.configuracion.upsert({
  where: { key: CLAVE_PLAZO }, update: { value: String(abierto) }, create: { key: CLAVE_PLAZO, value: String(abierto) },
});

/** Un titular con un sobrino a cargo, y los turnos y noticias que se creen. Todo se borra al terminar. */
async function escenario() {
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  const usuario = await crearUsuarioPrueba(Role.USER);
  const turnos: number[] = [];
  const noticias: number[] = [];
  const marca = Date.now().toString(36);
  const titular = await db.hermano.create({
    data: { userId: usuario.id, nombre: 'Antonio', apellidos: `Plazo${marca} Salas`, primerApellido: `Plazo${marca}`, segundoApellido: 'Salas', fechaNacimiento: new Date(Date.UTC(1978, 10, 2)), activo: true, esTitular: true },
  });
  const sobrino = await db.hermano.create({
    data: { userId: usuario.id, nombre: 'Pablo', apellidos: `Ruiz Plazo${marca}`, fechaNacimiento: new Date(Date.UTC(2014, 5, 1)), activo: true, esTitular: false, parentesco: 'SOBRINO' },
  });
  const turno = async (dentroDeHoras: number) => {
    const fecha = new Date(Date.now() + dentroDeHoras * 60 * 60 * 1000);
    const t = await db.turno.create({ data: { fecha, horaInicio: fecha, horaFin: new Date(fecha.getTime() + 3 * 60 * 60 * 1000), capacidadEstimada: 50 } });
    turnos.push(t.id);
    return t;
  };
  const recoger = async () => {
    await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: [admin.id, usuario.id] } }, { entityType: 'hermano', entityId: { in: [String(titular.id), String(sobrino.id)] } }] } });
    await db.cita.deleteMany({ where: { OR: [{ hermanoId: { in: [titular.id, sobrino.id] } }, { turnoId: { in: turnos } }] } });
    await db.turno.deleteMany({ where: { id: { in: turnos } } });
    await db.noticia.deleteMany({ where: { id: { in: noticias } } });
    await db.hermano.deleteMany({ where: { id: { in: [titular.id, sobrino.id] } } });
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(admin.id);
  };
  return { admin, usuario, titular, sobrino, turno, noticias, recoger };
}

const comoHermano = (usuarioId: number, ruta: string, init: RequestInit & { json?: unknown } = {}) => {
  const { json, ...resto } = init;
  return fetch(`${baseUrl}${ruta}`, {
    ...resto,
    headers: { Cookie: `${COOKIE_HERMANO}=${generateToken(usuarioId, Role.USER, false, 'hermanos')}`, ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
};

// ---------------------------------------------------------------- dominio

test('los apellidos se componen desde los dos sueltos, y los juntos se parten solo con dos palabras', () => {
  assert.deepEqual(componerApellidos(' Benítez ', 'Salas'), { apellidos: 'Benítez Salas', primerApellido: 'Benítez', segundoApellido: 'Salas' });
  assert.deepEqual(componerApellidos('Benítez', ''), { apellidos: 'Benítez', primerApellido: 'Benítez', segundoApellido: null });
  assert.deepEqual(partirApellidos('Benítez Salas'), { apellidos: 'Benítez Salas', primerApellido: 'Benítez', segundoApellido: 'Salas' });
  assert.deepEqual(partirApellidos('de la Vega Ruiz'), { apellidos: 'de la Vega Ruiz', primerApellido: 'de la Vega Ruiz', segundoApellido: null });
  // Cambiar solo el segundo conserva el primero de la ficha.
  assert.equal(apellidosTrasCambio({ segundoApellido: 'Molina' }, { primerApellido: 'Benítez', segundoApellido: 'Salas' })?.apellidos, 'Benítez Molina');
  // Los mismos juntos de siempre no tocan nada.
  assert.equal(apellidosTrasCambio({ apellidos: 'de la Vega Ruiz' }, { apellidos: 'de la Vega Ruiz', primerApellido: 'de la Vega', segundoApellido: 'Ruiz' }), null);
});

test('el IBAN se valida con su dígito de control y nunca se enseña entero', () => {
  assert.equal(normalizarIban('es91 2100 0418 4502 0005 1332'), 'ES9121000418450200051332');
  assert.equal(esIbanValido('ES9121000418450200051332'), true);
  assert.equal(esIbanValido('ES9121000418450200051333'), false, 'un dígito cambiado');
  assert.equal(esIbanValido('ES91210004184502000513'), false, 'a un IBAN español le faltan cifras');
  assert.equal(enmascararIban('ES9121000418450200051332'), 'ES•• •••• •••• •••• •••• 1332');
  assert.equal(enmascararIban(null), null);
});

// ---------------------------------------------------------------- plazo

test('con el plazo cerrado no se reserva día; abierto, sí', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const turno = await e.turno(26);
    await fijarPlazo(false);
    await assert.rejects(
      MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: turno.id, hermanoId: e.titular.id }),
      /no está abierta/,
    );
    // Por HTTP, igual: no basta con esconder el botón.
    const res = await comoHermano(e.usuario.id, '/api/procesion/avisar', { method: 'POST', json: { turnoId: turno.id, hermanoId: e.titular.id } });
    assert.equal(res.status, 409);

    await fijarPlazo(true);
    const cita = await MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: turno.id, hermanoId: e.sobrino.id });
    assert.equal(cita.estado, 'RESERVADA');

    const estado = await MiProcesionService.getMiEstado(e.usuario.id);
    assert.equal(estado.abierto, true);
    assert.ok(estado.dias.some((d) => d.id === turno.id));
    const deSobrino = estado.fichas.find((f) => f.id === e.sobrino.id);
    assert.equal(deSobrino?.cita?.turno.id, turno.id);
    assert.equal(deSobrino?.parentesco, 'SOBRINO');
    assert.equal(estado.fichas.find((f) => f.id === e.titular.id)?.cita, null);
  } finally {
    await e.recoger();
  }
});

test('abrir exige días de reparto; al abrir se avisa y queda un borrador de noticia', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    await fijarPlazo(false);
    const hayDias = (await PlazoPapeletasService.diasFuturos()).length > 0;
    if (!hayDias) {
      await assert.rejects(PlazoPapeletasService.cambiar(true, {}, { userId: e.admin.id }), /No hay días de reparto/);
    }

    await e.turno(30);
    avisosDeApertura.mock.resetCalls();
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.ADMIN)}`, 'Content-Type': 'application/json' };
    const res = await fetch(`${baseUrl}/api/procesion/admin/plazo`, { method: 'POST', headers: cabeceras, body: JSON.stringify({ abierto: true, avisar: true, borradorNoticia: true }) });
    assert.equal(res.status, 200);
    const cuerpo = await res.json() as { abierto: boolean; avisados: number; noticiaId: number | null };
    assert.equal(cuerpo.abierto, true);
    assert.ok(cuerpo.avisados >= 1, 'la cuenta de prueba tiene fichas activas');
    assert.ok(cuerpo.noticiaId);
    e.noticias.push(cuerpo.noticiaId!);

    const noticia = await db.noticia.findUnique({ where: { id: cuerpo.noticiaId! } });
    assert.equal(noticia?.visible, false, 'es un borrador');
    assert.match(noticia?.contenido ?? '', /<ul>/);
    assert.equal(await PlazoPapeletasService.estaAbierto(), true);

    // Los correos salen después de responder.
    await new Promise((r) => setTimeout(r, 50));
    const nuestro = avisosDeApertura.mock.calls.find((c) => c.arguments[0] === e.usuario.email);
    assert.ok(nuestro, 'se avisa a la cuenta de prueba');
    assert.deepEqual((nuestro!.arguments[2] as string[]).length, 2, 'nombra sus dos fichas');

    // Un hermano no puede tocar el plazo.
    const deHermano = await fetch(`${baseUrl}/api/procesion/admin/plazo`, {
      method: 'POST',
      headers: { Cookie: `${COOKIE_CMS}=${generateToken(e.usuario.id, Role.USER)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ abierto: false }),
    });
    assert.equal(deHermano.status, 403);
  } finally {
    await e.recoger();
  }
});

// ---------------------------------------------------------------- ficha

test('el hermano edita su ficha entera, y la de su sobrino con su parentesco', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const res = await comoHermano(e.usuario.id, `/api/hermanos/mis-perfiles/${e.titular.id}`, {
      method: 'PUT',
      json: {
        segundoApellido: 'Molina', sexo: 'HOMBRE', estadoCivil: 'CASADO', profesion: 'Profesor',
        telefonoFijo: '952123456', email2: 'otro@ejemplo.invalido', provincia: 'Málaga', pais: 'España',
        fechaBautismo: '1978-12-08', parroquiaBautismo: 'Santo Domingo',
        formaPagoPref: 'DOMICILIACION', iban: 'ES91 2100 0418 4502 0005 1332', titularCuenta: 'Antonio',
        parentesco: 'HIJO',
      },
    });
    assert.equal(res.status, 200);
    const { data: devuelta } = await res.json() as { data: Record<string, unknown> };
    assert.ok(!('iban' in devuelta), 'la cuenta no vuelve entera');
    assert.equal(devuelta.ibanEnmascarado, 'ES•• •••• •••• •••• •••• 1332');

    const guardada = await db.hermano.findUniqueOrThrow({ where: { id: e.titular.id } });
    assert.equal(guardada.apellidos, `${e.titular.primerApellido} Molina`);
    assert.equal(guardada.iban, 'ES9121000418450200051332');
    assert.equal(guardada.parentesco, null, 'la ficha del titular no es de nadie');
    assert.equal(guardada.estadoCivil, 'CASADO');

    // Un IBAN mal copiado es un 400, y domiciliar sin cuenta también.
    const malo = await comoHermano(e.usuario.id, `/api/hermanos/mis-perfiles/${e.titular.id}`, { method: 'PUT', json: { iban: 'ES9121000418450200051333' } });
    assert.equal(malo.status, 400);
    const sinCuenta = await comoHermano(e.usuario.id, `/api/hermanos/mis-perfiles/${e.titular.id}`, { method: 'PUT', json: { iban: null } });
    assert.equal(sinCuenta.status, 400);

    // La jura la lleva Secretaría: el hermano la manda y no cambia nada.
    await comoHermano(e.usuario.id, `/api/hermanos/mis-perfiles/${e.titular.id}`, { method: 'PUT', json: { fechaJura: '2010-03-19', profesion: 'Maestro' } });
    const trasJura = await db.hermano.findUniqueOrThrow({ where: { id: e.titular.id } });
    assert.equal(trasJura.fechaJura, null);
    assert.equal(trasJura.profesion, 'Maestro');

    // El sobrino: su parentesco sí se corrige.
    const sobrino = await comoHermano(e.usuario.id, `/api/hermanos/mis-perfiles/${e.sobrino.id}`, { method: 'PUT', json: { parentesco: 'AHIJADO', primerApellido: 'Ruiz', segundoApellido: 'Benítez' } });
    assert.equal(sobrino.status, 200);
    const guardadoSobrino = await db.hermano.findUniqueOrThrow({ where: { id: e.sobrino.id } });
    assert.equal(guardadoSobrino.parentesco, 'AHIJADO');
    assert.equal(guardadoSobrino.apellidos, 'Ruiz Benítez');

    // Y el listado de sus fichas tampoco trae la cuenta entera.
    const lista = await comoHermano(e.usuario.id, '/api/hermanos/mis-perfiles');
    const { data } = await lista.json() as { data: Record<string, unknown>[] };
    for (const ficha of data) assert.ok(!('iban' in ficha));
    assert.equal(data.find((f) => f.id === e.titular.id)?.ibanEnmascarado, 'ES•• •••• •••• •••• •••• 1332');
  } finally {
    await e.recoger();
  }
});
