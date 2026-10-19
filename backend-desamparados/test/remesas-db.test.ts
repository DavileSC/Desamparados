// Remesas SEPA contra MariaDB: qué recibos entran, que generar sea todo o nada,
// que la remesa se pueda descargar y dar por cobrada (con sus asientos, sin
// tocar los devueltos) y que las rutas estén cerradas sin sesión del CMS.
//
// Cada prueba siembra sus fichas en un año que nadie usa (2097) para no
// arrastrar recibos pendientes de la base de desarrollo, y las recoge al
// terminar. El correo va simulado: el aviso del cargo a cada cuenta, a una
// lista.

import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoPago, EstadoRemesa, MetodoPago, Role, TipoRecibo } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { EmailService } from '../src/services/email.service.js';
import { RemesaService } from '../src/services/remesa.service.js';
import { ReciboService } from '../src/services/recibo.service.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { diaDeHoy } from '../src/domain/fechas-hermano.js';
import { fechaCobroMinima } from '../src/domain/sepa.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { extracto } from './fixtures/norma43.js';
import { Norma43Service } from '../src/services/norma43.service.js';
import { inicioDiaMadrid } from '../src/domain/contabilidad.js';
import { SIN_DB } from './fixtures/sin-db.js';
import { ponerTransporte, type TransporteDeCorreo } from '../src/services/correos/envio.js';
import { despertarCola } from '../src/services/correos/cola.js';

const YEAR = 2097;
const IBAN_VALIDO = 'ES9121000418450200051332';
const ACREEDOR = {
  SEPA_ACREEDOR_NOMBRE: 'Grupo Parroquial de Prueba',
  SEPA_ACREEDOR_ID: 'ES26000G12345678',
  SEPA_ACREEDOR_IBAN: 'ES7921000813610123456789',
};

let dbDisponible = false;
let server: Server;
let baseUrl: string;
const entornoPrevio = Object.fromEntries(Object.keys(ACREEDOR).map((k) => [k, process.env[k]]));

mock.method(EmailService, 'enviarPapeleta', async () => undefined);
const enviados: Parameters<TransporteDeCorreo['sendMail']>[0][] = [];

before(async () => {
  Object.assign(process.env, ACREEDOR);
  ponerTransporte({ sendMail: async (c) => { enviados.push(c); return {}; } });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  for (const [k, v] of Object.entries(entornoPrevio)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  mock.restoreAll();
  ponerTransporte(undefined);
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

async function escenario() {
  const admin = await crearUsuarioPrueba(Role.TESORERIA);
  const usuario = await crearUsuarioPrueba(Role.USER);
  const meta = { userId: admin.id };
  const hermanos: number[] = [];

  const hermano = async (datos: { forma?: MetodoPago; iban?: string | null; activo?: boolean } = {}) => {
    const h = await db.hermano.create({
      data: {
        userId: usuario.id,
        nombre: 'Prueba',
        apellidos: `Remesa ${Date.now()}${hermanos.length}`,
        fechaNacimiento: new Date(Date.UTC(1990, 0, 1)),
        activo: datos.activo ?? true,
        formaPagoPref: datos.forma ?? MetodoPago.DOMICILIACION,
        iban: datos.iban === undefined ? IBAN_VALIDO : datos.iban,
      },
    });
    hermanos.push(h.id);
    return h;
  };

  const recibo = (hermanoId: number, importe = '30.00', tipo: TipoRecibo = TipoRecibo.CUOTA_HERMANO) =>
    db.recibo.create({ data: { hermanoId, year: YEAR, concepto: `Cuota ${YEAR}`, importe, tipo } });

  const recoger = async () => {
    const remesas = await db.recibo.findMany({ where: { hermanoId: { in: hermanos }, remesaId: { not: null } }, select: { remesaId: true } });
    await db.auditLog.deleteMany({ where: { userId: admin.id } });
    await db.transaccion.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.recibo.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.correoEnCola.deleteMany({ where: { lote: { in: remesas.map((r) => `remesa:${r.remesaId}`) } } });
    await db.remesa.deleteMany({ where: { id: { in: remesas.map((r) => r.remesaId!) } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(admin.id);
  };

  return { admin, usuario, meta, hermano, recibo, recoger };
}

const fechaCobro = () => fechaCobroMinima(diaDeHoy());

test('la vista previa separa lo que va al banco de lo que no, y no cuenta a quien paga en mano', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const bien = await e.hermano();
    const malaCuenta = await e.hermano({ iban: 'ES0000000000000000000000' });
    const enMano = await e.hermano({ forma: MetodoPago.EFECTIVO, iban: null });
    await e.recibo(bien.id, '30.00');
    const r2 = await e.recibo(malaCuenta.id);
    await e.recibo(enMano.id);

    const previa = await RemesaService.previa({ fechaCobro: fechaCobro(), year: YEAR });
    assert.equal(previa.numRecibos, 1);
    assert.equal(previa.total, 30);
    assert.deepEqual(previa.excluidos.map((x) => [x.reciboId, x.motivo]), [[r2.id, 'IBAN_NO_VALIDO']]);
  } finally {
    await e.recoger();
  }
});

test('generar apunta la remesa, remesa sus recibos y deja el fichero; la segunda vez no hay nada', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const a = await e.hermano();
    const b = await e.hermano();
    const ra = await e.recibo(a.id, '30.00');
    const rb = await e.recibo(b.id, '12.50', TipoRecibo.DONATIVO);

    // Solo las cuotas: el donativo se queda para otra remesa.
    const remesa = await RemesaService.generar({ fechaCobro: fechaCobro(), year: YEAR, tipo: TipoRecibo.CUOTA_HERMANO }, e.meta);
    assert.equal(remesa.numRecibos, 1);
    assert.equal(remesa.total, 30);
    assert.equal(remesa.estado, EstadoRemesa.ENVIADA);
    assert.match(remesa.mensajeId, new RegExp(`^REMESA-${String(remesa.id).padStart(6, '0')}-\\d{8}$`));
    assert.equal(remesa.autorNombre, 'Prueba Automatica');

    const tras = await db.recibo.findUniqueOrThrow({ where: { id: ra.id } });
    assert.equal(tras.estado, EstadoPago.REMESADO);
    assert.equal(tras.metodoPago, MetodoPago.DOMICILIACION);
    assert.equal(tras.remesaId, remesa.id);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: rb.id } })).estado, EstadoPago.PENDIENTE);

    const { xml, nombre } = await RemesaService.fichero(remesa.id);
    assert.equal(nombre, `${remesa.mensajeId.toLowerCase()}.xml`);
    assert.ok(xml.includes(`<EndToEndId>REC-${ra.id}</EndToEndId>`));
    assert.ok(!xml.includes(`REC-${rb.id}<`));
    assert.ok(xml.includes(`<MsgId>${remesa.mensajeId}</MsgId>`));

    const rastro = await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.REMESA_GENERAR, entityId: String(remesa.id) } });
    assert.ok(rastro);

    await assert.rejects(
      RemesaService.generar({ fechaCobro: fechaCobro(), year: YEAR, tipo: TipoRecibo.CUOTA_HERMANO }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 409,
    );
  } finally {
    await e.recoger();
  }
});

test('sin los datos del acreedor, o con una fecha sin margen, no se genera nada', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const a = await e.hermano();
    const r = await e.recibo(a.id);

    await assert.rejects(
      RemesaService.generar({ fechaCobro: diaDeHoy(), year: YEAR }, e.meta),
      (err: unknown) => err instanceof HttpError && err.status === 400 && /margen/.test(err.message),
    );

    const id = process.env.SEPA_ACREEDOR_ID;
    delete process.env.SEPA_ACREEDOR_ID;
    try {
      await assert.rejects(
        RemesaService.generar({ fechaCobro: fechaCobro(), year: YEAR }, e.meta),
        (err: unknown) => err instanceof HttpError && err.status === 409 && /SEPA_ACREEDOR_ID/.test(err.message),
      );
      const estado = await RemesaService.estado();
      assert.equal(estado.configurada, false);
    } finally {
      process.env.SEPA_ACREEDOR_ID = id;
    }
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: r.id } })).estado, EstadoPago.PENDIENTE);
  } finally {
    await e.recoger();
  }
});

test('darla por cobrada cobra lo que sigue en el banco, con su asiento, y deja los devueltos', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const a = await e.hermano();
    const b = await e.hermano();
    const ra = await e.recibo(a.id, '30.00');
    const rb = await e.recibo(b.id, '30.00');
    const remesa = await RemesaService.generar({ fechaCobro: fechaCobro(), year: YEAR }, e.meta);

    // Antes del día de cobro, no.
    await assert.rejects(RemesaService.darPorCobrada(remesa.id, e.meta), (err: unknown) => err instanceof HttpError && err.status === 409);

    // El banco devolvió uno y ya pasó el día de cobro.
    await db.recibo.update({ where: { id: rb.id }, data: { estado: EstadoPago.DEVUELTO } });
    await db.remesa.update({ where: { id: remesa.id }, data: { fechaCobro: new Date('2020-01-02T00:00:00Z') } });

    const resultado = await RemesaService.darPorCobrada(remesa.id, e.meta);
    assert.equal(resultado.cobrados, 1);
    assert.equal(resultado.devueltos, 1);

    const cobrado = await db.recibo.findUniqueOrThrow({ where: { id: ra.id } });
    assert.equal(cobrado.estado, EstadoPago.PAGADO);
    assert.equal(cobrado.metodoPago, MetodoPago.DOMICILIACION);
    const asientos = await db.transaccion.findMany({ where: { reciboId: ra.id } });
    assert.equal(asientos.length, 1);
    assert.equal(Number(asientos[0].importe), 30);
    // El dinero entró el día del cargo, no el del clic: ahí va el asiento.
    assert.equal(cobrado.fechaPago?.toISOString(), inicioDiaMadrid('2020-01-02').toISOString());
    assert.equal(asientos[0].fecha.toISOString(), inicioDiaMadrid('2020-01-02').toISOString());
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: rb.id } })).estado, EstadoPago.DEVUELTO);
    assert.equal((await db.remesa.findUniqueOrThrow({ where: { id: remesa.id } })).estado, EstadoRemesa.COBRADA);

    await assert.rejects(RemesaService.darPorCobrada(remesa.id, e.meta), (err: unknown) => err instanceof HttpError && err.status === 409);
  } finally {
    await e.recoger();
  }
});

test('las rutas de remesas piden sesión del CMS, y el fichero sale como XML descargable', async (t) => {
  for (const [metodo, ruta] of [['GET', '/api/recibos/admin/remesas'], ['POST', '/api/recibos/admin/remesas'], ['GET', '/api/recibos/admin/remesas/1/fichero'], ['POST', '/api/recibos/admin/remesas/1/cobrar']] as const) {
    const res = await fetch(`${baseUrl}${ruta}`, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: metodo === 'POST' ? '{}' : undefined });
    assert.equal(res.status, 401, `${metodo} ${ruta}`);
  }
  if (!dbDisponible) { t.skip(SIN_DB); return; }

  const e = await escenario();
  try {
    const a = await e.hermano();
    await e.recibo(a.id);
    const cookie = { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.TESORERIA)}`, 'Content-Type': 'application/json' };

    const creada = await fetch(`${baseUrl}/api/recibos/admin/remesas`, { method: 'POST', headers: cookie, body: JSON.stringify({ fechaCobro: fechaCobro(), year: YEAR }) });
    assert.equal(creada.status, 201);
    const remesa = await creada.json() as { id: number; mensajeId: string };

    const fichero = await fetch(`${baseUrl}/api/recibos/admin/remesas/${remesa.id}/fichero`, { headers: cookie });
    assert.equal(fichero.status, 200);
    assert.match(fichero.headers.get('content-type') ?? '', /application\/xml/);
    assert.match(fichero.headers.get('content-disposition') ?? '', new RegExp(`${remesa.mensajeId.toLowerCase()}\\.xml`));
    assert.ok((await fichero.text()).startsWith('<?xml'));

    const mal = await fetch(`${baseUrl}/api/recibos/admin/remesas/previa`, { method: 'POST', headers: cookie, body: JSON.stringify({ fechaCobro: 'mañana' }) });
    assert.equal(mal.status, 400);
  } finally {
    await e.recoger();
  }
});

test('el extracto Norma 43 devuelve lo que el banco devolvió y cobra la remesa, y la segunda vez no hace nada', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const a = await e.hermano();
    const b = await e.hermano();
    const ra = await e.recibo(a.id, '30.00');
    const rb = await e.recibo(b.id, '12.50');
    const remesa = await RemesaService.generar({ fechaCobro: fechaCobro(), year: YEAR }, e.meta);
    // El banco ya cargó los adeudos: la remesa es del 1 de septiembre de 2026.
    await db.remesa.update({ where: { id: remesa.id }, data: { fechaCobro: new Date('2026-09-01T00:00:00Z') } });

    const fichero = extracto([
      // El abono llega con fecha valor del día 2: manda sobre la fecha de cobro pedida.
      { fecha: '260902', signo: 2, centimos: 4250, conceptos: ['ABONO ADEUDOS SEPA', remesa.mensajeId] },
      { fecha: '260908', signo: 1, centimos: 1250, conceptos: [`DEVOLUCION REC-${rb.id}`, 'AM04 SALDO INSUFICIENTE'] },
      { fecha: '260910', signo: 1, centimos: 5000, conceptos: ['RECIBO LUZ'] },
    ]);

    const previa = await Norma43Service.previa(fichero);
    assert.deepEqual(previa.errores, []);
    assert.deepEqual(previa.devoluciones.map((d) => [d.reciboId, d.yaAplicado]), [[rb.id, false]]);
    assert.deepEqual(previa.cobros.map((c) => [c.remesaId, c.yaAplicado]), [[remesa.id, false]]);
    assert.equal(previa.ajenos, 1);
    // La vista previa no toca nada.
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: rb.id } })).estado, EstadoPago.REMESADO);

    const aplicado = await Norma43Service.aplicar(fichero, e.meta);
    assert.deepEqual(aplicado.omitidos, []);
    assert.equal(aplicado.devueltos, 1);
    assert.equal(aplicado.cobradas, 1);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: rb.id } })).estado, EstadoPago.DEVUELTO);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: ra.id } })).estado, EstadoPago.PAGADO);
    assert.equal((await db.remesa.findUniqueOrThrow({ where: { id: remesa.id } })).estado, EstadoRemesa.COBRADA);
    // Solo el cobrado lleva asiento; el devuelto nunca llegó a entrar.
    assert.equal(await db.transaccion.count({ where: { reciboId: rb.id } }), 0);
    assert.equal(await db.transaccion.count({ where: { reciboId: ra.id } }), 1);
    const asiento = await db.transaccion.findFirstOrThrow({ where: { reciboId: ra.id } });
    assert.equal(asiento.fecha.toISOString(), inicioDiaMadrid('2026-09-02').toISOString(), 'con la fecha valor del extracto');

    const otraVez = await Norma43Service.aplicar(fichero, e.meta);
    assert.deepEqual([otraVez.devueltos, otraVez.cobradas], [0, 0]);
    assert.equal(await db.transaccion.count({ where: { reciboId: ra.id } }), 1);

    await assert.rejects(Norma43Service.aplicar('esto no es un extracto', e.meta), (err: unknown) => err instanceof HttpError && err.status === 400);
  } finally {
    await e.recoger();
  }
});

test('NG3 y NG7: con un recibo anulado después de generar la remesa, ni su devolución ni el abono se aplican solos', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const a = await e.hermano();
    const b = await e.hermano();
    const ra = await e.recibo(a.id, '30.00');
    const rb = await e.recibo(b.id, '12.50');
    const remesa = await RemesaService.generar({ fechaCobro: fechaCobro(), year: YEAR }, e.meta);
    await db.remesa.update({ where: { id: remesa.id }, data: { fechaCobro: new Date('2026-09-01T00:00:00Z') } });
    // Ya en el banco, Tesorería anula uno; el banco lo cobra igual y luego se devuelve.
    await ReciboService.adminUpdateDetalles(rb.id, { estado: 'ANULADO' }, e.meta);

    const fichero = extracto([
      { fecha: '260902', signo: 2, centimos: 4250, conceptos: ['ABONO ADEUDOS SEPA', remesa.mensajeId] },
      { fecha: '260908', signo: 1, centimos: 1250, conceptos: [`DEVOLUCION REC-${rb.id}`, `HERMANO-${String(b.id).padStart(6, '0')}-20260901`] },
    ]);
    const previa = await Norma43Service.previa(fichero);
    assert.deepEqual(previa.cobros, []);
    assert.deepEqual(previa.devoluciones, []);
    assert.equal(previa.dudosos.length, 2);
    assert.match(previa.dudosos[0].motivo, /diferencia: 12,50 €/);
    assert.match(previa.dudosos[1].motivo, new RegExp(`recibo ${rb.id}, que está ANULADO`));

    const aplicado = await Norma43Service.aplicar(fichero, e.meta);
    assert.deepEqual([aplicado.devueltos, aplicado.cobradas], [0, 0]);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: ra.id } })).estado, EstadoPago.REMESADO, 'se da por cobrada a mano');
  } finally {
    await e.recoger();
  }
});

test('las rutas del extracto piden sesión y leen el fichero subido', async (t) => {
  for (const ruta of ['/api/recibos/admin/remesas/norma43/previa', '/api/recibos/admin/remesas/norma43/aplicar']) {
    assert.equal((await fetch(`${baseUrl}${ruta}`, { method: 'POST' })).status, 401, ruta);
  }
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const cookie = { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.TESORERIA)}` };
    const formulario = new FormData();
    formulario.append('fichero', new Blob([extracto([{ fecha: '261002', signo: 2, centimos: 100 }])]), 'extracto.n43');
    const res = await fetch(`${baseUrl}/api/recibos/admin/remesas/norma43/previa`, { method: 'POST', headers: cookie, body: formulario });
    assert.equal(res.status, 200);
    const cuerpo = await res.json() as { cuentas: { cuenta: string }[]; ajenos: number };
    assert.deepEqual(cuerpo.cuentas.map((c) => c.cuenta), ['••••0513']);
    assert.equal(cuerpo.ajenos, 1);

    const sinFichero = await fetch(`${baseUrl}/api/recibos/admin/remesas/norma43/previa`, { method: 'POST', headers: cookie });
    assert.equal(sinFichero.status, 400);
  } finally {
    await e.recoger();
  }
});

test('al generar, cada cuenta recibe por correo un aviso del cargo con todos sus recibos', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    // Dos fichas de la misma cuenta: un solo aviso, con los dos recibos.
    const a = await e.hermano();
    const b = await e.hermano();
    await e.recibo(a.id, '30.00');
    await e.recibo(b.id, '12.50');

    const remesa = await RemesaService.generar({ fechaCobro: fechaCobro(), year: YEAR }, e.meta);
    assert.equal(remesa.avisados, 1);
    const enCola = await db.correoEnCola.findMany({ where: { lote: `remesa:${remesa.id}` } });
    assert.equal(enCola.length, 1);
    assert.equal(enCola[0].porMovil, false, 'el aviso que pide la norma va por correo, tenga o no el móvil');

    await despertarCola();
    const aviso = enviados.find((c) => c.to === e.usuario.email && /^Aviso de cargo en su cuenta: 42,50 €/.test(c.subject));
    assert.ok(aviso, 'sale el aviso con el total de la cuenta');
    assert.ok(aviso.html.includes(ACREEDOR.SEPA_ACREEDOR_ID), 'con el identificador del acreedor');
    assert.match(aviso.html, /mandato HERMANO-\d{6}-\d{8}/);
    assert.ok(!aviso.html.includes(IBAN_VALIDO), 'la cuenta va tapada');
    assert.ok(aviso.html.includes('1332'), 'con sus cuatro últimas cifras');
  } finally {
    await e.recoger();
  }
});
