// Recibos, tesorería y procesión contra MariaDB. Cada prueba siembra sus
// propias fichas (usuario, hermano, turnos) y las recoge al terminar, pase lo
// que pase: esto corre contra la base de datos de desarrollo.
//
// El correo va simulado: sin él, cada papeleta intentaría salir por Gmail y
// las pruebas de ausencias esperarían a cada envío.

import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoCita, EstadoPago, MetodoPago, Prisma, Role, TipoRecibo, TipoTransaccion } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { EmailService } from '../src/services/email.service.js';
import { AvisosPersonalesService } from '../src/services/avisos-personales.service.js';
import { ReciboService } from '../src/services/recibo.service.js';
import { devueltosPendientes, idCategoriaDeRecibos } from '../src/services/recibos/comunes.js';
import { MiProcesionService } from '../src/services/procesion/mi-procesion.service.js';
import { PapeletasService } from '../src/services/procesion/papeletas.service.js';
import { anioDeLaMesa, ZonasService } from '../src/services/procesion/zonas.service.js';
import { TurnosService } from '../src/services/procesion/turnos.service.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { diaMadrid, inicioDiaMadrid } from '../src/domain/contabilidad.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { conceptoDe, PASION, ROSARIO, salida } from './fixtures/salidas.js';
import { reglaDe } from '../src/services/procesion/salidas.service.js';
import { proximaFecha, sumarDias } from '../src/domain/fecha-salida.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;

// El aviso se compone de verdad; ponerlo en la cola, no: dejaría filas en la cola de la base de pruebas.
const recordatoriosEnviados = mock.method(EmailService, 'correoRecordatorioAusencia');
mock.method(AvisosPersonalesService, 'ponerEnCola', async () => 0);

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  mock.restoreAll();
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

// El año de la salida que atiende la mesa, que no es el natural: pasada la
// Semana Santa es el siguiente (ver `anioDeLaMesa`). Sin base, el natural: esas
// pruebas se omiten igual.
const YEAR = await salida(PASION).then(anioDeLaMesa).catch(() => new Date().getFullYear());

/**
 * Un día de reparto que vale para la Pasión: la víspera de su próxima salida.
 * Las horas, a mediodía en UTC, caen en ese mismo día en Madrid todo el año.
 */
async function diaDeReparto() {
  return sumarDias(proximaFecha(reglaDe(await salida(PASION)), diaMadrid(new Date()))!, -1);
}

/**
 * Un recibo «en el banco». A REMESADO solo lo lleva una remesa (NG15), y
 * generarla pide mandato e IBAN: estas pruebas solo necesitan el estado.
 */
const enElBanco = (id: number) => db.recibo.update({ where: { id }, data: { estado: EstadoPago.REMESADO } });

/** Cambia la fila de la Pasión mientras dura `fn` y la deja como estaba. */
async function conLaPasion(cambios: Prisma.SalidaUpdateInput, fn: () => Promise<void>) {
  const previa = await db.salida.findUniqueOrThrow({ where: { slug: PASION } });
  await db.salida.update({ where: { slug: PASION }, data: cambios });
  try {
    await fn();
  } finally {
    const { importeCuota, horaSalida, lugar, plazoAbierto, plazoCambiadoEl } = previa;
    await db.salida.update({ where: { slug: PASION }, data: { importeCuota, horaSalida, lugar, plazoAbierto, plazoCambiadoEl } });
  }
}

/**
 * Un escenario desechable: un administrador (el que firma la auditoría), un
 * usuario con sus fichas de hermano y los turnos que se creen. `recoger`
 * lo borra todo en orden inverso al de las claves ajenas.
 */
async function escenario() {
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  const usuario = await crearUsuarioPrueba(Role.USER);
  const hermanos: number[] = [];
  const turnos: number[] = [];
  const meta = { userId: admin.id };
  // Estas pruebas cobran papeletas: la cuota de la Pasión, a 30 € mientras duran.
  const pasion = await salida(PASION);
  const cuotaSalida = pasion.importeCuota;
  await db.salida.update({ where: { id: pasion.id }, data: { importeCuota: 30 } });

  const hermano = async (extra: { tieneTunicaPropia?: boolean; activo?: boolean } = {}) => {
    const h = await db.hermano.create({
      data: {
        userId: usuario.id,
        nombre: 'Prueba',
        apellidos: `Tesoreria ${Date.now()}${hermanos.length}`,
        fechaNacimiento: new Date(Date.UTC(1990, 0, 1)),
        activo: extra.activo ?? true,
        tieneTunicaPropia: extra.tieneTunicaPropia ?? true
      }
    });
    hermanos.push(h.id);
    return h;
  };

  const turno = async (fecha: Date) => {
    const t = await db.turno.create({
      data: { fecha, horaInicio: fecha, horaFin: new Date(fecha.getTime() + 3 * 60 * 60 * 1000), capacidadEstimada: 100, salidaId: pasion.id }
    });
    turnos.push(t.id);
    return t;
  };

  const recoger = async () => {
    await db.auditLog.deleteMany({ where: { userId: admin.id } });
    await db.solicitud.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.transaccion.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.papeletaSitio.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.cita.deleteMany({ where: { OR: [{ hermanoId: { in: hermanos } }, { turnoId: { in: turnos } }] } });
    await db.recibo.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.turno.deleteMany({ where: { id: { in: turnos } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(admin.id);
    await db.salida.update({ where: { id: pasion.id }, data: { importeCuota: cuotaSalida } });
  };

  /** El camino entero de la mesa: apuntar en Inscripción, cobrar en Tesorería y recoger en Túnicas. */
  const apuntarYCobrar = async (hermanoId: number, puesto = 'Nazareno', metodoPago: 'EFECTIVO' | 'BIZUM' = MetodoPago.EFECTIVO) => {
    const { solicitudId, requisitos } = await ZonasService.inscribir({ hermanoId, salida: await salida(PASION), puesto }, undefined, meta);
    if (requisitos.salidaPendiente > 0) await ZonasService.cobrar({ hermanoId, reciboIds: [], solicitudes: [{ solicitudId }], metodoPago }, undefined, meta);
    const { papeletaId } = await ZonasService.entregar({ solicitudId, origenTunica: 'PROPIA' }, undefined, meta);
    const papeleta = await db.papeletaSitio.findUniqueOrThrow({ where: { id: papeletaId } });
    return { recibo: await db.recibo.findUniqueOrThrow({ where: { id: papeleta.reciboId } }), papeleta };
  };

  return { admin, usuario, meta, pasion, hermano, turno, turnos, apuntarYCobrar, recoger };
}

async function auditoria(action: string, entityId: number | string) {
  return db.auditLog.findFirst({ where: { action, entityId: String(entityId) }, orderBy: { id: 'desc' } });
}

async function apuntes(reciboId: number) {
  return db.transaccion.findMany({ where: { reciboId }, orderBy: { id: 'asc' } });
}

// ============================================================================
//  D2 · anular una papeleta cobrada
// ============================================================================

test('D2: anular una papeleta cobrada devuelve el recibo con su reverso, libera la cita y deja reinscribir', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const turno = await e.turno(new Date(Date.now() + 60 * 60 * 1000));
    const cita = await db.cita.create({ data: { hermanoId: hermano.id, turnoId: turno.id } });

    const { recibo, papeleta } = await e.apuntarYCobrar(hermano.id);
    assert.equal(papeleta.citaId, cita.id, 'la mesa enlaza la cita que tenía');
    assert.equal(recibo.estado, EstadoPago.PAGADO);
    // La papeleta es de la salida que se prepara, aunque el reparto sea en el año anterior.
    assert.equal(recibo.concepto, await conceptoDe(PASION, YEAR));

    const respuesta = await PapeletasService.anularPapeleta(papeleta.id, e.meta);
    assert.equal(respuesta.estadoRecibo, EstadoPago.REEMBOLSADO);

    // El recibo sigue el grafo: PAGADO -> REEMBOLSADO, nunca un ANULADO forzado.
    // Ni DEVUELTO: eso es una deuda que se reemite, y lo reembolsado no se debe.
    const tras = await db.recibo.findUniqueOrThrow({ where: { id: recibo.id } });
    assert.equal(tras.estado, EstadoPago.REEMBOLSADO);
    // Y no cuenta como por cobrar: antes el Inicio lo sumaba y Tesorería ofrecía reemitirlo.
    assert.equal((await devueltosPendientes({ hermanoId: hermano.id })).total, 0);

    // Y contabilidad cuadra: el ingreso tiene su reverso por el mismo importe.
    const movimientos = await apuntes(recibo.id);
    assert.deepEqual(movimientos.map((m) => [m.tipo, String(m.importe)]), [
      [TipoTransaccion.INGRESO, '30'],
      [TipoTransaccion.GASTO, '30'],
    ]);

    assert.equal(await db.papeletaSitio.findUnique({ where: { id: papeleta.id } }), null, 'la papeleta debe quedar borrada');
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.CANCELADA);

    // Auditoría escrita tras confirmar, con el antes y el después.
    const registro = await auditoria(ACCIONES_AUDITORIA.PAPELETA_ANULAR, papeleta.id);
    const detalles = registro?.detalles as { antes: { recibo: { estado: string } }; despues: { recibo: { estado: string } } };
    assert.equal(detalles.antes.recibo.estado, EstadoPago.PAGADO);
    assert.equal(detalles.despues.recibo.estado, EstadoPago.REEMBOLSADO);

    // Reinscribir: antes daba 500 porque el recibo devuelto ocupaba el concepto.
    const segunda = await e.apuntarYCobrar(hermano.id, 'Bocina', MetodoPago.BIZUM);
    assert.equal(segunda.recibo.concepto, `${await conceptoDe(PASION, YEAR)} (reemisión 2)`);
    assert.equal(segunda.recibo.estado, EstadoPago.PAGADO);
  } finally {
    await e.recoger();
  }
});

test('D2: si Tesorería devuelve el recibo de una papeleta, la papeleta queda anulada igual', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const { recibo, papeleta } = await e.apuntarYCobrar(hermano.id);

    const respuesta = await ReciboService.adminUpdateDetalles(recibo.id, { estado: 'DEVUELTO' }, e.meta);
    assert.equal(respuesta.papeletaAnulada, true);
    assert.equal(await db.papeletaSitio.findUnique({ where: { id: papeleta.id } }), null);
    assert.equal((await apuntes(recibo.id)).filter((m) => m.tipo === TipoTransaccion.GASTO).length, 1, 'un solo reverso');

    const registro = await auditoria(ACCIONES_AUDITORIA.RECIBO_ACTUALIZAR, recibo.id);
    const detalles = registro?.detalles as { antes: { estado: string }; despues: { estado: string; papeletaAnulada: number } };
    assert.deepEqual([detalles.antes.estado, detalles.despues.estado], [EstadoPago.PAGADO, EstadoPago.DEVUELTO]);
    assert.equal(detalles.despues.papeletaAnulada, papeleta.id);
  } finally {
    await e.recoger();
  }
});

// ============================================================================
//  D3 · emitir un recibo suelto y cobrar un remesado
// ============================================================================

test('D3: se emite un recibo suelto, se remesa y se cobra con su ingreso', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const recibo = await ReciboService.emitirRecibo(
      { hermanoId: hermano.id, year: YEAR, concepto: 'Donativo de prueba', importe: 12.5, tipo: 'DONATIVO' }, e.meta
    );
    assert.equal(recibo.estado, EstadoPago.PENDIENTE);
    assert.equal(recibo.tipo, TipoRecibo.DONATIVO);
    assert.ok(await auditoria(ACCIONES_AUDITORIA.RECIBO_EMITIR, recibo.id), 'la emisión debe quedar auditada');

    // El mismo concepto el mismo año choca con la clave única: 409 con motivo, no 500.
    await assert.rejects(
      ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: 'Donativo de prueba', importe: 5, tipo: 'DONATIVO' }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 409
    );

    await enElBanco(recibo.id);
    const cobrado = await ReciboService.adminMarcarComoPagado(recibo.id, undefined, e.meta);
    assert.equal(cobrado.estado, EstadoPago.PAGADO);
    // Un remesado lo cobra el banco: sin método explícito, domiciliación.
    assert.equal(cobrado.metodoPago, MetodoPago.DOMICILIACION);
    assert.deepEqual((await apuntes(recibo.id)).map((m) => [m.tipo, String(m.importe)]), [[TipoTransaccion.INGRESO, '12.5']]);

    const registro = await auditoria(ACCIONES_AUDITORIA.RECIBO_COBRAR, recibo.id);
    const detalles = registro?.detalles as { antes: { estado: string }; despues: { estado: string } };
    assert.deepEqual([detalles.antes.estado, detalles.despues.estado], [EstadoPago.REMESADO, EstadoPago.PAGADO]);
  } finally {
    await e.recoger();
  }
});

test('D3: no se emiten recibos a hermanos dados de baja', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const baja = await e.hermano({ activo: false });
    await assert.rejects(
      ReciboService.emitirRecibo({ hermanoId: baja.id, year: YEAR, concepto: 'Cuota', importe: 25, tipo: 'CUOTA_HERMANO' }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 404
    );
  } finally {
    await e.recoger();
  }
});

test('D3: por HTTP, Tesorería emite el recibo y busca al hermano sin ver sus datos personales', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.ADMIN)}`, 'Content-Type': 'application/json' };

    const emitir = await fetch(`${baseUrl}/api/recibos/admin`, {
      method: 'POST', headers: cabeceras,
      body: JSON.stringify({ hermanoId: hermano.id, year: YEAR, concepto: 'Cuota anual (reemisión)', importe: 25, tipo: 'CUOTA_HERMANO' })
    });
    assert.equal(emitir.status, 201);
    const cuerpo = await emitir.json() as { reciboId: number; estado: string };
    assert.equal(cuerpo.estado, EstadoPago.PENDIENTE);

    const papeleta = await fetch(`${baseUrl}/api/recibos/admin`, {
      method: 'POST', headers: cabeceras,
      body: JSON.stringify({ hermanoId: hermano.id, year: YEAR, concepto: 'Papeleta suelta', importe: 25, tipo: 'PAPELETA_SITIO' })
    });
    assert.equal(papeleta.status, 400, 'las papeletas no se emiten sueltas');

    const busqueda = await fetch(`${baseUrl}/api/recibos/admin/hermanos?q=${encodeURIComponent(hermano.apellidos)}`, { headers: cabeceras });
    assert.equal(busqueda.status, 200);
    const encontrados = await busqueda.json() as Record<string, unknown>[];
    assert.equal(encontrados.length, 1);
    assert.deepEqual(Object.keys(encontrados[0]).sort(), ['apellidos', 'id', 'nombre', 'numeroHermano']);
  } finally {
    await e.recoger();
  }
});

// ============================================================================
//  D4 · precios de la papeleta
// ============================================================================

test('D4: con la cuota de salida a 0 la papeleta nace exenta y sin asiento; a 12,50 cobra 12,50', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano({ tieneTunicaPropia: false });

    await db.salida.update({ where: { id: e.pasion.id }, data: { importeCuota: 0 } });
    const gratis = await e.apuntarYCobrar(hermano.id);
    assert.equal(gratis.recibo.estado, EstadoPago.EXENTO);
    assert.equal(String(gratis.recibo.importe), '0');
    assert.equal(gratis.recibo.metodoPago, null);
    assert.deepEqual(await apuntes(gratis.recibo.id), [], 'el dinero que no existe no deja asientos');

    // Anular una papeleta exenta no mueve el recibo (EXENTO es final) ni inventa reversos.
    const anulada = await PapeletasService.anularPapeleta(gratis.papeleta.id, e.meta);
    assert.equal(anulada.estadoRecibo, EstadoPago.EXENTO);
    assert.deepEqual(await apuntes(gratis.recibo.id), []);

    await db.salida.update({ where: { id: e.pasion.id }, data: { importeCuota: 12.5 } });
    const conComa = await e.apuntarYCobrar(hermano.id);
    assert.equal(String(conComa.recibo.importe), '12.5', 'sin alquiler de túnica: solo la cuota de salida');
    assert.equal(conComa.recibo.estado, EstadoPago.PAGADO);
  } finally {
    await e.recoger();
  }
});

// ============================================================================
//  D5 · carrera entre cobrar y cambiar el estado
// ============================================================================

test('D5: cobrar y anular a la vez nunca deja un recibo anulado con su ingreso apuntado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    for (let i = 0; i < 5; i += 1) {
      const recibo = await ReciboService.emitirRecibo(
        { hermanoId: hermano.id, year: YEAR, concepto: `Carrera ${i}`, importe: 10, tipo: 'OTRO' }, e.meta
      );
      const resultados = await Promise.allSettled([
        ReciboService.adminMarcarComoPagado(recibo.id, MetodoPago.EFECTIVO, e.meta),
        ReciboService.adminUpdateDetalles(recibo.id, { estado: 'ANULADO' }, e.meta),
      ]);
      assert.ok(resultados.some((r) => r.status === 'fulfilled'), 'al menos una de las dos debe ganar');

      const final = await db.recibo.findUniqueOrThrow({ where: { id: recibo.id } });
      const ingresos = (await apuntes(recibo.id)).filter((m) => m.tipo === TipoTransaccion.INGRESO).length;
      if (final.estado === EstadoPago.PAGADO) assert.equal(ingresos, 1, 'cobrado: un ingreso');
      else {
        assert.equal(final.estado, EstadoPago.ANULADO);
        assert.equal(ingresos, 0, 'anulado: ningún ingreso');
      }
    }
  } finally {
    await e.recoger();
  }
});

test('D5/D19: un cambio de estado rechazado no deja auditoría ni toca el recibo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const recibo = await ReciboService.emitirRecibo(
      { hermanoId: hermano.id, year: YEAR, concepto: 'Cuota rechazada', importe: 10, tipo: 'CUOTA_HERMANO' }, e.meta
    );
    await ReciboService.adminMarcarComoPagado(recibo.id, MetodoPago.EFECTIVO, e.meta);

    await assert.rejects(ReciboService.adminUpdateDetalles(recibo.id, { estado: 'EXENTO' }, e.meta), HttpError);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: recibo.id } })).estado, EstadoPago.PAGADO);
    // Antes se auditaba ANTES de la transacción: el registro daba fe de un cambio que no ocurrió.
    assert.equal(await auditoria(ACCIONES_AUDITORIA.RECIBO_ACTUALIZAR, recibo.id), null);
  } finally {
    await e.recoger();
  }
});

// ============================================================================
//  D14 · generar cuotas sin duplicar
// ============================================================================

test('D14: generar cuotas salta a quien ya tiene su cuota del año, se llame como se llame', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // Un año sin recibos reales, para poder recoger lo generado sin tocar nada más.
  const ANIO = 2099;
  if (await db.recibo.count({ where: { year: ANIO } }) > 0) return t.skip(`ya hay recibos de ${ANIO} en la base; no se puede recoger sin riesgo`);

  const e = await escenario();
  try {
    const hermano = await e.hermano();
    await db.recibo.create({
      data: { hermanoId: hermano.id, year: ANIO, concepto: 'Cuota antigua', importe: 20, tipo: TipoRecibo.CUOTA_HERMANO }
    });

    const primera = await ReciboService.generarCuotaAnual({ year: ANIO, importe: 1, concepto: 'Cuota de prueba D14' }, e.meta);
    assert.ok((primera.omitidos ?? 0) >= 1);
    assert.equal(
      await db.recibo.count({ where: { hermanoId: hermano.id, year: ANIO } }), 1,
      'quien ya tenía una cuota de ese año con otro nombre no recibe otra'
    );

    const segunda = await ReciboService.generarCuotaAnual({ year: ANIO, importe: 1, concepto: 'Cuota 2099 bis' }, e.meta);
    assert.match(segunda.message, /ya tenían su cuota/);
    assert.equal(await db.recibo.count({ where: { year: ANIO, concepto: 'Cuota 2099 bis' } }), 0);
  } finally {
    await db.recibo.deleteMany({ where: { year: ANIO, concepto: { in: ['Cuota de prueba D14', 'Cuota 2099 bis'] } } });
    await e.recoger();
  }
});

// ============================================================================
//  D16 · aforo y doble reserva
// ============================================================================

test('D16: los apuntados de un día no cuentan las citas canceladas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const turno = await e.turno(new Date(Date.now() + 60 * 60 * 1000));
    const a = await e.hermano();
    const b = await e.hermano();
    await db.cita.create({ data: { hermanoId: a.id, turnoId: turno.id, estado: EstadoCita.RESERVADA } });
    await db.cita.create({ data: { hermanoId: b.id, turnoId: turno.id, estado: EstadoCita.CANCELADA } });

    const dia = (await MiProcesionService.getDiasDisponibles(await salida(PASION))).find((d) => d.id === turno.id);
    assert.equal(dia?.genteApuntada, 1);
  } finally {
    await e.recoger();
  }
});

test('D16: dos avisos a la vez para dos días no dejan al hermano con dos citas; cancelar y volver al mismo día funciona', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const t1 = await e.turno(new Date(Date.now() + 60 * 60 * 1000));
    const t2 = await e.turno(new Date(Date.now() + 2 * 60 * 60 * 1000));

    // Reservar exige el plazo abierto (plazo-papeletas.test.ts prueba el cerrado).
    await conLaPasion({ plazoAbierto: true }, async () => {
      const resultados = await Promise.allSettled([
        MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: t1.id, hermanoId: hermano.id, puesto: 'Nazareno' }),
        MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: t2.id, hermanoId: hermano.id, puesto: 'Nazareno' }),
      ]);
      assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1, 'solo una reserva puede ganar');
      const reservadas = await db.cita.findMany({ where: { hermanoId: hermano.id, estado: EstadoCita.RESERVADA } });
      assert.equal(reservadas.length, 1);
      assert.equal(await db.solicitud.count({ where: { hermanoId: hermano.id, estado: 'PENDIENTE' } }), 1, 'y una sola solicitud');
      assert.equal(await db.papeletaSitio.count({ where: { hermanoId: hermano.id } }), 0, 'la papeleta nace al recoger');

      // La cita es única por [hermano, turno]: cancelar y volver a pedir el mismo día chocaba con la clave.
      await MiProcesionService.cancelarAsistencia(e.usuario.id, reservadas[0].id);
      assert.equal(await db.solicitud.count({ where: { hermanoId: hermano.id, estado: 'PENDIENTE' } }), 0, 'cancelar cancela la solicitud');
      const otraVez = await MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: reservadas[0].turnoId, hermanoId: hermano.id, puesto: 'Nazareno' });
      assert.equal(otraVez.id, reservadas[0].id);
      assert.equal((await db.cita.findUniqueOrThrow({ where: { id: otraVez.id } })).estado, EstadoCita.RESERVADA);
    });
  } finally {
    await e.recoger();
  }
});

// ============================================================================
//  P5 · procesar ausencias
// ============================================================================

test('P5: por HTTP, una fecha futura o ilegible es un 400 y una pasada se procesa y se audita', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.ADMIN)}`, 'Content-Type': 'application/json' };
    const url = `${baseUrl}/api/procesion/admin/procesar-ausencias`;
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    assert.equal((await fetch(url, { method: 'POST', headers: cabeceras, body: JSON.stringify({ fechaLimite: manana }) })).status, 400);
    assert.equal((await fetch(url, { method: 'POST', headers: cabeceras, body: JSON.stringify({ fechaLimite: 'el lunes' }) })).status, 400);

    // 2000-01-01: ningún turno real es tan antiguo, así que no toca datos de nadie.
    const valida = await fetch(url, { method: 'POST', headers: cabeceras, body: JSON.stringify({ fechaLimite: '2000-01-01', cierreDefinitivo: true }) });
    assert.equal(valida.status, 200);
    const registro = await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.AUSENCIAS_PROCESAR, userId: e.admin.id } });
    assert.equal((registro?.detalles as { citasAfectadas: number }).citasAfectadas, 0);
  } finally {
    await e.recoger();
  }
});

test('P5: marca como no presentado a quien no vino, le escribe y audita cuántas citas tocó', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const turno = await e.turno(new Date(Date.UTC(2001, 0, 1, 18)));
    const cita = await db.cita.create({ data: { hermanoId: hermano.id, turnoId: turno.id } });
    recordatoriosEnviados.mock.resetCalls();

    const resultado = await PapeletasService.procesarAusencias(new Date(Date.UTC(2001, 0, 2)), false, e.meta);
    assert.equal(resultado.procesadas, 1);
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.NO_PRESENTADO);
    assert.equal(recordatoriosEnviados.mock.callCount(), 1);

    const registro = await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.AUSENCIAS_PROCESAR, userId: e.admin.id } });
    const detalles = registro?.detalles as { citasAfectadas: number; citaIds: number[]; estadoNuevo: string };
    assert.equal(detalles.citasAfectadas, 1);
    assert.deepEqual(detalles.citaIds, [cita.id]);
    assert.equal(detalles.estadoNuevo, EstadoCita.NO_PRESENTADO);

    // El servicio tampoco acepta una fecha futura aunque se le llame sin pasar por el esquema.
    await assert.rejects(PapeletasService.procesarAusencias(new Date(Date.now() + 60_000), false, e.meta), HttpError);
  } finally {
    await e.recoger();
  }
});

test('P5: sin fecha límite, el turno de hoy que aún no ha terminado no cuenta como ausencia', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // Sin fecha límite el proceso mira TODA la base. Si hubiera citas reales ya
  // vencidas, esta prueba las procesaría: en ese caso no se toca nada.
  const vencidasAjenas = await db.cita.count({
    where: { estado: EstadoCita.RESERVADA, papeleta: null, turno: { horaFin: { lt: new Date() } } }
  });
  if (vencidasAjenas > 0) return t.skip(`hay ${vencidasAjenas} citas reales vencidas sin procesar; no se ejecuta para no tocarlas`);

  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const ahora = Date.now();
    // Como lo guarda crearTurno: `fecha` es la medianoche del día y las horas
    // son instantes completos. El turno es hoy, pero empieza dentro de una hora.
    const turno = await db.turno.create({
      data: {
        fecha: inicioDiaMadrid(diaMadrid(new Date(ahora))),
        horaInicio: new Date(ahora + 60 * 60 * 1000),
        horaFin: new Date(ahora + 3 * 60 * 60 * 1000),
        capacidadEstimada: 50,
        salidaId: e.pasion.id,
      }
    });
    e.turnos.push(turno.id);
    const cita = await db.cita.create({ data: { hermanoId: hermano.id, turnoId: turno.id } });
    recordatoriosEnviados.mock.resetCalls();

    // Antes se comparaba `turno.fecha` (medianoche, ya pasada) y esta cita
    // quedaba NO_PRESENTADO con su correo de «no viniste» por la mañana.
    const resultado = await PapeletasService.procesarAusencias(new Date(), false, e.meta);
    assert.equal(resultado.procesadas, 0);
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.RESERVADA);
    assert.equal(recordatoriosEnviados.mock.callCount(), 0);
  } finally {
    await e.recoger();
  }
});

test('NG3: quien no pasó su día cambia a otro con la misma solicitud, o la cancela; el cierre recoge las que se quedaron así', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const otro = await e.hermano();
    const t1 = await e.turno(new Date(Date.now() + 60 * 60 * 1000));
    const t2 = await e.turno(new Date(Date.now() + 2 * 60 * 60 * 1000));
    await conLaPasion({ plazoAbierto: true }, async () => {
      const { citaId, solicitudId } = await MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: t1.id, hermanoId: hermano.id, puesto: 'Nazareno' });
      // Lo que deja «Procesar ausencias».
      await db.cita.update({ where: { id: citaId }, data: { estado: EstadoCita.NO_PRESENTADO } });

      await assert.rejects(MiProcesionService.cambiarDia(e.usuario.id, citaId, t1.id), HttpError, 'el mismo día, no');
      const cambio = await MiProcesionService.cambiarDia(e.usuario.id, citaId, t2.id, e.meta);
      assert.equal(cambio.solicitudId, solicitudId);
      const solicitud = await db.solicitud.findUniqueOrThrow({ where: { id: solicitudId } });
      assert.equal(solicitud.citaId, cambio.citaId);
      assert.equal(solicitud.puesto, 'Nazareno', 'la solicitud es la misma');
      assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cambio.citaId } })).estado, EstadoCita.RESERVADA);
      assert.equal((await db.cita.findUniqueOrThrow({ where: { id: citaId } })).estado, EstadoCita.NO_PRESENTADO, 'la ausencia queda como estaba');
      assert.ok(await auditoria(ACCIONES_AUDITORIA.SOLICITUD_SALIDA_CAMBIAR_DIA, solicitudId));

      // Una cita de otra cuenta no se toca.
      const ajeno = await crearUsuarioPrueba(Role.USER);
      try {
        await assert.rejects(MiProcesionService.cambiarDia(ajeno.id, cambio.citaId, t1.id), HttpError);
      } finally {
        await borrarUsuarioPrueba(ajeno.id);
      }

      // Cancelar la de quien no pasó: antes exigía RESERVADA.
      const delOtro = await MiProcesionService.avisarAsistencia(e.usuario.id, { turnoId: t1.id, hermanoId: otro.id, puesto: 'Nazareno' });
      await db.cita.update({ where: { id: delOtro.citaId }, data: { estado: EstadoCita.NO_PRESENTADO } });
      await MiProcesionService.cancelarAsistencia(e.usuario.id, delOtro.citaId);
      assert.equal((await db.solicitud.findUniqueOrThrow({ where: { id: delOtro.solicitudId } })).estado, 'CANCELADA');
    });

    // El cierre definitivo: una solicitud cuya cita quedó NO_PRESENTADO se cancela.
    const viejo = await e.turno(new Date(Date.UTC(2001, 0, 1, 18)));
    const tercero = await e.hermano();
    const cita = await db.cita.create({ data: { hermanoId: tercero.id, turnoId: viejo.id, estado: EstadoCita.NO_PRESENTADO } });
    const atascada = await db.solicitud.create({ data: { hermanoId: tercero.id, salidaId: e.pasion.id, year: 2001, puesto: 'Cirio', citaId: cita.id, origen: 'WEB' } });
    await PapeletasService.procesarAusencias(new Date(Date.UTC(2001, 0, 2)), true, e.meta);
    assert.equal((await db.solicitud.findUniqueOrThrow({ where: { id: atascada.id } })).estado, 'CANCELADA');
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.CANCELADA);
  } finally {
    await e.recoger();
  }
});

test('NG6: «Papeleta sin recoger» no llega a una ficha de baja, aunque su cita se marque', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const baja = await e.hermano({ activo: false });
    const turno = await e.turno(new Date(Date.UTC(2001, 0, 1, 18)));
    const cita = await db.cita.create({ data: { hermanoId: baja.id, turnoId: turno.id } });
    recordatoriosEnviados.mock.resetCalls();

    await PapeletasService.procesarAusencias(new Date(Date.UTC(2001, 0, 2)), false, e.meta);
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.NO_PRESENTADO);
    assert.equal(recordatoriosEnviados.mock.callCount(), 0);
  } finally {
    await e.recoger();
  }
});

// ============================================================================
//  Revisión · cuota viva, conceptos sin mayúsculas y categorías concurrentes
// ============================================================================

test('D3: no se emite una segunda cuota viva del mismo año aunque cambie el concepto; tras anularla, sí', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const primera = await ReciboService.emitirRecibo(
      { hermanoId: hermano.id, year: YEAR, concepto: 'Cuota anual', importe: 25, tipo: 'CUOTA_HERMANO' }, e.meta
    );

    // Distinto concepto, misma cuota: la clave única no lo veía y se cobraba dos veces.
    await assert.rejects(
      ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: `Cuota ${YEAR}`, importe: 25, tipo: 'CUOTA_HERMANO' }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 409 && /ya tiene su cuota/.test(err.message)
    );
    // Remesada o cobrada sigue viva igual.
    await enElBanco(primera.id);
    await assert.rejects(
      ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: `Cuota ${YEAR}`, importe: 25, tipo: 'CUOTA_HERMANO' }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 409
    );

    // Un donativo el mismo año no es una cuota.
    await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: 'Donativo flores', importe: 10, tipo: 'DONATIVO' }, e.meta);

    // Anulada la cuota, la reemisión es justo para lo que existe este extremo.
    await ReciboService.adminUpdateDetalles(primera.id, { estado: 'ANULADO' }, e.meta);
    const reemision = await ReciboService.emitirRecibo(
      { hermanoId: hermano.id, year: YEAR, concepto: 'Cuota anual (reemisión)', importe: 25, tipo: 'CUOTA_HERMANO' }, e.meta
    );
    assert.equal(reemision.estado, EstadoPago.PENDIENTE);
  } finally {
    await e.recoger();
  }
});

test('D2: un recibo «papeleta sábado de pasión AAAA» en minúsculas no impide inscribir: la papeleta sale como reemisión', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    // La clave única de MariaDB no distingue mayúsculas: este ocupa «Papeleta Sábado de Pasión AAAA».
    await ReciboService.emitirRecibo(
      { hermanoId: hermano.id, year: YEAR, concepto: (await conceptoDe(PASION, YEAR)).toLowerCase(), importe: 5, tipo: 'OTRO' }, e.meta
    );

    const { recibo } = await e.apuntarYCobrar(hermano.id);
    assert.equal(recibo.concepto, `${await conceptoDe(PASION, YEAR)} (reemisión 2)`);
  } finally {
    await e.recoger();
  }
});

test('la primera vez que varios cobros piden a la vez una categoría, todos obtienen la misma sin P2002', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // Con una categoría desechable: las de recibos ya existen en la base y la
  // carrera solo se da la primera vez. Con el upsert a pelo, de seis a la vez
  // fallaban tres con P2002 (comprobado).
  const nombre = `Prueba carrera ${Date.now()}`;
  try {
    const ids = await Promise.all(
      Array.from({ length: 6 }, () => idCategoriaDeRecibos(TipoTransaccion.GASTO, nombre))
    );
    assert.equal(new Set(ids).size, 1, 'todas deben recibir la misma categoría');
    assert.equal(await db.categoriaTransaccion.count({ where: { nombre } }), 1);
  } finally {
    await db.categoriaTransaccion.deleteMany({ where: { nombre } });
  }
});

// ============================================================================
//  D19 · auditoría de turnos
// ============================================================================

test('D19: crear y borrar un turno queda auditado con sus datos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    // La víspera de la salida, a mediodía en UTC: con «mañana + 1 h» el fin podía cruzar la medianoche de Madrid.
    const dia = await diaDeReparto();
    const turno = await TurnosService.crearTurno({
      fecha: dia,
      horaInicio: `${dia}T12:00:00Z`,
      horaFin: `${dia}T15:00:00Z`,
      capacidadEstimada: 40,
      salida: PASION,
    }, e.pasion, e.meta);
    e.turnos.push(turno.id);

    const alta = await auditoria(ACCIONES_AUDITORIA.TURNO_CREAR, turno.id);
    assert.equal((alta?.detalles as { despues: { capacidadEstimada: number } }).despues.capacidadEstimada, 40);

    await TurnosService.eliminarTurno(turno.id, e.meta);
    const baja = await auditoria(ACCIONES_AUDITORIA.TURNO_ELIMINAR, turno.id);
    assert.equal((baja?.detalles as { antes: { capacidadEstimada: number } }).antes.capacidadEstimada, 40);
  } finally {
    await e.recoger();
  }
});

test('Turnos: crear un turno con horas de otro día o al revés es un 400 con motivo, y no se guarda', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.ADMIN)}`, 'Content-Type': 'application/json' };
    const crear = (cuerpo: Record<string, unknown>) =>
      fetch(`${baseUrl}/api/procesion/admin/turnos`, { method: 'POST', headers: cabeceras, body: JSON.stringify({ capacidadEstimada: 40, salida: PASION, ...cuerpo }) });
    // Contados solo los de ese día, para no depender de lo que hagan otras pruebas a la vez.
    const delDia = { fecha: { gte: new Date('2030-02-14T00:00:00Z'), lt: new Date('2030-02-17T00:00:00Z') } };
    const antes = await db.turno.count({ where: delDia });

    // La hora sobre una fecha ficticia: el turno habría parecido terminado desde 1970.
    const ficticia = await crear({ fecha: '2030-02-15', horaInicio: '1970-01-01T18:00:00Z', horaFin: '1970-01-01T21:00:00Z' });
    assert.equal(ficticia.status, 400);
    assert.match((await ficticia.json() as { error: string }).error, /hora de inicio tiene que ser del mismo día que el turno \(15\/02\/2030\)/);

    // Un reparto de la Pasión después de su próxima salida: la papeleta caería en la que ya pasó.
    const despues = sumarDias(await diaDeReparto(), 2);
    const tardio = await crear({ fecha: despues, horaInicio: `${despues}T12:00:00Z`, horaFin: `${despues}T15:00:00Z` });
    assert.equal(tardio.status, 400);
    assert.match((await tardio.json() as { error: string }).error, /tiene que ser antes de la salida/);
    const sinSalida = await crear({ fecha: '2030-02-15', horaInicio: '2030-02-15T18:00:00+01:00', horaFin: '2030-02-15T21:00:00+01:00', salida: 'no-existe' });
    assert.equal(sinSalida.status, 400, 'una salida que no existe');

    const alDiaSiguiente = await crear({ fecha: '2030-02-15', horaInicio: '2030-02-15T22:00:00+01:00', horaFin: '2030-02-16T00:30:00+01:00' });
    assert.equal(alDiaSiguiente.status, 400);
    assert.match((await alDiaSiguiente.json() as { error: string }).error, /hora de fin tiene que ser del mismo día/);

    const alReves = await crear({ fecha: '2030-02-15', horaInicio: '2030-02-15T21:00:00+01:00', horaFin: '2030-02-15T18:00:00+01:00' });
    assert.equal(alReves.status, 400);
    assert.match((await alReves.json() as { error: string }).error, /posterior a la hora de inicio/);

    assert.equal(await db.turno.count({ where: delDia }), antes, 'ningún turno rechazado debe guardarse');
  } finally {
    await e.recoger();
  }
});

test('Turnos: editar las horas de un turno sigue las mismas reglas que crearlo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const dia = await diaDeReparto();
    const turno = await TurnosService.crearTurno({
      fecha: dia, horaInicio: `${dia}T12:00:00Z`, horaFin: `${dia}T15:00:00Z`, capacidadEstimada: 40, salida: PASION,
    }, e.pasion, e.meta);
    e.turnos.push(turno.id);

    // Un fin anterior al inicio que ya tenía.
    await assert.rejects(
      TurnosService.actualizarTurno(turno.id, { horaFin: new Date(`${dia}T11:00:00Z`) }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 400 && /posterior a la hora de inicio/.test(err.message)
    );
    // Un inicio de otro día.
    await assert.rejects(
      TurnosService.actualizarTurno(turno.id, { horaInicio: new Date(`${sumarDias(dia, -1)}T12:00:00Z`) }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 400 && /hora de inicio tiene que ser del mismo día/.test(err.message)
    );
    const intacto = await db.turno.findUniqueOrThrow({ where: { id: turno.id } });
    assert.equal(intacto.horaFin.toISOString(), `${dia}T15:00:00.000Z`);

    // Y un cambio válido se guarda.
    const ampliado = await TurnosService.actualizarTurno(turno.id, { horaFin: new Date(`${dia}T16:00:00Z`) }, e.meta);
    assert.equal(ampliado.horaFin.toISOString(), `${dia}T16:00:00.000Z`);
  } finally {
    await e.recoger();
  }
});

// ============================================================================
//  S10 · parámetros repetidos en la consulta
// ============================================================================

test('S10: un parámetro repetido en el listado de Tesorería no acaba en 500', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.ADMIN)}` };
    const repetido = await fetch(`${baseUrl}/api/recibos/admin?estado=PENDIENTE&estado=PAGADO`, { headers: cabeceras });
    assert.ok(repetido.status < 500, `respondió ${repetido.status}`);

    const inventado = await fetch(`${baseUrl}/api/recibos/admin?estado=COBRADO`, { headers: cabeceras });
    assert.equal(inventado.status, 400);

    // Y los filtros buenos y la paginación siguen llegando al servicio.
    const bueno = await fetch(`${baseUrl}/api/recibos/admin?year=${YEAR}&estado=PENDIENTE&limit=1`, { headers: cabeceras });
    assert.equal(bueno.status, 200);
    const cuerpo = await bueno.json() as { data: { year: number; estado: string }[]; meta: { limit: number } };
    assert.equal(cuerpo.meta.limit, 1);
    assert.ok(cuerpo.data.every((r) => r.year === YEAR && r.estado === EstadoPago.PENDIENTE));
  } finally {
    await e.recoger();
  }
});

// ============================================================================
//  Tesorería y Contabilidad: cada tipo en su categoría, la comisión del banco
//  y los enlaces entre las dos pantallas
// ============================================================================

const categoriaDe = async (apunte: { categoriaId: number }) =>
  (await db.categoriaTransaccion.findUniqueOrThrow({ where: { id: apunte.categoriaId } })).nombre;

test('cada tipo de recibo se apunta al cobrarse en su propia categoría', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const esperadas = { CUOTA_HERMANO: 'Cuotas de hermanos', DONATIVO: 'Donativos', OTRO: 'Otros recibos' } as const;
    for (const [tipo, categoria] of Object.entries(esperadas) as [keyof typeof esperadas, string][]) {
      const recibo = await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: `Prueba ${tipo}`, importe: 10, tipo }, e.meta);
      await ReciboService.adminMarcarComoPagado(recibo.id, MetodoPago.EFECTIVO, e.meta);
      const [ingreso] = await apuntes(recibo.id);
      assert.equal(await categoriaDe(ingreso), categoria, tipo);
    }

    const { recibo } = await e.apuntarYCobrar(hermano.id);
    const [ingreso] = await apuntes(recibo.id);
    assert.equal(await categoriaDe(ingreso), 'Papeletas de sitio');
  } finally {
    await e.recoger();
  }
});

test('un recibo que el banco devuelve apunta su comisión; uno cobrado, además, el reverso', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    // Remesado y devuelto: nunca entró dinero, solo sale la comisión.
    const remesado = await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: 'Cuota remesada', importe: 30, tipo: 'CUOTA_HERMANO' }, e.meta);
    await enElBanco(remesado.id);
    await ReciboService.adminUpdateDetalles(remesado.id, { estado: 'DEVUELTO', comision: 3.5 }, e.meta);
    const delRemesado = await apuntes(remesado.id);
    assert.deepEqual(delRemesado.map((a) => [a.tipo, String(a.importe)]), [[TipoTransaccion.GASTO, '3.5']]);
    assert.equal(await categoriaDe(delRemesado[0]), 'Comisiones bancarias');

    // Cobrado y devuelto: el reverso del cobro y la comisión.
    const cobrado = await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: 'Donativo devuelto', importe: 20, tipo: 'DONATIVO' }, e.meta);
    await ReciboService.adminMarcarComoPagado(cobrado.id, MetodoPago.TRANSFERENCIA, e.meta);
    await ReciboService.adminUpdateDetalles(cobrado.id, { estado: 'DEVUELTO', comision: 2 }, e.meta);
    const delCobrado = await apuntes(cobrado.id);
    assert.deepEqual(
      await Promise.all(delCobrado.map(async (a) => [a.tipo, String(a.importe), await categoriaDe(a)])),
      [[TipoTransaccion.INGRESO, '20', 'Donativos'], [TipoTransaccion.GASTO, '20', 'Devoluciones de recibos'], [TipoTransaccion.GASTO, '2', 'Comisiones bancarias']],
    );

    const registro = await auditoria(ACCIONES_AUDITORIA.RECIBO_ACTUALIZAR, cobrado.id);
    assert.equal((registro?.detalles as { despues: { comision?: number } }).despues.comision, 2);
  } finally {
    await e.recoger();
  }
});

test('la devolución lleva el día en que la hizo el banco, no el del clic (NG4)', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const cobrado = await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: 'Cuota de diciembre', importe: 20, tipo: 'CUOTA_HERMANO' }, e.meta);
    // Cobrado en diciembre de 2025 (el banco lo cargó entonces).
    await ReciboService.adminMarcarComoPagado(cobrado.id, MetodoPago.TRANSFERENCIA, e.meta, inicioDiaMadrid('2025-12-10'));
    // Un día que no existe o que aún no ha llegado no vale; tampoco sin devolver.
    const manana = sumarDias(diaMadrid(new Date()), 1);
    await assert.rejects(ReciboService.adminUpdateDetalles(cobrado.id, { estado: 'DEVUELTO', fechaDevolucion: manana }, e.meta), (err: unknown) => err instanceof HttpError && err.status === 400);
    await assert.rejects(ReciboService.adminUpdateDetalles(cobrado.id, { estado: 'ANULADO', fechaDevolucion: '2025-12-30' }, e.meta), (err: unknown) => err instanceof HttpError && err.status === 400);
    // NG14: ni anterior al cobro, que dejaría el reverso en un ejercicio sin su ingreso.
    await assert.rejects(
      ReciboService.adminUpdateDetalles(cobrado.id, { estado: 'DEVUELTO', fechaDevolucion: '2024-12-30' }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 400 && /anterior al del cobro/.test(err.message),
    );
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: cobrado.id } })).estado, EstadoPago.PAGADO, 'sigue cobrado');

    await ReciboService.adminUpdateDetalles(cobrado.id, { estado: 'DEVUELTO', comision: 2, fechaDevolucion: '2025-12-30' }, e.meta);
    const gastos = (await apuntes(cobrado.id)).filter((a) => a.tipo === TipoTransaccion.GASTO);
    assert.equal(gastos.length, 2);
    for (const g of gastos) assert.equal(g.fecha.toISOString(), inicioDiaMadrid('2025-12-30').toISOString(), 'el reverso y la comisión, en el ejercicio del banco');
  } finally {
    await e.recoger();
  }
});

test('la comisión solo va con una devolución nueva: ni sin devolver ni dos veces', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const recibo = await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: 'Cuota sin devolver', importe: 30, tipo: 'CUOTA_HERMANO' }, e.meta);
    await assert.rejects(
      ReciboService.adminUpdateDetalles(recibo.id, { estado: 'ANULADO', comision: 3 }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 400,
    );
    await enElBanco(recibo.id);
    await ReciboService.adminUpdateDetalles(recibo.id, { estado: 'DEVUELTO', comision: 3 }, e.meta);
    await assert.rejects(
      ReciboService.adminUpdateDetalles(recibo.id, { estado: 'DEVUELTO', comision: 3 }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 409,
    );
    assert.equal((await apuntes(recibo.id)).length, 1, 'una sola comisión');
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: recibo.id } })).estado, EstadoPago.DEVUELTO);
  } finally {
    await e.recoger();
  }
});

test('por HTTP, Contabilidad filtra los apuntes de un recibo y Tesorería trae ese recibo; el resumen dice lo pendiente', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.ADMIN)}` };
    const cobrado = await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: 'Cuota enlazada', importe: 18, tipo: 'CUOTA_HERMANO' }, e.meta);
    await ReciboService.adminMarcarComoPagado(cobrado.id, MetodoPago.EFECTIVO, e.meta);

    const libro = await (await fetch(`${baseUrl}/api/transacciones/libro-mayor?recibo=${cobrado.id}`, { headers: cabeceras })).json() as { data: { reciboId: number }[] };
    assert.deepEqual(libro.data.map((a) => a.reciboId), [cobrado.id]);

    const tesoreria = await (await fetch(`${baseUrl}/api/recibos/admin?recibo=${cobrado.id}`, { headers: cabeceras })).json() as { data: { id: number }[] };
    assert.deepEqual(tesoreria.data.map((r) => r.id), [cobrado.id]);
    assert.equal((await fetch(`${baseUrl}/api/recibos/admin?recibo=abc`, { headers: cabeceras })).status, 400);

    const antes = await (await fetch(`${baseUrl}/api/transacciones/resumen`, { headers: cabeceras })).json() as { porCobrar: { importe: number; recibos: number } };
    await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: 'Cuota pendiente', importe: 7.25, tipo: 'DONATIVO' }, e.meta);
    const despues = await (await fetch(`${baseUrl}/api/transacciones/resumen`, { headers: cabeceras })).json() as { porCobrar: { importe: number; recibos: number } };
    assert.equal(despues.porCobrar.recibos, antes.porCobrar.recibos + 1);
    assert.equal(Math.round((despues.porCobrar.importe - antes.porCobrar.importe) * 100) / 100, 7.25);
  } finally {
    await e.recoger();
  }
});

test('NG1: un donativo posterior del mismo año no tapa al devuelto; su reemisión explícita, sí', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const anio = new Date().getFullYear() - 1;
    const devuelto = await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: anio, concepto: 'Donativo flores', importe: 40, tipo: 'DONATIVO' }, e.meta);
    await ReciboService.adminMarcarComoPagado(devuelto.id, MetodoPago.EFECTIVO, e.meta);
    await ReciboService.adminUpdateDetalles(devuelto.id, { estado: 'DEVUELTO' }, e.meta);
    const pendientes = async () => (await devueltosPendientes({ hermanoId: hermano.id })).total;
    assert.equal(await pendientes(), 1);

    // Otro donativo del mismo año, que no es su reemisión: antes lo tapaba.
    await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: anio, concepto: 'Donativo cera', importe: 10, tipo: 'DONATIVO' }, e.meta);
    assert.equal(await pendientes(), 1, 'el devuelto se sigue debiendo');

    const reemision = await ReciboService.emitirRecibo(
      { hermanoId: hermano.id, year: anio, concepto: 'Donativo flores (reemisión)', importe: 40, tipo: 'DONATIVO', reemisionDeId: devuelto.id }, e.meta
    );
    assert.equal(reemision.reemisionDeId, devuelto.id);
    assert.equal(await pendientes(), 0);

    // Una segunda reemisión del mismo devuelto cobraría dos veces la deuda.
    await assert.rejects(
      ReciboService.emitirRecibo({ hermanoId: hermano.id, year: anio, concepto: 'Donativo flores (reemisión 2)', importe: 40, tipo: 'DONATIVO', reemisionDeId: devuelto.id }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 409
    );
  } finally {
    await e.recoger();
  }
});

test('R1: con la cuota ya emitida a mano y sin enlazar, «Reemitir» la devuelta la enlaza (el enlace explícito manda)', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    const anio = new Date().getFullYear() - 1;
    const devuelta = await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: anio, concepto: `Cuota anual ${anio}`, importe: 30, tipo: 'CUOTA_HERMANO' }, e.meta);
    await ReciboService.adminMarcarComoPagado(devuelta.id, MetodoPago.EFECTIVO, e.meta);
    await ReciboService.adminUpdateDetalles(devuelta.id, { estado: 'DEVUELTO' }, e.meta);
    // Lo que deja una base de antes del enlace: Tesorería volvió a emitir la
    // cuota con otro concepto, sin «(reemisión)», el hermano la pagó y el
    // relleno de la migración no la reconoce como reemisión.
    await db.recibo.create({ data: { hermanoId: hermano.id, year: anio, concepto: `Cuota ${anio}`, importe: '30', tipo: 'CUOTA_HERMANO', estado: EstadoPago.PAGADO, metodoPago: MetodoPago.EFECTIVO, fechaPago: new Date() } });
    const pendientes = async () => (await devueltosPendientes({ hermanoId: hermano.id })).total;
    assert.equal(await pendientes(), 1, 'la devuelta suelta sale como deuda');

    // Sin enlace, la cuota pagada sigue impidiendo otra.
    await assert.rejects(
      ReciboService.emitirRecibo({ hermanoId: hermano.id, year: anio, concepto: `Cuota ${anio} (bis)`, importe: 30, tipo: 'CUOTA_HERMANO' }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 409 && /ya tiene su cuota/.test(err.message)
    );

    // Con el enlace explícito, se emite y la devuelta deja de deberse; la
    // nueva, que sobra, Tesorería la anula.
    const enlace = await ReciboService.emitirRecibo(
      { hermanoId: hermano.id, year: anio, concepto: `Cuota anual ${anio} (reemisión)`, importe: 30, tipo: 'CUOTA_HERMANO', reemisionDeId: devuelta.id }, e.meta
    );
    assert.equal(enlace.reemisionDeId, devuelta.id);
    assert.equal(await pendientes(), 0);
    await ReciboService.adminUpdateDetalles(enlace.id, { estado: 'ANULADO' }, e.meta);
    assert.equal(await pendientes(), 0, 'anulada la que sobraba, la devuelta sigue saldada');
  } finally {
    await e.recoger();
  }
});

test('NG1: la papeleta de otra salida del mismo año no reemite la devuelta; la de la misma salida, sí', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  // El Rosario cobra como la Pasión mientras dura: así los dos recibos son del mismo tipo.
  const rosario = await salida(ROSARIO);
  await db.salida.update({ where: { id: rosario.id }, data: { cobro: 'CUOTA', importeCuota: 30 } });
  try {
    const hermano = await e.hermano();
    const { recibo } = await e.apuntarYCobrar(hermano.id);
    await ReciboService.adminUpdateDetalles(recibo.id, { estado: 'DEVUELTO' }, e.meta);
    const pendientes = async () => (await devueltosPendientes({ hermanoId: hermano.id })).total;
    assert.equal(await pendientes(), 1);

    const otra = await db.solicitud.create({ data: { hermanoId: hermano.id, salidaId: rosario.id, year: recibo.year, puesto: 'Cirio', origen: 'MESA' } });
    const deOtra = await db.$transaction((tx) => PapeletasService.reciboDeSalidaEnTransaccion(tx, otra, 30, MetodoPago.EFECTIVO));
    assert.equal(deOtra.tipo, recibo.tipo);
    assert.equal(deOtra.reemisionDeId, null);
    assert.equal(await pendientes(), 1, 'la papeleta del Rosario no salda la de la Pasión');

    const deNuevo = await e.apuntarYCobrar(hermano.id);
    assert.equal(deNuevo.recibo.reemisionDeId, recibo.id);
    assert.equal(await pendientes(), 0);
  } finally {
    await db.salida.update({ where: { id: rosario.id }, data: { cobro: rosario.cobro, importeCuota: rosario.importeCuota } });
    await e.recoger();
  }
});

test('una cuota devuelta y reemitida se debe una vez: en impagos, en el panel y en el listado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    // Una cuota del año natural pasado, no del de la mesa.
    const anio = new Date().getFullYear() - 1;
    const devuelta = await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: anio, concepto: 'Cuota devuelta', importe: 30, tipo: 'CUOTA_HERMANO' }, e.meta);
    await enElBanco(devuelta.id);
    await ReciboService.adminUpdateDetalles(devuelta.id, { estado: 'DEVUELTO' }, e.meta);

    const deudaDe = async () => (await ReciboService.impagos({ minimo: '1', limit: '100' })).data.find((f) => f.hermano.id === hermano.id);
    assert.deepEqual((await deudaDe())?.cuotas.map((c) => c.estado), [EstadoPago.DEVUELTO], 'sin reemitir, se debe');

    const reemision = await ReciboService.emitirRecibo({ hermanoId: hermano.id, year: anio, concepto: 'Cuota devuelta (reemisión)', importe: 30, tipo: 'CUOTA_HERMANO' }, e.meta);
    const deuda = await deudaDe();
    assert.deepEqual(deuda?.cuotas.map((c) => c.id), [reemision.id], 'reemitida, cuenta solo la nueva');
    assert.equal(deuda?.total, 30);

    const listado = await ReciboService.getAdminRecibos({ q: hermano.apellidos, limit: '50' } as never, anio);
    const fila = listado.data.find((r) => r.id === devuelta.id);
    assert.equal(fila?.reemitido, true);
    // Con la remesa (o sin ella): la web solo ofrece «volver a pendiente» a un REMESADO sin remesa.
    assert.ok(fila && 'remesaId' in fila && fila.remesaId === null);
  } finally {
    await e.recoger();
  }
});
