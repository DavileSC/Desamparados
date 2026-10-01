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
import { EstadoPago, Role, type Salida } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { EmailService } from '../src/services/email.service.js';
import { MiProcesionService } from '../src/services/procesion/mi-procesion.service.js';
import { PlazoPapeletasService } from '../src/services/procesion/plazo.service.js';
import { TurnosService } from '../src/services/procesion/turnos.service.js';
import { SalidasService } from '../src/services/procesion/salidas.service.js';
import { MisRecibosService } from '../src/services/mis-recibos.service.js';
import { apellidosTrasCambio, componerApellidos, partirApellidos } from '../src/domain/apellidos.js';
import { enmascararIban } from '../src/domain/iban.js';
import { esIbanValido, normalizarIban } from '../src/config/common.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { idDeSalida, PASION, ROSARIO, salida } from './fixtures/salidas.js';
import { diaMadrid, sumarDias } from '../src/domain/fecha-salida.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;
let server: Server;
let baseUrl: string;
// Las dos filas tal como estaban: las pruebas abren plazos, cambian la cuota y
// ponen fecha al Rosario, y todo se devuelve al terminar.
let previas: Salida[] = [];

const avisosDeApertura = mock.method(EmailService, 'enviarAperturaPapeletas', async () => undefined);

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (dbDisponible) {
    previas = await db.salida.findMany({ where: { slug: { in: [PASION, ROSARIO] } } });
    // Las pruebas cuentan con la cuota de salida de hoy, 0 €: la de la base
    // puede ser otra (se cambia en el CMS).
    await db.salida.update({ where: { slug: PASION }, data: { importeCuota: 0 } });
  }
});

after(async () => {
  mock.restoreAll();
  if (dbDisponible) {
    for (const { id, plazoAbierto, plazoCambiadoEl, importeCuota, eventoId } of previas) {
      await db.salida.update({ where: { id }, data: { plazoAbierto, plazoCambiadoEl, importeCuota, eventoId } });
    }
  }
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

const fijarPlazo = (abierto: boolean, slug: string = PASION) => db.salida.update({ where: { slug }, data: { plazoAbierto: abierto } });

/** Un instante dentro de `dias` días, a la hora UTC dada (a mediodía, el mismo día en Madrid). */
const dentroDe = (dias: number, hora = 12) => new Date(`${sumarDias(diaMadrid(new Date()), dias)}T${String(hora).padStart(2, '0')}:00:00.000Z`);

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
  const turno = async (dentroDeHoras: number, slug: string = PASION) => {
    const fecha = new Date(Date.now() + dentroDeHoras * 60 * 60 * 1000);
    const t = await db.turno.create({ data: { fecha, horaInicio: fecha, horaFin: new Date(fecha.getTime() + 3 * 60 * 60 * 1000), capacidadEstimada: 50, salidaId: await idDeSalida(slug) } });
    turnos.push(t.id);
    return t;
  };
  const eventos: number[] = [];
  const claves: string[] = [];
  const recoger = async () => {
    const fichas = [titular.id, sobrino.id];
    await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: [admin.id, usuario.id] } }, { entityType: 'hermano', entityId: { in: [String(titular.id), String(sobrino.id)] } }] } });
    await db.operacionMesa.deleteMany({ where: { clave: { in: claves } } });
    await db.solicitud.deleteMany({ where: { hermanoId: { in: fichas } } });
    await db.transaccion.deleteMany({ where: { hermanoId: { in: fichas } } });
    await db.papeletaSitio.deleteMany({ where: { hermanoId: { in: fichas } } });
    await db.recibo.deleteMany({ where: { hermanoId: { in: fichas } } });
    await db.evento.deleteMany({ where: { OR: [{ id: { in: eventos } }, { turno: { id: { in: turnos } } }] } });
    await db.cita.deleteMany({ where: { OR: [{ hermanoId: { in: [titular.id, sobrino.id] } }, { turnoId: { in: turnos } }] } });
    await db.turno.deleteMany({ where: { id: { in: turnos } } });
    await db.noticia.deleteMany({ where: { id: { in: noticias } } });
    await db.hermano.deleteMany({ where: { id: { in: [titular.id, sobrino.id] } } });
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(admin.id);
  };
  return { admin, usuario, titular, sobrino, turno, turnos, noticias, eventos, claves, recoger };
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
      MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: turno.id, hermanoId: e.titular.id, puesto: 'Nazareno' }),
      /no está abierta/,
    );
    // Por HTTP, igual: no basta con esconder el botón.
    const res = await comoHermano(e.usuario.id, '/api/procesion/avisar', { method: 'POST', json: { turnoId: turno.id, hermanoId: e.titular.id, puesto: 'Nazareno' } });
    assert.equal(res.status, 409);

    await fijarPlazo(true);
    const pedida = await MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: turno.id, hermanoId: e.sobrino.id, puesto: 'Monaguillo' });
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: pedida.citaId } })).estado, 'RESERVADA');
    const solicitud = await db.solicitud.findUniqueOrThrow({ where: { id: pedida.solicitudId } });
    assert.equal(solicitud.puesto, 'Monaguillo', 'queda lo que pidió: el puesto lo decide el Grupo');
    assert.equal(solicitud.origen, 'WEB');
    assert.equal(solicitud.citaId, pedida.citaId);
    assert.equal(await db.papeletaSitio.count({ where: { hermanoId: e.sobrino.id } }), 0, 'la papeleta nace al recogerla en la mesa');

    const estado = await MiProcesionService.getMiEstado(e.usuario.id);
    const pasion = estado.salidas.find((x) => x.salida === PASION)!;
    assert.equal(pasion.abierto, true);
    assert.ok(pasion.dias.some((d) => d.id === turno.id));
    const deSobrino = estado.fichas.find((f) => f.id === e.sobrino.id);
    assert.equal(deSobrino?.porSalida[PASION].solicitud?.cita?.turno.id, turno.id);
    assert.equal(deSobrino?.porSalida[PASION].solicitud?.puesto, 'Monaguillo');
    assert.equal(deSobrino?.porSalida[PASION].papeleta, null);
    assert.equal(deSobrino?.parentesco, 'SOBRINO');
    assert.equal(estado.fichas.find((f) => f.id === e.titular.id)?.porSalida[PASION].solicitud, null);
  } finally {
    await e.recoger();
  }
});

test('abrir exige días de reparto; al abrir se avisa y queda un borrador de noticia', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    await fijarPlazo(false);
    const hayDias = (await PlazoPapeletasService.diasFuturos(await salida(PASION))).length > 0;
    if (!hayDias) {
      await assert.rejects(PlazoPapeletasService.cambiar(true, {}, await salida(PASION), { userId: e.admin.id }), /No hay días de reparto/);
    }

    await e.turno(30);
    avisosDeApertura.mock.resetCalls();
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.ADMIN)}`, 'Content-Type': 'application/json' };
    const res = await fetch(`${baseUrl}/api/procesion/admin/plazo`, { method: 'POST', headers: cabeceras, body: JSON.stringify({ abierto: true, avisar: true, borradorNoticia: true, salida: PASION }) });
    assert.equal(res.status, 200);
    const cuerpo = await res.json() as { abierto: boolean; avisados: number; noticiaId: number | null };
    assert.equal(cuerpo.abierto, true);
    assert.ok(cuerpo.avisados >= 1, 'la cuenta de prueba tiene fichas activas');
    assert.ok(cuerpo.noticiaId);
    e.noticias.push(cuerpo.noticiaId!);

    const noticia = await db.noticia.findUnique({ where: { id: cuerpo.noticiaId! } });
    assert.equal(noticia?.visible, false, 'es un borrador');
    assert.match(noticia?.contenido ?? '', /<ul>/);
    assert.equal(await PlazoPapeletasService.estaAbierto(await salida(PASION)), true);
    assert.equal(noticia?.titulo, `Abierta la inscripción del Sábado de Pasión ${PlazoPapeletasService.anioDeLaProcesion(await salida(PASION))}`);

    // Los correos salen después de responder.
    await new Promise((r) => setTimeout(r, 50));
    const nuestro = avisosDeApertura.mock.calls.find((c) => c.arguments[0] === e.usuario.email);
    assert.ok(nuestro, 'se avisa a la cuenta de prueba');
    assert.deepEqual((nuestro!.arguments[2] as string[]).length, 2, 'nombra sus dos fichas');

    // Un hermano no puede tocar el plazo.
    const deHermano = await fetch(`${baseUrl}/api/procesion/admin/plazo`, {
      method: 'POST',
      headers: { Cookie: `${COOKIE_CMS}=${generateToken(e.usuario.id, Role.USER)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ abierto: false, salida: PASION }),
    });
    assert.equal(deHermano.status, 403);
  } finally {
    await e.recoger();
  }
});

test('una salida con fecha a mano no abre su plazo sin fecha, y sin salida o con una que no existe es un 400', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    await fijarPlazo(false, ROSARIO);
    await db.salida.update({ where: { slug: ROSARIO }, data: { eventoId: null } });
    await e.turno(30, ROSARIO);
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.ADMIN)}`, 'Content-Type': 'application/json' };
    const abrir = (cuerpo: Record<string, unknown>) => fetch(`${baseUrl}/api/procesion/admin/plazo`, { method: 'POST', headers: cabeceras, body: JSON.stringify({ abierto: true, ...cuerpo }) });

    const sinFecha = await abrir({ salida: ROSARIO });
    assert.equal(sinFecha.status, 409);
    assert.match((await sinFecha.json() as { error: string }).error, /Pon antes la fecha de la salida en la Agenda/);
    assert.equal(await PlazoPapeletasService.estaAbierto(await salida(ROSARIO)), false);

    assert.equal((await abrir({})).status, 400);
    const noExiste = await abrir({ salida: 'no-existe' });
    assert.equal(noExiste.status, 400);
    assert.match((await noExiste.json() as { error: string }).error, /No existe la salida «no-existe»/);

    // El plazo de la salida a mano dice qué acto le da la fecha (aquí, ninguno).
    const plazo = await (await fetch(`${baseUrl}/api/procesion/admin/plazo?salida=${ROSARIO}`, { headers: cabeceras })).json() as { salida: string; fecha: unknown };
    assert.equal(plazo.salida, ROSARIO);
    assert.equal(plazo.fecha, null);
  } finally {
    await e.recoger();
  }
});

test('el Rosario tiene su plazo y sus días; se pide con donativo, se paga en línea y, pagada, ya no se cancela desde el área', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const pasion = await e.turno(26);
    const rosario = await e.turno(28, ROSARIO);
    await fijarPlazo(true);
    await fijarPlazo(false, ROSARIO);
    await assert.rejects(
      MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: rosario.id, hermanoId: e.titular.id, puesto: 'Farol', donativo: 5 }),
      /Rosario vespertino no está abierta/,
    );
    await fijarPlazo(true, ROSARIO);

    // Las dos salidas, cada una con su papeleta y su día.
    await MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: pasion.id, hermanoId: e.titular.id, puesto: 'Nazareno' });
    const r = await MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: rosario.id, hermanoId: e.titular.id, puesto: 'Vela', donativo: 5 });
    assert.equal(r.salida, ROSARIO);
    await assert.rejects(
      MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: rosario.id, hermanoId: e.titular.id, puesto: 'Vela' }),
      /Ya está apuntado al Rosario vespertino/,
    );

    const estado = await MiProcesionService.getMiEstado(e.usuario.id);
    const titular = estado.fichas.find((f) => f.id === e.titular.id)!;
    assert.equal(titular.porSalida[ROSARIO].solicitud?.pendiente, 5);
    assert.equal(titular.porSalida[PASION].solicitud?.pendiente, 0, 'sin cuota de salida');
    assert.equal(estado.pagoEnLinea, true, 'fuera de producción, la pasarela simulada está encendida');
    assert.equal(await db.recibo.count({ where: { hermanoId: e.titular.id } }), 0, 'pedir no genera recibos');

    // Pagar en línea (simulado): un solo cobro aunque se repita.
    const clave = `prueba-${Date.now()}`;
    e.claves.push(clave);
    await MisRecibosService.pagarEnLinea(e.usuario.id, { solicitudIds: [r.solicitudId] }, clave);
    const otraVez = await MisRecibosService.pagarEnLinea(e.usuario.id, { solicitudIds: [r.solicitudId] }, clave);
    assert.equal(otraVez.repetida, true);
    const recibo = await db.recibo.findFirstOrThrow({ where: { hermanoId: e.titular.id, tipo: 'DONATIVO' } });
    assert.equal(recibo.estado, EstadoPago.PAGADO);
    assert.equal(recibo.metodoPago, 'TARJETA');
    assert.equal(String(recibo.importe), '5');
    assert.equal(await db.transaccion.count({ where: { reciboId: recibo.id } }), 1);

    // Pagada, cancelarla es cosa de Tesorería (hay que devolver el dinero).
    await assert.rejects(MiProcesionService.cancelarAsistencia(e.usuario.id, r.citaId), /habla con Tesorería/);
    // Lo de otra cuenta no se paga desde aquí.
    const otro = await crearUsuarioPrueba(Role.USER);
    try {
      await assert.rejects(MisRecibosService.pagarEnLinea(otro.id, { solicitudIds: [r.solicitudId] }, undefined), /Recibo no encontrado/);
    } finally {
      await borrarUsuarioPrueba(otro.id);
    }
  } finally {
    await e.recoger();
  }
});

test('los días de reparto y la fecha del Rosario salen en la Agenda pública', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  const meta = { userId: e.admin.id };
  try {
    // La fecha del Rosario la pone Secretaría: crea su acto en la Agenda, y
    // cambiarla mueve el mismo acto. Sin octubre obligatorio: la decide la Junta.
    const rosario = await SalidasService.fijarFecha(await salida(ROSARIO), { inicio: dentroDe(60, 17).toISOString(), lugar: 'Parroquia' }, meta);
    e.eventos.push(rosario.eventoId);
    const movido = await SalidasService.fijarFecha(await salida(ROSARIO), { inicio: dentroDe(61, 17).toISOString(), lugar: 'Parroquia' }, meta);
    assert.equal(movido.eventoId, rosario.eventoId, 'cambiar la fecha mueve el mismo acto');
    const enAgenda = await db.evento.findUniqueOrThrow({ where: { id: rosario.eventoId } });
    assert.equal(enAgenda.type, 'PROCESION');
    assert.equal(enAgenda.title, 'Rosario vespertino');
    assert.equal((await salida(ROSARIO)).eventoId, rosario.eventoId, 'la salida queda enlazada a su acto');
    // La de la Pascua se calcula sola.
    await assert.rejects(SalidasService.fijarFecha(await salida(PASION), { inicio: dentroDe(10).toISOString() }, meta), /se calcula por la Pascua/);

    // Un día de reparto antes de la salida, con su acto en la Agenda.
    const dia = dentroDe(30);
    const iso = (h: number) => new Date(dia.getTime() + (h - 12) * 60 * 60 * 1000).toISOString();
    const turno = await TurnosService.crearTurno({ fecha: iso(12).slice(0, 10), horaInicio: iso(12), horaFin: iso(15), capacidadEstimada: 60, salida: ROSARIO }, await salida(ROSARIO), meta);
    e.turnos.push(turno.id);
    const acto = await db.evento.findUniqueOrThrow({ where: { id: turno.eventoId! } });
    assert.equal(acto.title, 'Reparto de papeletas del Rosario vespertino');
    assert.equal(acto.startDate.toISOString(), iso(12));

    await TurnosService.eliminarTurno(turno.id, meta);
    e.turnos.splice(e.turnos.indexOf(turno.id), 1);
    assert.equal(await db.evento.findUnique({ where: { id: acto.id } }), null, 'se va con su día');

    // Y después de la salida, no: la papeleta caería en una que ya pasó.
    const tarde = dentroDe(62).toISOString();
    await assert.rejects(
      TurnosService.crearTurno({ fecha: tarde.slice(0, 10), horaInicio: tarde, horaFin: dentroDe(62, 15).toISOString(), capacidadEstimada: 60, salida: ROSARIO }, await salida(ROSARIO), meta),
      /tiene que ser antes de la salida/,
    );
  } finally {
    await e.recoger();
  }
});

test('Secretaría solo ve los días de reparto de la salida que se prepara, y los ya pasados no se borran', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const deEsteAnio = await e.turno(26);
    const pasado = await e.turno(-48);
    const antiguo = await e.turno(-2 * 366 * 24);

    await db.cita.create({ data: { turnoId: deEsteAnio.id, hermanoId: e.titular.id, estado: 'ATENDIDA' } });
    await db.cita.create({ data: { turnoId: deEsteAnio.id, hermanoId: e.sobrino.id, estado: 'CANCELADA' } });

    const lista = await TurnosService.getTodosLosTurnos(await salida(PASION));
    const ids = lista.map((x) => x.id);
    assert.ok(ids.includes(deEsteAnio.id), 'el día que viene sale');
    assert.ok(!ids.includes(antiguo.id), 'el de hace dos años no sale');
    const dia = lista.find((x) => x.id === deEsteAnio.id)!;
    assert.equal(dia.citas, 1, 'quien ya vino sigue contando; la anulada, no');
    assert.equal(dia.vinieron, 1);

    await assert.rejects(TurnosService.eliminarTurno(pasado.id, { userId: e.admin.id }), /ya ha pasado/);
    assert.ok(await db.turno.findUnique({ where: { id: pasado.id } }), 'el día pasado sigue ahí');
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
