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
import { EstadoCita, EstadoPago, MetodoPago, Role, TipoRecibo, TipoTransaccion } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { EmailService } from '../src/services/email.service.js';
import { ReciboService } from '../src/services/recibo.service.js';
import { ProcesionService } from '../src/services/procesion.service.js';
import { AUDIT_ACTIONS } from '../src/services/audit.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { diaMadrid, inicioDiaMadrid } from '../src/domain/contabilidad.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;
let server: Server;
let baseUrl: string;

const papeletasEnviadas = mock.method(EmailService, 'enviarPapeleta', async () => undefined);
const recordatoriosEnviados = mock.method(EmailService, 'enviarRecordatorioAusencia', async () => undefined);

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

const YEAR = new Date().getFullYear();

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
      data: { fecha, horaInicio: fecha, horaFin: new Date(fecha.getTime() + 3 * 60 * 60 * 1000), capacidadEstimada: 100 }
    });
    turnos.push(t.id);
    return t;
  };

  const recoger = async () => {
    await db.auditLog.deleteMany({ where: { userId: admin.id } });
    await db.transaccion.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.papeletaSitio.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.cita.deleteMany({ where: { OR: [{ hermanoId: { in: hermanos } }, { turnoId: { in: turnos } }] } });
    await db.recibo.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.turno.deleteMany({ where: { id: { in: turnos } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(admin.id);
  };

  return { admin, usuario, meta, hermano, turno, turnos, recoger };
}

async function auditoria(action: string, entityId: number | string) {
  return db.auditLog.findFirst({ where: { action, entityId: String(entityId) }, orderBy: { id: 'desc' } });
}

async function apuntes(reciboId: number) {
  return db.transaccion.findMany({ where: { reciboId }, orderBy: { id: 'asc' } });
}

/** Deja la configuración como estaba, exista o no la clave antes. */
async function conConfiguracion(valores: Record<string, string>, fn: () => Promise<void>) {
  const previas = await db.configuracion.findMany({ where: { key: { in: Object.keys(valores) } } });
  try {
    await fn();
  } finally {
    for (const key of Object.keys(valores)) {
      const previa = previas.find((p) => p.key === key);
      if (previa) await db.configuracion.update({ where: { key }, data: { value: previa.value } });
      else await db.configuracion.deleteMany({ where: { key } });
    }
  }
}

async function fijarConfiguracion(valores: Record<string, string>) {
  for (const [key, value] of Object.entries(valores)) {
    await db.configuracion.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
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

    const { recibo, papeleta } = await ProcesionService.inscribirYFacturar(
      { hermanoId: hermano.id, metodoPago: MetodoPago.EFECTIVO, puesto: 'Cirio', citaId: cita.id }, e.meta
    );
    assert.equal(recibo.estado, EstadoPago.PAGADO);
    assert.equal(recibo.concepto, `Papeleta Sitio ${YEAR}`);

    const respuesta = await ProcesionService.anularPapeleta(papeleta.id, e.meta);
    assert.equal(respuesta.estadoRecibo, EstadoPago.DEVUELTO);

    // El recibo sigue el grafo: PAGADO -> DEVUELTO, nunca un ANULADO forzado.
    const tras = await db.recibo.findUniqueOrThrow({ where: { id: recibo.id } });
    assert.equal(tras.estado, EstadoPago.DEVUELTO);

    // Y contabilidad cuadra: el ingreso tiene su reverso por el mismo importe.
    const movimientos = await apuntes(recibo.id);
    assert.deepEqual(movimientos.map((m) => [m.tipo, String(m.importe)]), [
      [TipoTransaccion.INGRESO, '30'],
      [TipoTransaccion.GASTO, '30'],
    ]);

    assert.equal(await db.papeletaSitio.findUnique({ where: { id: papeleta.id } }), null, 'la papeleta debe quedar borrada');
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.CANCELADA);

    // Auditoría escrita tras confirmar, con el antes y el después.
    const registro = await auditoria(AUDIT_ACTIONS.PAPELETA_ANULAR, papeleta.id);
    const detalles = registro?.detalles as { antes: { recibo: { estado: string } }; despues: { recibo: { estado: string } } };
    assert.equal(detalles.antes.recibo.estado, EstadoPago.PAGADO);
    assert.equal(detalles.despues.recibo.estado, EstadoPago.DEVUELTO);

    // Reinscribir: antes daba 500 porque el recibo devuelto ocupaba el concepto.
    const segunda = await ProcesionService.inscribirYFacturar(
      { hermanoId: hermano.id, metodoPago: MetodoPago.BIZUM, puesto: 'Vara' }, e.meta
    );
    assert.equal(segunda.recibo.concepto, `Papeleta Sitio ${YEAR} (reemisión 2)`);
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
    const { recibo, papeleta } = await ProcesionService.inscribirYFacturar(
      { hermanoId: hermano.id, metodoPago: MetodoPago.EFECTIVO, puesto: 'Cirio' }, e.meta
    );

    const respuesta = await ReciboService.adminUpdateDetalles(recibo.id, { estado: 'DEVUELTO' }, e.meta);
    assert.equal(respuesta.papeletaAnulada, true);
    assert.equal(await db.papeletaSitio.findUnique({ where: { id: papeleta.id } }), null);
    assert.equal((await apuntes(recibo.id)).filter((m) => m.tipo === TipoTransaccion.GASTO).length, 1, 'un solo reverso');

    const registro = await auditoria(AUDIT_ACTIONS.RECIBO_ACTUALIZAR, recibo.id);
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
    assert.ok(await auditoria(AUDIT_ACTIONS.RECIBO_EMITIR, recibo.id), 'la emisión debe quedar auditada');

    // El mismo concepto el mismo año choca con la clave única: 409 con motivo, no 500.
    await assert.rejects(
      ReciboService.emitirRecibo({ hermanoId: hermano.id, year: YEAR, concepto: 'Donativo de prueba', importe: 5, tipo: 'DONATIVO' }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 409
    );

    await ReciboService.adminUpdateDetalles(recibo.id, { estado: 'REMESADO' }, e.meta);
    const cobrado = await ReciboService.adminMarcarComoPagado(recibo.id, undefined, e.meta);
    assert.equal(cobrado.estado, EstadoPago.PAGADO);
    // Un remesado lo cobra el banco: sin método explícito, domiciliación.
    assert.equal(cobrado.metodoPago, MetodoPago.DOMICILIACION);
    assert.deepEqual((await apuntes(recibo.id)).map((m) => [m.tipo, String(m.importe)]), [[TipoTransaccion.INGRESO, '12.5']]);

    const registro = await auditoria(AUDIT_ACTIONS.RECIBO_COBRAR, recibo.id);
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

test('D4: con precios a 0 la papeleta nace exenta y sin asiento; «12,50» cobra 12,50; «-5» no inscribe', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    await conConfiguracion({ precio_papeleta_sitio: '', precio_alquiler_tunica: '' }, async () => {
      const hermano = await e.hermano({ tieneTunicaPropia: false });

      await fijarConfiguracion({ precio_papeleta_sitio: '0', precio_alquiler_tunica: '0' });
      const gratis = await ProcesionService.inscribirYFacturar({ hermanoId: hermano.id, metodoPago: MetodoPago.EFECTIVO, puesto: 'Cirio' }, e.meta);
      assert.equal(gratis.recibo.estado, EstadoPago.EXENTO);
      assert.equal(String(gratis.recibo.importe), '0');
      assert.equal(gratis.recibo.metodoPago, null);
      assert.deepEqual(await apuntes(gratis.recibo.id), [], 'el dinero que no existe no deja asientos');

      // Anular una papeleta exenta no mueve el recibo (EXENTO es final) ni inventa reversos.
      const anulada = await ProcesionService.anularPapeleta(gratis.papeleta.id, e.meta);
      assert.equal(anulada.estadoRecibo, EstadoPago.EXENTO);
      assert.deepEqual(await apuntes(gratis.recibo.id), []);

      await fijarConfiguracion({ precio_papeleta_sitio: '12,50', precio_alquiler_tunica: '2,5' });
      const conComa = await ProcesionService.inscribirYFacturar({ hermanoId: hermano.id, metodoPago: MetodoPago.EFECTIVO, puesto: 'Cirio' }, e.meta);
      assert.equal(String(conComa.recibo.importe), '15', 'papeleta 12,50 + alquiler 2,50');
      assert.equal(conComa.recibo.estado, EstadoPago.PAGADO);

      await fijarConfiguracion({ precio_papeleta_sitio: '-5' });
      const otro = await e.hermano();
      await assert.rejects(
        ProcesionService.inscribirYFacturar({ hermanoId: otro.id, metodoPago: MetodoPago.EFECTIVO, puesto: 'Cirio' }, e.meta),
        (err: unknown) => err instanceof HttpError && err.status === 409 && /no es un importe válido/.test(err.message)
      );
      assert.equal(await db.recibo.count({ where: { hermanoId: otro.id } }), 0, 'un precio ilegible no cobra nada');
    });
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
    assert.equal(await auditoria(AUDIT_ACTIONS.RECIBO_ACTUALIZAR, recibo.id), null);
  } finally {
    await e.recoger();
  }
});

// ============================================================================
//  D6 · los dos caminos imprimen los mismos datos del evento
// ============================================================================

test('D6: la papeleta de mesa y la de tesorería llevan la misma fecha, hora y puerta', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  // Se restauran clave a clave: reasignar process.env entero lo convierte en un
  // objeto normal y en Windows pierde la insensibilidad a mayúsculas.
  const entornoPrevio = { PROCESION_FECHA: process.env.PROCESION_FECHA, PROCESION_ACCESO: process.env.PROCESION_ACCESO };
  try {
    process.env.PROCESION_FECHA = 'Sábado de Pasión (prueba)';
    process.env.PROCESION_ACCESO = 'Puerta de prueba';
    await conConfiguracion({ procesion_hora: '' }, async () => {
      await fijarConfiguracion({ procesion_hora: '20:15h' });
      papeletasEnviadas.mock.resetCalls();

      // Camino 1: inscripción en mesa.
      const enMesa = await e.hermano();
      await ProcesionService.inscribirYFacturar({ hermanoId: enMesa.id, metodoPago: MetodoPago.EFECTIVO, puesto: 'Cirio' }, e.meta);

      // Camino 2: cobro en tesorería de una papeleta que estaba pendiente.
      const enTesoreria = await e.hermano();
      const recibo = await db.recibo.create({
        data: { hermanoId: enTesoreria.id, year: YEAR, concepto: `Papeleta Sitio ${YEAR}`, importe: 30, tipo: TipoRecibo.PAPELETA_SITIO }
      });
      await db.papeletaSitio.create({ data: { hermanoId: enTesoreria.id, reciboId: recibo.id, year: YEAR, puesto: 'Cirio' } });
      await ReciboService.adminMarcarComoPagado(recibo.id, MetodoPago.EFECTIVO, e.meta);

      const esperado = { fechaSalida: 'Sábado de Pasión (prueba)', horaSalida: '20:15h', accesoPuerta: 'Puerta de prueba' };
      const envios = papeletasEnviadas.mock.calls.map((c) => {
        const datos = c.arguments[2] as { fechaSalida: string; horaSalida: string; accesoPuerta: string };
        return { fechaSalida: datos.fechaSalida, horaSalida: datos.horaSalida, accesoPuerta: datos.accesoPuerta };
      });
      assert.equal(envios.length, 2, 'una papeleta por cada camino');
      assert.deepEqual(envios, [esperado, esperado]);
    });
  } finally {
    for (const [clave, valor] of Object.entries(entornoPrevio)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
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

    const dia = (await ProcesionService.getDiasDisponibles()).find((d) => d.id === turno.id);
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

    const resultados = await Promise.allSettled([
      ProcesionService.avisarAsistencia(e.usuario.id, { turnoId: t1.id, hermanoId: hermano.id }),
      ProcesionService.avisarAsistencia(e.usuario.id, { turnoId: t2.id, hermanoId: hermano.id }),
    ]);
    assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1, 'solo una reserva puede ganar');
    const reservadas = await db.cita.findMany({ where: { hermanoId: hermano.id, estado: EstadoCita.RESERVADA } });
    assert.equal(reservadas.length, 1);

    // La cita es única por [hermano, turno]: cancelar y volver a pedir el mismo día chocaba con la clave.
    await ProcesionService.cancelarAsistencia(e.usuario.id, reservadas[0].id);
    const otraVez = await ProcesionService.avisarAsistencia(e.usuario.id, { turnoId: reservadas[0].turnoId, hermanoId: hermano.id });
    assert.equal(otraVez.id, reservadas[0].id);
    assert.equal(otraVez.estado, EstadoCita.RESERVADA);
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
    const registro = await db.auditLog.findFirst({ where: { action: AUDIT_ACTIONS.AUSENCIAS_PROCESAR, userId: e.admin.id } });
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

    const resultado = await ProcesionService.procesarAusencias(new Date(Date.UTC(2001, 0, 2)), false, e.meta);
    assert.equal(resultado.procesadas, 1);
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.NO_PRESENTADO);
    assert.equal(recordatoriosEnviados.mock.callCount(), 1);

    const registro = await db.auditLog.findFirst({ where: { action: AUDIT_ACTIONS.AUSENCIAS_PROCESAR, userId: e.admin.id } });
    const detalles = registro?.detalles as { citasAfectadas: number; citaIds: number[]; estadoNuevo: string };
    assert.equal(detalles.citasAfectadas, 1);
    assert.deepEqual(detalles.citaIds, [cita.id]);
    assert.equal(detalles.estadoNuevo, EstadoCita.NO_PRESENTADO);

    // El servicio tampoco acepta una fecha futura aunque se le llame sin pasar por el esquema.
    await assert.rejects(ProcesionService.procesarAusencias(new Date(Date.now() + 60_000), false, e.meta), HttpError);
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
        capacidadEstimada: 50
      }
    });
    e.turnos.push(turno.id);
    const cita = await db.cita.create({ data: { hermanoId: hermano.id, turnoId: turno.id } });
    recordatoriosEnviados.mock.resetCalls();

    // Antes se comparaba `turno.fecha` (medianoche, ya pasada) y esta cita
    // quedaba NO_PRESENTADO con su correo de «no viniste» por la mañana.
    const resultado = await ProcesionService.procesarAusencias(new Date(), false, e.meta);
    assert.equal(resultado.procesadas, 0);
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.RESERVADA);
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
    await ReciboService.adminUpdateDetalles(primera.id, { estado: 'REMESADO' }, e.meta);
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

test('D2: un recibo «papeleta sitio AAAA» en minúsculas no impide inscribir: la papeleta sale como reemisión', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const hermano = await e.hermano();
    // La clave única de MariaDB no distingue mayúsculas: este ocupa «Papeleta Sitio AAAA».
    await ReciboService.emitirRecibo(
      { hermanoId: hermano.id, year: YEAR, concepto: `papeleta sitio ${YEAR}`, importe: 5, tipo: 'OTRO' }, e.meta
    );

    const { recibo } = await ProcesionService.inscribirYFacturar(
      { hermanoId: hermano.id, metodoPago: MetodoPago.EFECTIVO, puesto: 'Cirio' }, e.meta
    );
    assert.equal(recibo.concepto, `Papeleta Sitio ${YEAR} (reemisión 2)`);
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
      Array.from({ length: 6 }, () => ReciboService.idCategoriaDeRecibos(TipoTransaccion.GASTO, nombre))
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
    // Un día fijo y lejano: con «mañana + 1 h» el fin podía cruzar la medianoche de Madrid.
    const turno = await ProcesionService.crearTurno({
      fecha: '2030-05-10',
      horaInicio: '2030-05-10T18:00:00+02:00',
      horaFin: '2030-05-10T21:00:00+02:00',
      capacidadEstimada: 40
    }, e.meta);
    e.turnos.push(turno.id);

    const alta = await auditoria(AUDIT_ACTIONS.TURNO_CREAR, turno.id);
    assert.equal((alta?.detalles as { despues: { capacidadEstimada: number } }).despues.capacidadEstimada, 40);

    await ProcesionService.eliminarTurno(turno.id, e.meta);
    const baja = await auditoria(AUDIT_ACTIONS.TURNO_ELIMINAR, turno.id);
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
      fetch(`${baseUrl}/api/procesion/admin/turnos`, { method: 'POST', headers: cabeceras, body: JSON.stringify({ capacidadEstimada: 40, ...cuerpo }) });
    // Contados solo los de ese día, para no depender de lo que hagan otras pruebas a la vez.
    const delDia = { fecha: { gte: new Date('2030-05-09T00:00:00Z'), lt: new Date('2030-05-12T00:00:00Z') } };
    const antes = await db.turno.count({ where: delDia });

    // La hora sobre una fecha ficticia: el turno habría parecido terminado desde 1970.
    const ficticia = await crear({ fecha: '2030-05-10', horaInicio: '1970-01-01T18:00:00Z', horaFin: '1970-01-01T21:00:00Z' });
    assert.equal(ficticia.status, 400);
    assert.match((await ficticia.json() as { error: string }).error, /hora de inicio tiene que ser del mismo día que el turno \(10\/05\/2030\)/);

    const alDiaSiguiente = await crear({ fecha: '2030-05-10', horaInicio: '2030-05-10T22:00:00+02:00', horaFin: '2030-05-11T00:30:00+02:00' });
    assert.equal(alDiaSiguiente.status, 400);
    assert.match((await alDiaSiguiente.json() as { error: string }).error, /hora de fin tiene que ser del mismo día/);

    const alReves = await crear({ fecha: '2030-05-10', horaInicio: '2030-05-10T21:00:00+02:00', horaFin: '2030-05-10T18:00:00+02:00' });
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
    const turno = await ProcesionService.crearTurno({
      fecha: '2030-05-10', horaInicio: '2030-05-10T18:00:00+02:00', horaFin: '2030-05-10T21:00:00+02:00', capacidadEstimada: 40
    }, e.meta);
    e.turnos.push(turno.id);

    // Un fin anterior al inicio que ya tenía.
    await assert.rejects(
      ProcesionService.actualizarTurno(turno.id, { horaFin: new Date('2030-05-10T17:00:00+02:00') }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 400 && /posterior a la hora de inicio/.test(err.message)
    );
    // Un inicio de otro día.
    await assert.rejects(
      ProcesionService.actualizarTurno(turno.id, { horaInicio: new Date('2030-05-09T18:00:00+02:00') }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 400 && /hora de inicio tiene que ser del mismo día/.test(err.message)
    );
    const intacto = await db.turno.findUniqueOrThrow({ where: { id: turno.id } });
    assert.equal(intacto.horaFin.toISOString(), '2030-05-10T19:00:00.000Z');

    // Y un cambio válido se guarda.
    const ampliado = await ProcesionService.actualizarTurno(turno.id, { horaFin: new Date('2030-05-10T22:00:00+02:00') }, e.meta);
    assert.equal(ampliado.horaFin.toISOString(), '2030-05-10T20:00:00.000Z');
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
