// La mesa de la procesión por zonas contra MariaDB: Inscripción apunta la
// solicitud (sin papeleta ni recibo), Tesorería cobra o perdona (una sola vez
// aunque se repita la petición), y en Túnicas, con todo al día, se presta la
// ropa y nace la papeleta. El Rosario va aparte, con su donativo y sin ropa.
// También el alta en el momento, las correcciones y el canal en vivo.
// Cada prueba siembra lo suyo y lo recoge al terminar.

import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoCita, EstadoPago, EstadoPrenda, MetodoPago, Prisma, Role, TipoPrenda, TipoRecibo, TipoTransaccion } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { EmailService } from '../src/services/email.service.js';
import { PapeletasService } from '../src/services/procesion/papeletas.service.js';
import { MesaService } from '../src/services/procesion/mesa.service.js';
import { PlazoPapeletasService } from '../src/services/procesion/plazo.service.js';
import { anioDeLaMesa, ZonasService, type EntregaEnMesa, type InscripcionEnMesa } from '../src/services/procesion/zonas.service.js';
import { idDeSalida, PASION, ROSARIO, salida } from './fixtures/salidas.js';
import { HttpError } from '../src/utils/error.handle.js';
import { InventarioService } from '../src/services/inventario.service.js';
import { ReciboService } from '../src/services/recibo.service.js';
import { CLAVE_CINGULOS, recuentoDeCingulos } from '../src/services/procesion/cingulos.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;
let server: Server;
let baseUrl: string;

mock.method(EmailService, 'enviarPapeleta', async () => undefined);

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

// Números de prenda que no chocan con los del ropero de desarrollo.
let serie = 0;
const numeroDePrueba = (prefijo = '') => `${prefijo}P${process.pid}${Date.now() % 100000}${(serie += 1)}`;

/** Un escenario desechable: quien firma, una cuenta con sus fichas, prendas y la cuota de salida a 0 €. */
async function escenario() {
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  const usuario = await crearUsuarioPrueba(Role.USER);
  const meta = { userId: admin.id };
  const hermanos: number[] = [];
  const usuariosExtra: number[] = [];
  const prendas: number[] = [];
  const turnos: number[] = [];
  const claves: string[] = [];
  // La cuota de la Pasión, a 0 € mientras duran; se devuelve al recoger.
  const cuotaSalida = (await salida(PASION)).importeCuota;
  await db.salida.update({ where: { slug: PASION }, data: { importeCuota: 0 } });
  const totalCingulos = await db.configuracion.findUnique({ where: { key: CLAVE_CINGULOS } });
  /** Deja en el ropero `n` cíngulos libres, cuente lo que cuente la base de desarrollo. */
  const cingulosLibres = async (n: number) => {
    const { prestados } = await recuentoDeCingulos();
    await db.configuracion.upsert({ where: { key: CLAVE_CINGULOS }, update: { value: String(prestados + n) }, create: { key: CLAVE_CINGULOS, value: String(prestados + n) } });
  };

  const hermano = async (extra: { nombre?: string; tieneTunicaPropia?: boolean; userId?: number } = {}) => {
    const h = await db.hermano.create({
      data: {
        userId: extra.userId ?? usuario.id, nombre: extra.nombre ?? 'Mesa', apellidos: `Prueba ${Date.now()}${hermanos.length}`,
        fechaNacimiento: new Date(Date.UTC(1990, 0, 1)), activo: true, tieneTunicaPropia: extra.tieneTunicaPropia ?? false,
      },
    });
    hermanos.push(h.id);
    return h;
  };

  const cuota = (hermanoId: number, year: number, estado: EstadoPago = EstadoPago.PENDIENTE, importe = 20) =>
    db.recibo.create({ data: { hermanoId, year, concepto: `Cuota ${year}`, importe: new Prisma.Decimal(importe), tipo: TipoRecibo.CUOTA_HERMANO, estado } });

  const prenda = async (tipo: TipoPrenda, numero = numeroDePrueba(), extra: { estado?: EstadoPrenda; hermanoId?: number } = {}) => {
    const p = await db.prenda.create({ data: { tipo, numero, estado: extra.estado ?? EstadoPrenda.DISPONIBLE, hermanoId: extra.hermanoId } });
    prendas.push(p.id);
    return p;
  };

  const clave = () => { const c = randomUUID(); claves.push(c); return c; };

  const recoger = async () => {
    const todos = [...hermanos, ...(await db.hermano.findMany({ where: { userId: { in: usuariosExtra } }, select: { id: true } })).map((h) => h.id)];
    await db.auditLog.deleteMany({ where: { userId: admin.id } });
    await db.operacionMesa.deleteMany({ where: { clave: { in: claves } } });
    await db.solicitud.deleteMany({ where: { hermanoId: { in: todos } } });
    await db.transaccion.deleteMany({ where: { hermanoId: { in: todos } } });
    await db.papeletaSitio.deleteMany({ where: { hermanoId: { in: todos } } });
    await db.cita.deleteMany({ where: { OR: [{ hermanoId: { in: todos } }, { turnoId: { in: turnos } }] } });
    await db.recibo.deleteMany({ where: { hermanoId: { in: todos } } });
    await db.turno.deleteMany({ where: { id: { in: turnos } } });
    await db.prenda.deleteMany({ where: { OR: [{ id: { in: prendas } }, { hermanoId: { in: todos } }] } });
    await db.hermano.deleteMany({ where: { id: { in: todos } } });
    for (const id of usuariosExtra) await borrarUsuarioPrueba(id);
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(admin.id);
    await db.salida.update({ where: { slug: PASION }, data: { importeCuota: cuotaSalida } });
    if (totalCingulos) await db.configuracion.update({ where: { key: CLAVE_CINGULOS }, data: { value: totalCingulos.value } });
    else await db.configuracion.deleteMany({ where: { key: CLAVE_CINGULOS } });
  };

  /** Apunta en la mesa; la salida, por su slug (la Pasión si no se dice). */
  const inscribir = async (hermanoId: number, extra: Partial<Omit<InscripcionEnMesa, 'salida'>> & { salida?: string } = {}) => {
    const { salida: slug = PASION, ...resto } = extra;
    return ZonasService.inscribir({ hermanoId, puesto: 'Nazareno', ...resto, salida: await salida(slug) }, clave(), meta);
  };
  const entregar = (solicitudId: number, extra: Partial<EntregaEnMesa> = {}) =>
    ZonasService.entregar({ solicitudId, origenTunica: 'PROPIA', ...extra }, clave(), meta);

  return { admin, usuario, meta, hermano, cuota, prenda, prendas, turnos, hermanos, usuariosExtra, clave, inscribir, entregar, recoger, cingulosLibres };
}

const esHttp = (status: number, patron?: RegExp) => (err: unknown) =>
  err instanceof HttpError && err.status === status && (!patron || patron.test(err.message));

test('inscribir crea la solicitud, sin papeleta ni recibo; sin nada que pagar va directa a Túnicas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const r = await e.inscribir(h.id, { alturaHombro: '1,54', puesto: 'Trono' });
    assert.equal(r.requisitos.puedeRecoger, true);
    const s = await db.solicitud.findUniqueOrThrow({ where: { id: r.solicitudId } });
    assert.equal(s.estado, 'PENDIENTE');
    assert.equal(s.origen, 'MESA');
    assert.equal(s.puesto, 'Trono');
    assert.equal(await db.papeletaSitio.count({ where: { hermanoId: h.id } }), 0, 'la papeleta nace al recoger');
    assert.equal(await db.recibo.count({ where: { hermanoId: h.id } }), 0, 'ni recibo');
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: h.id } })).alturaHombro, 154);

    // Ya apuntado: no sale en el buscador de Inscripción, sí en el de Túnicas.
    assert.equal((await MesaService.buscarPersonas(h.apellidos, await salida(PASION), { zona: 'inscripcion' })).length, 0);
    assert.equal((await MesaService.buscarPersonas(h.apellidos, await salida(PASION), { zona: 'tunicas' }))[0]?.id, h.id);
    assert.ok((await ZonasService.colas(await salida(PASION))).porRecoger.some((f) => f.solicitudId === r.solicitudId), 'le espera Túnicas');
    await assert.rejects(e.inscribir(h.id), esHttp(409, /Ya está apuntado/));

    // Al recoger nace la papeleta, con un recibo exento de 0 €, y la solicitud queda recogida.
    const hecha = await e.entregar(r.solicitudId);
    const papeleta = await db.papeletaSitio.findUniqueOrThrow({ where: { id: hecha.papeletaId }, include: { recibo: true } });
    assert.equal(papeleta.puesto, 'Trono');
    assert.equal(papeleta.recibo.estado, EstadoPago.EXENTO);
    assert.equal(papeleta.recibo.concepto, `Papeleta Sábado de Pasión ${YEAR}`);
    assert.equal(await db.transaccion.count({ where: { hermanoId: h.id } }), 0, 'sin dinero, sin asiento');
    const recogida = await db.solicitud.findUniqueOrThrow({ where: { id: r.solicitudId } });
    assert.equal(recogida.estado, 'RECOGIDA');
    assert.equal(recogida.papeletaId, papeleta.id);
    await assert.rejects(e.entregar(r.solicitudId), esHttp(409, /Ya se recogió/));
    await assert.rejects(e.inscribir(h.id), esHttp(409, /Ya tiene su papeleta/));
  } finally {
    await e.recoger();
  }
});

test('quien no aparece a recoger no deja papeleta: se cancela la solicitud y no hay nada que anular', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const { solicitudId } = await e.inscribir(h.id);
    const r = await PapeletasService.cancelarSolicitud(solicitudId, e.meta);
    assert.equal(r.message, 'Solicitud cancelada.');
    assert.equal((await db.solicitud.findUniqueOrThrow({ where: { id: solicitudId } })).estado, 'CANCELADA');
    assert.equal(await db.recibo.count({ where: { hermanoId: h.id } }), 0);
    // Puede volver a apuntarse.
    await e.inscribir(h.id);
  } finally {
    await e.recoger();
  }
});

test('con una cuota sin pagar la túnica no sale; Tesorería la cobra (una sola vez aunque se repita) y entonces sí', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano({ tieneTunicaPropia: true });
    const cuota = await e.cuota(h.id, YEAR);
    const tunica = await e.prenda(TipoPrenda.TUNICA);
    const capirote = await e.prenda(TipoPrenda.CAPIROTE);

    const r = await e.inscribir(h.id);
    assert.equal(r.requisitos.puedeRecoger, false);
    assert.equal(r.requisitos.totalPendiente, 20);
    assert.ok((await ZonasService.colas(await salida(PASION))).porCobrar.some((f) => f.solicitudId === r.solicitudId), 'le espera Tesorería');

    await assert.rejects(
      e.entregar(r.solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: tunica.numero }),
      esHttp(409, new RegExp(`cuota de ${YEAR} sin pagar`)),
    );
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: tunica.id } })).estado, EstadoPrenda.DISPONIBLE, 'nada se presta');
    assert.equal(await db.papeletaSitio.count({ where: { hermanoId: h.id } }), 0, 'ni papeleta');

    // La WiFi se corta tras cobrar y la mesa vuelve a pulsar: misma clave, un solo cobro.
    const clave = e.clave();
    const cobro = { hermanoId: h.id, reciboIds: [cuota.id], metodoPago: MetodoPago.EFECTIVO as 'EFECTIVO' };
    const primero = await ZonasService.cobrar(cobro, clave, e.meta);
    const segundo = await ZonasService.cobrar(cobro, clave, e.meta);
    assert.equal(primero.total, 20);
    assert.equal(primero.repetida, false);
    assert.equal(segundo.repetida, true);
    assert.deepEqual(segundo.cobrados, primero.cobrados);
    const ingresos = await db.transaccion.findMany({ where: { reciboId: cuota.id } });
    assert.equal(ingresos.length, 1);
    assert.equal(ingresos[0].tipo, TipoTransaccion.INGRESO);
    // Sin la clave, cobrar otra vez choca con el estado: ya está pagada.
    await assert.rejects(ZonasService.cobrar(cobro, undefined, e.meta), esHttp(409, /ya no está pendiente/));

    const hecha = await e.entregar(r.solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: tunica.numero, numCapiroteAsignado: capirote.numero });
    assert.equal(hecha.origenTunica, 'ROPERO');
    for (const id of [tunica.id, capirote.id]) {
      const p = await db.prenda.findUniqueOrThrow({ where: { id } });
      assert.equal(p.estado, EstadoPrenda.PRESTADA);
      assert.equal(p.hermanoId, h.id);
    }
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: h.id } })).tieneTunicaPropia, false);
  } finally {
    await e.recoger();
  }
});

test('con cuota de salida, Tesorería la cobra y su recibo es el de la papeleta al recoger', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    await db.salida.update({ where: { slug: PASION }, data: { importeCuota: 12.5 } });
    const h = await e.hermano();
    const { solicitudId, requisitos } = await e.inscribir(h.id);
    assert.deepEqual(requisitos.motivos, ['Falta pagar la papeleta.']);
    const cobro = await ZonasService.cobrar({ hermanoId: h.id, reciboIds: [], solicitudes: [{ solicitudId }], metodoPago: MetodoPago.BIZUM }, e.clave(), e.meta);
    assert.equal(cobro.total, 12.5);
    const { papeletaId } = await e.entregar(solicitudId);
    const papeleta = await db.papeletaSitio.findUniqueOrThrow({ where: { id: papeletaId }, include: { recibo: true } });
    assert.equal(papeleta.recibo.id, cobro.cobrados[0].id);
    assert.equal(papeleta.recibo.estado, EstadoPago.PAGADO);
    assert.equal(await db.transaccion.count({ where: { reciboId: papeleta.reciboId } }), 1);

    // Anular la papeleta devuelve el cobro y cancela su solicitud.
    await PapeletasService.anularPapeleta(papeletaId, e.meta);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: papeleta.reciboId } })).estado, EstadoPago.DEVUELTO);
    assert.equal((await db.solicitud.findUniqueOrThrow({ where: { id: solicitudId } })).estado, 'CANCELADA');
  } finally {
    await e.recoger();
  }
});

test('perdonar: la pendiente queda exenta con la nota del Hermano Mayor; la devuelta, con su reemisión exenta; la del banco no', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const pendiente = await e.cuota(h.id, YEAR);
    const devuelta = await e.cuota(h.id, YEAR - 1, EstadoPago.DEVUELTO);
    const enBanco = await e.cuota(h.id, YEAR - 2, EstadoPago.REMESADO);

    await assert.rejects(ZonasService.perdonar({ reciboIds: [enBanco.id] }, e.clave(), e.meta), esHttp(409, /en el banco/));
    const r = await ZonasService.perdonar({ reciboIds: [pendiente.id, devuelta.id], motivo: 'Apuros económicos' }, e.clave(), e.meta);
    assert.equal(r.perdonadas.length, 2);

    const ya = await db.recibo.findUniqueOrThrow({ where: { id: pendiente.id } });
    assert.equal(ya.estado, EstadoPago.EXENTO);
    assert.match(ya.observaciones ?? '', /Perdonada por decisión del Hermano Mayor .*Motivo: Apuros económicos/);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: devuelta.id } })).estado, EstadoPago.DEVUELTO, 'la devuelta es final');
    const reemision = await db.recibo.findFirstOrThrow({ where: { hermanoId: h.id, year: YEAR - 1, id: { not: devuelta.id } } });
    assert.equal(reemision.estado, EstadoPago.EXENTO);
    assert.equal(reemision.concepto, `Cuota ${YEAR - 1} (reemisión)`);

    // Con todo perdonado (la del banco no bloquea), recoge.
    const { solicitudId } = await e.inscribir(h.id);
    await e.entregar(solicitudId);
  } finally {
    await e.recoger();
  }
});

// Con la remesa en el banco, el cobro lo hace el banco: cobrarlo además en mano
// (en la mesa o desde Tesorería) cobraba dos veces la misma cuota.
test('una cuota remesada no se cobra en la mesa ni en Tesorería en mano; solo por domiciliación', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const enBanco = await e.cuota(h.id, YEAR, EstadoPago.REMESADO);
    await assert.rejects(ZonasService.cobrar({ hermanoId: h.id, reciboIds: [enBanco.id], metodoPago: MetodoPago.EFECTIVO }, e.clave(), e.meta), esHttp(409, /en el banco/));
    await assert.rejects(ReciboService.adminMarcarComoPagado(enBanco.id, MetodoPago.EFECTIVO, e.meta), esHttp(409, /en el banco/));
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: enBanco.id } })).estado, EstadoPago.REMESADO);
    assert.equal(await db.transaccion.count({ where: { reciboId: enBanco.id } }), 0);

    await ReciboService.adminMarcarComoPagado(enBanco.id, undefined, e.meta);
    const cobrado = await db.recibo.findUniqueOrThrow({ where: { id: enBanco.id } });
    assert.deepEqual([cobrado.estado, cobrado.metodoPago], [EstadoPago.PAGADO, MetodoPago.DOMICILIACION]);
  } finally {
    await e.recoger();
  }
});

test('una cuota devuelta se cobra con su reemisión; lo de otra familia no se cobra junto', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  const otraCuenta = await crearUsuarioPrueba(Role.USER);
  e.usuariosExtra.push(otraCuenta.id);
  try {
    const h = await e.hermano();
    const hijo = await e.hermano({ nombre: 'Hijo' });
    const ajeno = await e.hermano({ userId: otraCuenta.id });
    const devuelta = await e.cuota(h.id, YEAR - 1, EstadoPago.DEVUELTO, 18);
    const delHijo = await e.cuota(hijo.id, YEAR, EstadoPago.PENDIENTE, 10);
    const ajena = await e.cuota(ajeno.id, YEAR);

    await assert.rejects(
      ZonasService.cobrar({ hermanoId: h.id, reciboIds: [devuelta.id, ajena.id], metodoPago: MetodoPago.BIZUM }, e.clave(), e.meta),
      esHttp(403, /misma familia/),
    );
    const r = await ZonasService.cobrar({ hermanoId: h.id, reciboIds: [devuelta.id, delHijo.id], metodoPago: MetodoPago.BIZUM }, e.clave(), e.meta);
    assert.equal(r.total, 28, 'la de la familia se cobra junta');
    const reemision = r.cobrados.find((c) => c.hermanoId === h.id)!;
    assert.notEqual(reemision.id, devuelta.id);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: reemision.id } })).estado, EstadoPago.PAGADO);
    assert.equal(await db.transaccion.count({ where: { reciboId: reemision.id } }), 1);
    assert.equal((await ZonasService.requisitos(db, h.id, await salida(PASION))).cuotasPendientes.length, 0, 'la devuelta ya está cubierta');
  } finally {
    await e.recoger();
  }
});

test('el Rosario: su propia solicitud, con la voluntad que se ajusta al cobrar, y se recoge sin ropa', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const pasion = await e.inscribir(h.id);
    const rosario = await e.inscribir(h.id, { salida: ROSARIO, puesto: 'Vela', donativo: 5 });
    assert.notEqual(rosario.solicitudId, pasion.solicitudId, 'una por salida');
    assert.deepEqual(rosario.requisitos.motivos, ['Falta el donativo.']);
    await assert.rejects(e.entregar(rosario.solicitudId), esHttp(409, /Falta el donativo/));

    const cobro = await ZonasService.cobrar({
      hermanoId: h.id, reciboIds: [], solicitudes: [{ solicitudId: rosario.solicitudId, importe: 3 }], metodoPago: MetodoPago.EFECTIVO,
    }, e.clave(), e.meta);
    assert.equal(cobro.total, 3);
    const recibo = await db.recibo.findUniqueOrThrow({ where: { id: cobro.cobrados[0].id } });
    assert.equal(recibo.tipo, TipoRecibo.DONATIVO);
    // El Rosario lleva su propio año: el de octubre, no el de la Pasión.
    assert.equal(recibo.concepto, `Donativo Rosario vespertino ${await anioDeLaMesa(await salida(ROSARIO))}`);

    const tunica = await e.prenda(TipoPrenda.TUNICA);
    const hecha = await e.entregar(rosario.solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: tunica.numero, puesto: 'Trono' });
    assert.equal(hecha.puesto, 'Trono');
    assert.equal(hecha.puestoPedido, 'Vela');
    assert.equal(hecha.origenTunica, null, 'en el Rosario se va de traje');
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: tunica.id } })).estado, EstadoPrenda.DISPONIBLE);
    assert.equal((await db.papeletaSitio.findUniqueOrThrow({ where: { id: hecha.papeletaId } })).reciboId, recibo.id);

    // Si al final da 0 €, ya no debe nada y no hay asiento.
    const otro = await e.hermano();
    const cero = await e.inscribir(otro.id, { salida: ROSARIO, puesto: 'Vela', donativo: 2 });
    const nada = await ZonasService.cobrar({ hermanoId: otro.id, reciboIds: [], solicitudes: [{ solicitudId: cero.solicitudId, importe: 0 }], metodoPago: MetodoPago.EFECTIVO }, e.clave(), e.meta);
    assert.equal(nada.total, 0);
    assert.equal((await ZonasService.requisitos(db, otro.id, await salida(ROSARIO))).puedeRecoger, true);
    assert.equal(await db.transaccion.count({ where: { hermanoId: otro.id } }), 0);
  } finally {
    await e.recoger();
  }
});

test('una prenda que tiene otra persona no se presta, y la mesa sabe quién la tiene', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const duena = await e.hermano({ nombre: 'Lucía' });
    const otro = await e.hermano();
    const tunica = await e.prenda(TipoPrenda.TUNICA, numeroDePrueba(), { estado: EstadoPrenda.PRESTADA, hermanoId: duena.id });
    const { solicitudId } = await e.inscribir(otro.id);

    await assert.rejects(
      e.entregar(solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: tunica.numero }),
      esHttp(409, new RegExp(`la tiene Lucía ${duena.apellidos}`)),
    );
    // Todo o nada: ni papeleta, y la solicitud sigue pendiente.
    assert.equal(await db.papeletaSitio.count({ where: { hermanoId: otro.id } }), 0);
    assert.equal((await db.solicitud.findUniqueOrThrow({ where: { id: solicitudId } })).estado, 'PENDIENTE');
  } finally {
    await e.recoger();
  }
});

test('una túnica que no está en el ropero se niega, salvo que se pida darla de alta (con su talla)', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const numero = `145-${numeroDePrueba()}`;
    const { solicitudId } = await e.inscribir(h.id);
    await assert.rejects(e.entregar(solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: numero }), esHttp(404, /no está en el ropero/));
    await e.entregar(solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: numero, crearPrendas: ['TUNICA'] });
    const creada = await db.prenda.findUniqueOrThrow({ where: { tipo_numero: { tipo: TipoPrenda.TUNICA, numero: numero.toUpperCase() } } });
    e.prendas.push(creada.id);
    assert.equal(creada.talla, '145');
    assert.equal(creada.hermanoId, h.id);
  } finally {
    await e.recoger();
  }
});

test('el capirote 18 y la faraona 18 son prendas distintas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const numero = numeroDePrueba();
    await e.prenda(TipoPrenda.CAPIROTE, numero);
    const faraona = await e.prenda(TipoPrenda.FARAONA, numero);
    const nino = await e.hermano();
    const { solicitudId } = await e.inscribir(nino.id, { puesto: 'Guardería' });
    await e.entregar(solicitudId, { numFaraonaAsignada: numero });
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: faraona.id } })).hermanoId, nino.id);
    const capirote = await db.prenda.findUniqueOrThrow({ where: { tipo_numero: { tipo: TipoPrenda.CAPIROTE, numero } } });
    assert.equal(capirote.estado, EstadoPrenda.DISPONIBLE, 'el capirote del mismo número sigue en el ropero');
  } finally {
    await e.recoger();
  }
});

test('una altura de hombro que no se entiende no apunta a nadie', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    await assert.rejects(e.inscribir(h.id, { puesto: 'Trono', alturaHombro: 'alto' }), esHttp(400, /altura de hombro/));
    assert.equal(await db.solicitud.count({ where: { hermanoId: h.id } }), 0);
  } finally {
    await e.recoger();
  }
});

test('una cita de antes, sin solicitud, se enlaza al apuntar; al recoger queda atendida', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const hoy = new Date();
    const turno = await db.turno.create({ data: { fecha: hoy, horaInicio: hoy, horaFin: new Date(hoy.getTime() + 3_600_000), salidaId: await idDeSalida(PASION) } });
    e.turnos.push(turno.id);
    const cita = await db.cita.create({ data: { turnoId: turno.id, hermanoId: h.id } });

    assert.ok((await MesaService.esperadosHoy(await salida(PASION))).some((x) => x.citaId === cita.id), 'sale entre los esperados de hoy');
    const { solicitudId } = await e.inscribir(h.id);
    assert.equal((await db.solicitud.findUniqueOrThrow({ where: { id: solicitudId } })).citaId, cita.id);
    const { papeletaId } = await e.entregar(solicitudId);
    assert.equal((await db.papeletaSitio.findUniqueOrThrow({ where: { id: papeletaId } })).citaId, cita.id);
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: cita.id } })).estado, EstadoCita.ATENDIDA);
    assert.ok(!(await MesaService.esperadosHoy(await salida(PASION))).some((x) => x.citaId === cita.id), 'ya no se le espera');
  } finally {
    await e.recoger();
  }
});

test('la ficha dice lo que debe y lo que pidió, y propone la ropa que tiene; al cambiar de túnica, la vieja sigue a su nombre hasta que la devuelva', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const hija = await e.hermano({ nombre: 'Hija' });
    await e.cuota(hija.id, YEAR);
    const vieja = await e.prenda(TipoPrenda.TUNICA, numeroDePrueba(), { estado: EstadoPrenda.PRESTADA, hermanoId: h.id });
    const nueva = await e.prenda(TipoPrenda.TUNICA);
    const { solicitudId } = await e.inscribir(h.id, { puesto: 'Bocina' });

    const ficha = await MesaService.ficha(h.id, await salida(PASION));
    assert.deepEqual(ficha.propuesta.tunica, { origen: 'ROPERO', numero: vieja.numero });
    assert.equal(ficha.propuesta.puesto, 'Bocina', 'manda lo que pidió');
    assert.equal(ficha.solicitud?.id, solicitudId);
    assert.equal(ficha.papeleta, null);
    assert.equal(ficha.cuotaSalida, 0);
    assert.deepEqual(ficha.familia.map((f) => f.id), [hija.id], 'la familia con cuotas por pagar');

    await e.entregar(solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: nueva.numero });
    // NG3 (auditoría 07-10-2026): volvía a DISPONIBLE sin pasar por el lavado
    // y desaparecía de «Sin devolver» aunque siguiera en su casa. Vuelve con
    // «Devolver», como todas.
    const tunicaVieja = await db.prenda.findUniqueOrThrow({ where: { id: vieja.id } });
    assert.equal(tunicaVieja.estado, EstadoPrenda.PRESTADA);
    assert.equal(tunicaVieja.hermanoId, h.id);
    assert.ok((await ZonasService.sinDevolver()).some((f) => f.hermano.id === h.id), 'sale en «Sin devolver»');
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: nueva.id } })).hermanoId, h.id);
    const despues = await MesaService.ficha(h.id, await salida(PASION));
    assert.equal(despues.solicitud, null);
    assert.equal(despues.papeleta?.puestoPedido, 'Bocina');
  } finally {
    await e.recoger();
  }
});

test('corregir una solicitud cambia lo pedido; corregir la papeleta cambia la ropa; anular la deja prestada hasta que se devuelva', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const [t1, t2, cap] = [await e.prenda(TipoPrenda.TUNICA), await e.prenda(TipoPrenda.TUNICA), await e.prenda(TipoPrenda.CAPIROTE)];
    const { solicitudId } = await e.inscribir(h.id);
    await MesaService.editarSolicitud(solicitudId, { puesto: 'Bocina' }, e.meta);
    assert.equal((await db.solicitud.findUniqueOrThrow({ where: { id: solicitudId } })).puesto, 'Bocina');
    await assert.rejects(MesaService.editarSolicitud(solicitudId, { donativo: 5 }, e.meta), esHttp(409, /solo se cambia en las salidas de donativo/));

    const { papeletaId } = await e.entregar(solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: t1.numero, numCapiroteAsignado: cap.numero });
    const corregida = await MesaService.editarPapeleta(papeletaId, { numTunicaAsignada: t2.numero, puesto: 'Viacrucis' }, e.meta);
    assert.equal(corregida.puesto, 'Viacrucis');
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: t1.id } })).estado, EstadoPrenda.DISPONIBLE);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: t2.id } })).hermanoId, h.id);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: cap.id } })).hermanoId, h.id, 'el capirote no cambia');

    // Pasar a túnica propia devuelve la del ropero.
    const propia = await MesaService.editarPapeleta(papeletaId, { origenTunica: 'PROPIA' }, e.meta);
    assert.equal(propia.numTunicaAsignada, null);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: t2.id } })).estado, EstadoPrenda.DISPONIBLE);

    // NG3 (auditoría 07-10-2026): anular una papeleta recogida no trae la
    // ropa de vuelta; la daba por devuelta y la túnica se saltaba el lavado.
    await PapeletasService.anularPapeleta(papeletaId, e.meta);
    const capirote = await db.prenda.findUniqueOrThrow({ where: { id: cap.id } });
    assert.equal(capirote.estado, EstadoPrenda.PRESTADA);
    assert.equal(capirote.hermanoId, h.id);
    await ZonasService.devolver({ hermanoId: h.id, prendas: [{ id: cap.id }], cingulos: [] }, e.clave(), e.meta);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: cap.id } })).estado, EstadoPrenda.DISPONIBLE, 'vuelve con «Devolver»');
  } finally {
    await e.recoger();
  }
});

test('el cíngulo va con la túnica del ropero; si no quedan, se le debe y se le da después', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    await e.cingulosLibres(1);
    const [a, b, c] = [await e.hermano({ nombre: 'Ana' }), await e.hermano({ nombre: 'Blas' }), await e.hermano({ nombre: 'Cruz' })];
    const [ta, tb] = [await e.prenda(TipoPrenda.TUNICA), await e.prenda(TipoPrenda.TUNICA)];

    // Con túnica del ropero se le presta el cíngulo; con la suya, lleva el suyo.
    const pa = await e.entregar((await e.inscribir(a.id)).solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: ta.numero });
    assert.equal(pa.cingulo, 'PRESTADO');
    assert.equal((await recuentoDeCingulos()).enElRopero, 0);
    const pc = await e.entregar((await e.inscribir(c.id)).solicitudId);
    assert.equal(pc.cingulo, 'PROPIO');

    // No queda ninguno: pedirlo se niega, y sin decir nada se le debe.
    const sb = (await e.inscribir(b.id)).solicitudId;
    await assert.rejects(e.entregar(sb, { origenTunica: 'ROPERO', numTunicaAsignada: tb.numero, cingulo: 'PRESTADO' }), esHttp(409, /No quedan cíngulos/));
    const pb = await e.entregar(sb, { origenTunica: 'ROPERO', numTunicaAsignada: tb.numero });
    assert.equal(pb.cingulo, 'DEBIDO');
    assert.equal((await MesaService.ficha(b.id, await salida(PASION))).cingulos.enElRopero, 0);
    const faltan = await MesaService.listado(YEAR, await salida(PASION), { faltaCingulo: true });
    assert.deepEqual(faltan.apuntados.filter((f) => e.hermanos.includes(f.hermano.id)).map((f) => f.hermano.id), [b.id]);
    assert.ok(faltan.faltanCingulos >= 1);

    // Llegan más cíngulos: se le da el suyo desde el listado.
    await assert.rejects(MesaService.editarPapeleta(pb.papeletaId, { cingulo: 'PRESTADO' }, e.meta), esHttp(409, /No quedan cíngulos/));
    await e.cingulosLibres(1);
    await MesaService.editarPapeleta(pb.papeletaId, { cingulo: 'PRESTADO' }, e.meta);
    assert.equal((await db.papeletaSitio.findUniqueOrThrow({ where: { id: pb.papeletaId } })).cingulo, 'PRESTADO');
    assert.equal((await recuentoDeCingulos()).enElRopero, 0);

    // Anular la papeleta devuelve también el cíngulo.
    await PapeletasService.anularPapeleta(pa.papeletaId, e.meta);
    assert.equal((await recuentoDeCingulos()).enElRopero, 1);
  } finally {
    await e.recoger();
  }
});

test('después de la salida se devuelve todo: la túnica al lavado, lo roto al taller, el cíngulo al ropero', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    await e.cingulosLibres(1);
    const h = await e.hermano();
    const [tunica, capirote] = [await e.prenda(TipoPrenda.TUNICA), await e.prenda(TipoPrenda.CAPIROTE)];
    const { papeletaId } = await e.entregar((await e.inscribir(h.id)).solicitudId, {
      origenTunica: 'ROPERO', numTunicaAsignada: tunica.numero, numCapiroteAsignado: capirote.numero,
    });

    // Quien tiene algo sin devolver sale en el buscador de Devolución y en la lista.
    assert.equal((await MesaService.buscarPersonas(h.apellidos, await salida(PASION), { zona: 'devolucion' }))[0]?.id, h.id);
    const ficha = await MesaService.ficha(h.id, await salida(PASION));
    assert.deepEqual(ficha.prendas.map((p) => p.id).sort(), [tunica.id, capirote.id].sort());
    assert.deepEqual(ficha.cingulosSinDevolver, [{ papeletaId, year: YEAR }]);
    const lista = (await ZonasService.sinDevolver()).find((f) => f.hermano.id === h.id);
    assert.equal(lista?.prendas.length, 2);
    assert.equal(lista?.cingulos.length, 1);

    const clave = e.clave();
    const devolucion = { hermanoId: h.id, prendas: [{ id: tunica.id }, { id: capirote.id, rota: true }], cingulos: [papeletaId] };
    const r = await ZonasService.devolver(devolucion, clave, e.meta);
    assert.equal(r.repetida, false);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: tunica.id } })).estado, EstadoPrenda.LAVADO, 'las túnicas se lavan todas');
    const rota = await db.prenda.findUniqueOrThrow({ where: { id: capirote.id } });
    assert.equal(rota.estado, EstadoPrenda.TALLER);
    assert.equal(rota.hermanoId, null);
    assert.equal((await db.papeletaSitio.findUniqueOrThrow({ where: { id: papeletaId } })).cingulo, 'DEVUELTO');
    assert.equal((await ZonasService.devolver(devolucion, clave, e.meta)).repetida, true, 'reintentar no falla');
    await assert.rejects(ZonasService.devolver(devolucion, e.clave(), e.meta), esHttp(409, /ya no consta prestada/));
    assert.equal((await ZonasService.sinDevolver()).some((f) => f.hermano.id === h.id), false);
    assert.equal((await MesaService.buscarPersonas(h.apellidos, await salida(PASION), { zona: 'devolucion' })).length, 0);

    // Del lavado sale lista para prestar.
    const lavadas = await InventarioService.marcarLavadas([tunica.id]);
    assert.deepEqual(lavadas.ids, [tunica.id]);
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: tunica.id } })).estado, EstadoPrenda.DISPONIBLE);
  } finally {
    await e.recoger();
  }
});

test('en el Inventario la túnica devuelta va al lavado; lo demás, disponible; lo roto, al taller; y la del lavado se puede prestar', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    const tunica = await e.prenda(TipoPrenda.TUNICA, numeroDePrueba(), { estado: EstadoPrenda.PRESTADA, hermanoId: h.id });
    const capirote = await e.prenda(TipoPrenda.CAPIROTE, numeroDePrueba(), { estado: EstadoPrenda.PRESTADA, hermanoId: h.id });
    const faraona = await e.prenda(TipoPrenda.FARAONA, numeroDePrueba(), { estado: EstadoPrenda.PRESTADA, hermanoId: h.id });
    assert.equal((await InventarioService.devolverPrenda(tunica.id)).estado, EstadoPrenda.LAVADO);
    assert.equal((await InventarioService.devolverPrenda(capirote.id)).estado, EstadoPrenda.DISPONIBLE);
    assert.equal((await InventarioService.devolverPrenda(faraona.id, true)).estado, EstadoPrenda.TALLER);

    // En el reparto, meses después, la del lavado ya está limpia aunque nadie lo marcara.
    const otro = await e.hermano({ nombre: 'Otro' });
    await e.entregar((await e.inscribir(otro.id)).solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: tunica.numero, cingulo: 'DEBIDO' });
    assert.equal((await db.prenda.findUniqueOrThrow({ where: { id: tunica.id } })).hermanoId, otro.id);
  } finally {
    await e.recoger();
  }
});

test('una túnica no va en dos papeletas de la misma salida, aunque el ropero la tenga libre', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const [a, b] = [await e.hermano({ nombre: 'Ana' }), await e.hermano({ nombre: 'Blas' })];
    const [tunica, otra] = [await e.prenda(TipoPrenda.TUNICA), await e.prenda(TipoPrenda.TUNICA)];
    const pa = await e.entregar((await e.inscribir(a.id)).solicitudId, { origenTunica: 'ROPERO', numTunicaAsignada: tunica.numero, cingulo: 'DEBIDO' });
    // Después de la salida la devuelve: el ropero la tiene libre, pero va en la papeleta de Ana.
    await ZonasService.devolver({ hermanoId: a.id, prendas: [{ id: tunica.id }], cingulos: [] }, e.clave(), e.meta);

    const [buscada] = await MesaService.prendas('TUNICA', tunica.numero, await salida(PASION));
    assert.equal(buscada.enPapeleta?.id, a.id, 'la mesa sabe en qué papeleta va');

    const sb = (await e.inscribir(b.id)).solicitudId;
    await assert.rejects(e.entregar(sb, { origenTunica: 'ROPERO', numTunicaAsignada: tunica.numero, cingulo: 'DEBIDO' }), esHttp(409, /ya va en la papeleta de Ana/));
    const pb = await e.entregar(sb, { origenTunica: 'ROPERO', numTunicaAsignada: otra.numero, cingulo: 'DEBIDO' });
    await assert.rejects(MesaService.editarPapeleta(pb.papeletaId, { numTunicaAsignada: tunica.numero }, e.meta), esHttp(409, /ya va en la papeleta de Ana/));

    // La suya se sigue corrigiendo en lo demás sin chocar consigo misma.
    await MesaService.editarPapeleta(pa.papeletaId, { puesto: 'Bocina' }, e.meta);
  } finally {
    await e.recoger();
  }
});

test('el listado dice en qué punto está cada uno: por pagar, listo o recogido', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const [debe, listo, recogido] = [await e.hermano({ nombre: 'Debe' }), await e.hermano({ nombre: 'Listo' }), await e.hermano({ nombre: 'Recogido' })];
    await e.cuota(debe.id, YEAR, EstadoPago.PENDIENTE, 25);
    const a = await e.inscribir(debe.id);
    const b = await e.inscribir(listo.id);
    const c = await e.inscribir(recogido.id);
    const { papeletaId } = await e.entregar(c.solicitudId);
    const { apuntados } = await MesaService.listado(YEAR, await salida(PASION), {});
    const de = (tipo: string, id: number) => apuntados.find((p) => p.tipo === tipo && p.id === id)!;
    assert.equal(de('solicitud', a.solicitudId).estado, 'por-pagar');
    assert.equal(de('solicitud', a.solicitudId).pendiente, 25);
    assert.equal(de('solicitud', b.solicitudId).estado, 'lista');
    assert.equal(de('papeleta', papeletaId).estado, 'recogida');
    assert.equal(apuntados.filter((p) => p.hermano.id === recogido.id).length, 1, 'recogido, sale una vez: con su papeleta');
  } finally {
    await e.recoger();
  }
});

// El listado enseñaba el teléfono y el correo de todos los apuntados y los
// buscaba por un trozo a cualquiera de la mesa: igual que en el buscador y la
// ficha, sin el censo el contacto va enmascarado y solo se busca con el dato entero.
test('el listado, sin el censo: contacto enmascarado y teléfono o correo solo enteros', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano({ nombre: 'Contacto' });
    const correo = `listado-${Date.now()}@ejemplo.test`;
    await db.hermano.update({ where: { id: h.id }, data: { telefono: '623577927', email: correo } });
    await e.inscribir(h.id);
    const pasion = await salida(PASION);
    const suyo = (r: Awaited<ReturnType<typeof MesaService.listado>>) => r.apuntados.find((a) => a.hermano.id === h.id);

    const conCenso = suyo(await MesaService.listado(YEAR, pasion, {}, { censo: true }));
    assert.equal(conCenso?.hermano.telefono, '623577927');
    assert.equal(conCenso?.hermano.email, correo);

    const sinCenso = suyo(await MesaService.listado(YEAR, pasion, {}));
    assert.equal(sinCenso?.hermano.telefono, '••••••927');
    assert.notEqual(sinCenso?.hermano.email, correo);
    assert.ok(!String(sinCenso?.hermano.email).startsWith('listado-'), 'el correo va tapado');

    // Un trozo del teléfono o del correo encuentra con el censo y no sin él.
    assert.ok(suyo(await MesaService.listado(YEAR, pasion, { q: '577927' }, { censo: true })));
    assert.equal(suyo(await MesaService.listado(YEAR, pasion, { q: '577927' })), undefined);
    assert.equal(suyo(await MesaService.listado(YEAR, pasion, { q: correo.slice(0, 12) })), undefined);
    // Entero, sí.
    assert.ok(suyo(await MesaService.listado(YEAR, pasion, { q: '623577927' })));
    assert.ok(suyo(await MesaService.listado(YEAR, pasion, { q: correo })));
    assert.ok(suyo(await MesaService.listado(YEAR, pasion, { q: 'Contacto' })), 'por el nombre, como siempre');
  } finally {
    await e.recoger();
  }
});

test('al cerrar el plazo, la solicitud de quien pidió día y no vino se cancela; la ya pagada, no', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const [faltaA, faltaB] = [await e.hermano(), await e.hermano()];
    const ayer = new Date(Date.now() - 26 * 3_600_000);
    const turno = await db.turno.create({ data: { fecha: ayer, horaInicio: ayer, horaFin: new Date(ayer.getTime() + 3_600_000), salidaId: await idDeSalida(ROSARIO) } });
    e.turnos.push(turno.id);
    const [citaA, citaB] = [await db.cita.create({ data: { turnoId: turno.id, hermanoId: faltaA.id } }), await db.cita.create({ data: { turnoId: turno.id, hermanoId: faltaB.id } })];
    const sinPagar = await db.solicitud.create({ data: { hermanoId: faltaA.id, year: YEAR, salidaId: await idDeSalida(ROSARIO), puesto: 'Vela', donativo: 5, origen: 'WEB', citaId: citaA.id } });
    const pagada = await db.solicitud.create({ data: { hermanoId: faltaB.id, year: YEAR, salidaId: await idDeSalida(ROSARIO), puesto: 'Vela', donativo: 5, origen: 'WEB', citaId: citaB.id } });
    await ZonasService.cobrar({ hermanoId: faltaB.id, reciboIds: [], solicitudes: [{ solicitudId: pagada.id }], metodoPago: MetodoPago.TARJETA }, e.clave(), e.meta);

    await PapeletasService.procesarAusencias(new Date(), true, e.meta);
    assert.equal((await db.solicitud.findUniqueOrThrow({ where: { id: sinPagar.id } })).estado, 'CANCELADA');
    assert.equal((await db.solicitud.findUniqueOrThrow({ where: { id: pagada.id } })).estado, 'PENDIENTE', 'lo pagado lo resuelve Tesorería');
    assert.equal((await db.cita.findUniqueOrThrow({ where: { id: citaA.id } })).estado, EstadoCita.CANCELADA);
  } finally {
    await e.recoger();
  }
});

test('alta en la mesa: un adulto abre su cuenta y su ficha, activa y con número', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  const sufijo = `${process.pid}${Date.now() % 1_000_000}`;
  try {
    const alta = await MesaService.darDeAlta({
      nombre: 'Adán', primerApellido: 'Elena', segundoApellido: 'Sedano', fechaNacimiento: '1990-03-08',
      telefono: '639220861', email: `mesa-${sufijo}@ejemplo.test`, dni: `M${sufijo}`.slice(0, 9),
    }, e.meta);
    const ficha = await db.hermano.findUniqueOrThrow({ where: { id: alta.id }, include: { user: true } });
    e.usuariosExtra.push(ficha.userId);
    assert.equal(ficha.activo, true);
    assert.ok(ficha.numeroHermano);
    assert.equal(ficha.esTitular, true);
    assert.equal(ficha.apellidos, 'Elena Sedano');
    assert.equal(ficha.user.email, `mesa-${sufijo}@ejemplo.test`);
    assert.equal(ficha.user.active, true);

    // Un menor, colgado de la cuenta de su tutor, que ya está en el censo.
    const bebe = await MesaService.darDeAlta({
      nombre: 'Abril', primerApellido: 'López', fechaNacimiento: '2021-09-21', tutor: { hermanoId: alta.id }, parentesco: 'HIJO',
    }, e.meta);
    const fichaBebe = await db.hermano.findUniqueOrThrow({ where: { id: bebe.id } });
    assert.equal(fichaBebe.userId, ficha.userId);
    assert.equal(fichaBebe.esTitular, false);
    assert.equal(fichaBebe.telefono, '639220861', 'hereda el contacto del tutor');

    // Sin DNI no se abre la cuenta de un adulto.
    await assert.rejects(
      MesaService.darDeAlta({ nombre: 'Sin', primerApellido: 'Dni', fechaNacimiento: '1980-01-01', email: 'x@ejemplo.test', telefono: '600000000' }, e.meta),
      (err: unknown) => err instanceof HttpError && /DNI, su correo y su teléfono/.test(err.message),
    );
    // Un adulto no se cuelga de la cuenta de nadie.
    await assert.rejects(
      MesaService.darDeAlta({ nombre: 'Mayor', primerApellido: 'Deedad', fechaNacimiento: '1980-01-01', tutor: { hermanoId: alta.id } }, e.meta),
      (err: unknown) => err instanceof HttpError && /años cumplidos/.test(err.message),
    );
  } finally {
    await e.recoger();
  }
});

test('«editar antes de guardar» corrige la ficha y deja rastro solo de lo que cambia', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano();
    // Como Secretaría: el teléfono solo lo corrige quien lleva el censo.
    const censo = { censo: true };
    const r = await MesaService.corregirFicha(h.id, { primerApellido: 'Galea', segundoApellido: 'Mayorga', telefono: '623577927', alturaHombro: '1,45' }, e.meta, censo);
    assert.equal(r.cambiados, 5, 'apellidos juntos y partidos, teléfono y altura');
    const ficha = await db.hermano.findUniqueOrThrow({ where: { id: h.id } });
    assert.equal(ficha.apellidos, 'Galea Mayorga');
    assert.equal(ficha.alturaHombro, 145);
    assert.equal((await MesaService.corregirFicha(h.id, { telefono: '623577927' }, e.meta, censo)).cambiados, 0);
  } finally {
    await e.recoger();
  }
});

test('por HTTP: la mesa es de la Junta que reparte; perdonar, de Tesorería y el Hermano Mayor; reactivar, de Secretaría', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  const albaceria = await crearUsuarioPrueba(Role.ALBACERIA);
  try {
    const h = await e.hermano({ nombre: 'Buscable' });
    const cuota = await e.cuota(h.id, YEAR);
    const como = (userId: number, rol: Role, ruta: string, metodo = 'GET', cuerpo?: unknown) =>
      fetch(`${baseUrl}/api/procesion${ruta}`, {
        method: metodo,
        headers: { Cookie: `${COOKIE_CMS}=${generateToken(userId, rol)}`, ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }) },
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      });

    assert.equal((await como(e.usuario.id, Role.USER, '/admin/mesa/personas?q=Buscable')).status, 403);
    const busqueda = await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas?q=${encodeURIComponent(h.apellidos)}&zona=inscripcion&salida=${PASION}`);
    assert.equal(busqueda.status, 200);
    const [encontrada] = await busqueda.json() as { id: number; situacion: string }[];
    assert.equal(encontrada.id, h.id);
    assert.equal(encontrada.situacion, 'activo');

    assert.equal((await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas/${h.id}/activar`, 'POST')).status, 403);
    assert.equal((await como(albaceria.id, Role.ALBACERIA, '/admin/mesa/prendas?tipo=GORRO&q=1')).status, 400);
    assert.equal((await como(albaceria.id, Role.ALBACERIA, '/admin/mesa/perdonar', 'POST', { reciboIds: [cuota.id] })).status, 403);
    const ins = await como(albaceria.id, Role.ALBACERIA, '/admin/mesa/inscribir', 'POST', { hermanoId: h.id, salida: PASION, puesto: 'Cirio', clave: e.clave() });
    assert.equal(ins.status, 201);
    assert.equal((await como(albaceria.id, Role.ALBACERIA, '/admin/mesa/inscribir', 'POST', { hermanoId: h.id, salida: PASION, puesto: 'Cirio', clave: 'x' })).status, 400, 'una clave que no lo es');

    // La salida es obligatoria: sin ella, o con una que no existe, la mesa no supone ninguna.
    assert.equal((await como(albaceria.id, Role.ALBACERIA, '/admin/mesa/colas')).status, 400, 'sin salida');
    const noExiste = await como(albaceria.id, Role.ALBACERIA, '/admin/mesa/colas?salida=no-existe');
    assert.equal(noExiste.status, 400, 'con una salida que no existe');
    assert.match((await noExiste.json() as { error: string }).error, /No existe la salida «no-existe»/);
    assert.equal((await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/colas?salida=${PASION}`)).status, 200);
    await db.auditLog.deleteMany({ where: { userId: albaceria.id } });
  } finally {
    await borrarUsuarioPrueba(albaceria.id);
    await e.recoger();
  }
});

// AC3 y AC7 (auditoría del 07-10-2026): Tesorería y Albacería están en la
// mesa para cobrar y dar la ropa. Buscaban por un trozo de DNI o teléfono,
// leían el DNI y el contacto de cualquier ficha (bajas y pendientes
// incluidas), los corregían y daban de alta hermanos con número.
test('por HTTP: Tesorería y Albacería en la mesa solo ven y corrigen fichas en activo, sin DNI ni contacto, y no dan de alta', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  const albaceria = await crearUsuarioPrueba(Role.ALBACERIA);
  const tesoreria = await crearUsuarioPrueba(Role.TESORERIA);
  const secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    const sufijo = `${process.pid}${Date.now() % 1_000_000}`.slice(-7);
    const dni = `${sufijo}Q`.padStart(9, '0');
    const activo = await e.hermano({ nombre: 'Visible' });
    await db.hermano.update({ where: { id: activo.id }, data: { dni, telefono: '623577927', email: `visible-${sufijo}@ejemplo.test` } });
    const baja = await e.hermano({ nombre: 'Oculta' });
    await db.hermano.update({ where: { id: baja.id }, data: { activo: false, fechaBaja: new Date() } });
    const conRopa = await e.hermano({ nombre: 'Debe' });
    await db.hermano.update({ where: { id: conRopa.id }, data: { activo: false, fechaBaja: new Date() } });
    await e.prenda(TipoPrenda.TUNICA, numeroDePrueba(), { estado: EstadoPrenda.PRESTADA, hermanoId: conRopa.id });

    const como = (userId: number, rol: Role, ruta: string, metodo = 'GET', cuerpo?: unknown) =>
      fetch(`${baseUrl}/api/procesion${ruta}`, {
        method: metodo,
        headers: { Cookie: `${COOKIE_CMS}=${generateToken(userId, rol)}`, ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }) },
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      });
    const buscar = async (userId: number, rol: Role, q: string) =>
      (await (await como(userId, rol, `/admin/mesa/personas?q=${encodeURIComponent(q)}&salida=${PASION}`)).json() as { id: number }[]).map((p) => p.id);

    // Por nombre: los de activo, y la baja que aún debe ropa (hay que recibírsela).
    assert.ok((await buscar(albaceria.id, Role.ALBACERIA, `Visible ${activo.apellidos}`)).includes(activo.id));
    assert.ok((await buscar(albaceria.id, Role.ALBACERIA, `Debe ${conRopa.apellidos}`)).includes(conRopa.id), 'la baja con ropa sin devolver sale, para recibirla');
    assert.ok(!(await buscar(albaceria.id, Role.ALBACERIA, `Oculta ${baja.apellidos}`)).includes(baja.id), 'la baja sin nada pendiente, no');
    // Por DNI o teléfono, solo el dato entero.
    assert.deepEqual(await buscar(tesoreria.id, Role.TESORERIA, dni.slice(0, 5)), []);
    assert.deepEqual(await buscar(tesoreria.id, Role.TESORERIA, '5779'), []);
    assert.deepEqual(await buscar(tesoreria.id, Role.TESORERIA, dni.toLowerCase()), [activo.id]);
    assert.deepEqual(await buscar(tesoreria.id, Role.TESORERIA, '623577927'), [activo.id]);

    // La ficha, sin DNI y con el contacto enmascarado.
    const ficha = await (await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas/${activo.id}?salida=${PASION}`)).json() as { dni: string | null; telefono: string; email: string; contactoCompleto: boolean };
    assert.equal(ficha.dni, null);
    assert.equal(ficha.telefono, '••••••927');
    assert.match(ficha.email, /^vi•••@ejemplo\.test$/);
    assert.equal(ficha.contactoCompleto, false);
    assert.equal((await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas/${baja.id}?salida=${PASION}`)).status, 404);
    assert.equal((await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas/${conRopa.id}?salida=${PASION}`)).status, 200);

    // Corregir: lo de la procesión sí; el contacto y las bajas, no.
    assert.equal((await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas/${activo.id}`, 'PATCH', { alturaHombro: '1,50' })).status, 200);
    assert.equal((await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas/${activo.id}`, 'PATCH', { telefono: '600000000' })).status, 403);
    assert.equal((await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas/${activo.id}`, 'PATCH', { email: 'otro@ejemplo.test' })).status, 403);
    assert.equal((await como(albaceria.id, Role.ALBACERIA, `/admin/mesa/personas/${baja.id}`, 'PATCH', { alturaHombro: '1,50' })).status, 404);
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: activo.id } })).telefono, '623577927');

    // Dar de alta es del censo (AC7).
    const alta = { nombre: 'Nadie', primerApellido: 'Nuevo', fechaNacimiento: '2020-01-01', tutorHermanoId: activo.id, parentesco: 'HIJO' };
    assert.equal((await como(albaceria.id, Role.ALBACERIA, '/admin/mesa/personas', 'POST', alta)).status, 403);
    assert.equal((await como(tesoreria.id, Role.TESORERIA, '/admin/mesa/personas', 'POST', alta)).status, 403);

    // Secretaría sigue viéndolo todo: la ficha entera, las bajas (para
    // reactivarlas) y la búsqueda por un trozo del DNI.
    const completa = await (await como(secretaria.id, Role.SECRETARIA, `/admin/mesa/personas/${activo.id}?salida=${PASION}`)).json() as { dni: string; telefono: string; contactoCompleto: boolean };
    assert.equal(completa.dni, dni);
    assert.equal(completa.telefono, '623577927');
    assert.equal(completa.contactoCompleto, true);
    assert.ok((await buscar(secretaria.id, Role.SECRETARIA, dni.slice(0, 7))).includes(activo.id));
    assert.ok((await buscar(secretaria.id, Role.SECRETARIA, `Oculta ${baja.apellidos}`)).includes(baja.id));
  } finally {
    for (const u of [albaceria, tesoreria, secretaria]) {
      await db.auditLog.deleteMany({ where: { userId: u.id } });
      await borrarUsuarioPrueba(u.id);
    }
    await e.recoger();
  }
});

test('el canal en vivo avisa a los demás puestos de lo que se hace en uno', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  const corte = new AbortController();
  try {
    const h = await e.hermano();
    const canal = await fetch(`${baseUrl}/api/procesion/admin/mesa/eventos`, {
      headers: { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.ADMIN)}` },
      signal: corte.signal,
    });
    assert.equal(canal.status, 200);
    assert.match(canal.headers.get('content-type') ?? '', /text\/event-stream/);
    const lector = canal.body!.getReader();
    const decodificador = new TextDecoder();

    await e.inscribir(h.id);
    let leido = '';
    while (!leido.includes('data:')) {
      const { value, done } = await lector.read();
      if (done) break;
      leido += decodificador.decode(value);
    }
    const aviso = JSON.parse(leido.slice(leido.indexOf('data:') + 5).split('\n')[0]) as { que: string; hermanoId: number; salidaId: number };
    assert.deepEqual(aviso, { que: 'inscrito', hermanoId: h.id, salidaId: await idDeSalida(PASION) });
  } finally {
    corte.abort();
    await e.recoger();
  }
});

// Septiembre de 2026: un hermano pidió desde su área la Pasión de 2027 (la
// de 2026 ya había pasado) y la pagó, pero la mesa buscaba en el año natural y
// no lo encontraba en ninguna parte. El año de la mesa es el de la salida.
test('lo que se pide desde el área sale en la mesa: en el listado, en Túnicas y en su ficha', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const h = await e.hermano({ nombre: 'Desdelaweb' });
    const year = PlazoPapeletasService.anioDeLaProcesion(await salida(PASION));
    await db.solicitud.create({ data: { hermanoId: h.id, year, salidaId: await idDeSalida(PASION), puesto: 'Nazareno', origen: 'WEB' } });

    const listado = await fetch(`${baseUrl}/api/procesion/admin/mesa/apuntados?salida=${PASION}&q=${encodeURIComponent(h.apellidos)}`, {
      headers: { Cookie: `${COOKIE_CMS}=${generateToken(e.admin.id, Role.ADMIN)}` },
    });
    assert.equal(listado.status, 200);
    assert.match(JSON.stringify(await listado.json()), new RegExp(`"id":${h.id},`), 'sin año en la petición, el listado es el de la salida');
    const enTunicas = await MesaService.buscarPersonas(h.apellidos, await salida(PASION), { zona: 'tunicas' });
    assert.deepEqual(enTunicas.map((p) => p.id), [h.id]);
    const ficha = await MesaService.ficha(h.id, await salida(PASION));
    assert.ok(ficha.solicitud, 'la ficha de la mesa ve la solicitud');
  } finally {
    await e.recoger();
  }
});

// Octubre de 2026: a quien no tiene túnica en casa ni está libre la de antes
// se le propone la de su talla, sin dar la misma a dos en la hoja del ropero.
// La altura es rara a propósito (2,15 m), para que las túnicas reales de la
// base de desarrollo no entren en juego.
test('la túnica de su talla: en su ficha y, sin repetir, en la hoja de preparación', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const cerca = await e.prenda(TipoPrenda.TUNICA, `216-${numeroDePrueba()}`);
    const lejos = await e.prenda(TipoPrenda.TUNICA, `219-${numeroDePrueba()}`);
    const ana = await e.hermano({ nombre: 'Ana' });
    const bea = await e.hermano({ nombre: 'Bea' });
    await e.inscribir(ana.id, { alturaHombro: '2,15' });
    await e.inscribir(bea.id, { alturaHombro: '2,15' });

    const ficha = await MesaService.ficha(ana.id, await salida(PASION));
    assert.deepEqual(ficha.propuesta.tunica, { origen: 'ROPERO', numero: cerca.numero, porTalla: true }, 'la más cercana a su altura');

    const hoja = await ZonasService.preparacion(await salida(PASION));
    const de = (id: number) => hoja.find((f) => f.hermano.id === id)!.propuesta.tunica;
    assert.deepEqual(new Set([de(ana.id).numero, de(bea.id).numero]), new Set([cerca.numero, lejos.numero]), 'una a cada una, sin repetir');
    assert.equal(de(ana.id).porTalla && de(bea.id).porTalla, true);

    // Dada a Ana, ya no es libre: a Bea se le propone la otra.
    await e.entregar((await db.solicitud.findFirstOrThrow({ where: { hermanoId: ana.id, estado: 'PENDIENTE' } })).id, { origenTunica: 'ROPERO', numTunicaAsignada: cerca.numero, cingulo: 'NINGUNO' });
    assert.equal((await MesaService.ficha(bea.id, await salida(PASION))).propuesta.tunica.numero, lejos.numero);
  } finally {
    await e.recoger();
  }
});
