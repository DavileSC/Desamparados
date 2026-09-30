// Remesas SEPA contra MariaDB: qué recibos entran, que generar sea todo o nada,
// que la remesa se pueda descargar y dar por cobrada (con sus asientos, sin
// tocar los devueltos) y que las rutas estén cerradas sin sesión del CMS.
//
// Cada prueba siembra sus fichas en un año que nadie usa (2097) para no
// arrastrar recibos pendientes de la base de desarrollo, y las recoge al
// terminar. El correo va simulado.

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
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { diaDeHoy } from '../src/domain/fechas-hermano.js';
import { fechaCobroMinima } from '../src/domain/sepa.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
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

before(async () => {
  Object.assign(process.env, ACREEDOR);
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
    await db.remesa.deleteMany({ where: { id: { in: remesas.map((r) => r.remesaId!) } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(admin.id);
  };

  return { admin, meta, hermano, recibo, recoger };
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
