// El pago en línea con Redsys (octubre de 2026).
//
// La firma se prueba sola: la que se manda al banco y la de su aviso, que no
// admite otro pedido ni un dato cambiado. Con la base, el camino entero: el
// hermano empieza el pago, el banco avisa por la ruta de verdad (en
// formulario, sin sesión) y el recibo queda pagado una sola vez aunque el
// aviso se repita. Lo que ya no cuadra queda como incidencia para Tesorería.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoPago, EstadoPagoEnLinea, Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import {
  configuracionRedsys, firmar, formularioDePago, leerAviso, modoDePago, numeroDePedido, pagoParaLaWeb,
} from '../src/domain/redsys.js';
import { PagoEnLineaService } from '../src/services/pagos/pago-en-linea.service.js';
import { ZonasService } from '../src/services/procesion/zonas.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const PRUEBAS = configuracionRedsys({});

/** Un aviso como los de Redsys: parámetros en base64 y firma en base64 «de URL». */
function aviso(datos: Record<string, string>, clave = PRUEBAS.clave) {
  const parametros = Buffer.from(JSON.stringify(datos)).toString('base64');
  const firma = firmar(parametros, datos.Ds_Order, clave).replace(/\+/g, '-').replace(/\//g, '_');
  return { Ds_SignatureVersion: 'HMAC_SHA256_V1', Ds_MerchantParameters: parametros, Ds_Signature: firma };
}

describe('la firma de Redsys', () => {
  test('el aviso firmado con la clave del comercio se lee; cambiado o de otra clave, no', () => {
    const bueno = aviso({ Ds_Order: '00000042AB7Z', Ds_Amount: '3000', Ds_Response: '0000', Ds_AuthorisationCode: '123456' });
    assert.deepEqual(leerAviso(bueno, PRUEBAS.clave), { pedido: '00000042AB7Z', centimos: 3000, respuesta: '0000', autorizacion: '123456', cobrado: true });

    const otroImporte = { ...bueno, Ds_MerchantParameters: aviso({ Ds_Order: '00000042AB7Z', Ds_Amount: '1', Ds_Response: '0000' }).Ds_MerchantParameters };
    assert.equal(leerAviso(otroImporte, PRUEBAS.clave), null, 'los datos cambiados no casan con la firma');
    const otraClave = aviso({ Ds_Order: '00000042AB7Z', Ds_Amount: '3000', Ds_Response: '0000' }, Buffer.alloc(24, 7).toString('base64'));
    assert.equal(leerAviso(otraClave, PRUEBAS.clave), null, 'firmado con otra clave no es del banco');
    assert.equal(leerAviso({ Ds_MerchantParameters: 'no-es-json', Ds_Signature: 'x' }, PRUEBAS.clave), null);
    assert.equal(leerAviso({}, PRUEBAS.clave), null);
  });

  // La ruta del aviso es pública: lo que no se pueda leer es «no es del
  // banco» (null), nunca una excepción que salga como 500.
  test('un aviso con escapes rotos o que no es un objeto se descarta sin lanzar', () => {
    const roto = aviso({ Ds_Order: '%E0%A4%A', Ds_Amount: '3000', Ds_Response: '0000' });
    assert.equal(leerAviso(roto, PRUEBAS.clave), null);
    const autorizacionRota = aviso({ Ds_Order: '00000042AB7Z', Ds_Amount: '3000', Ds_Response: '0000', Ds_AuthorisationCode: '%' });
    assert.equal(leerAviso(autorizacionRota, PRUEBAS.clave)?.autorizacion, null);
    for (const json of ['null', '42', '"texto"', '[]']) {
      assert.equal(leerAviso({ Ds_MerchantParameters: Buffer.from(json).toString('base64'), Ds_Signature: 'x' }, PRUEBAS.clave), null, json);
    }
  });

  test('solo de 0000 a 0099 es cobrado', () => {
    const con = (r: string) => leerAviso(aviso({ Ds_Order: '00000001ABCD', Ds_Amount: '100', Ds_Response: r }), PRUEBAS.clave)?.cobrado;
    assert.equal(con('0000'), true);
    assert.equal(con('0099'), true);
    assert.equal(con('0190'), false);
    assert.equal(con('9915'), false, 'cancelado por el titular');
  });

  test('la firma del formulario es la del pedido y el importe va en céntimos', () => {
    const f = formularioDePago({ pedido: '00000042AB7Z', centimos: 1250, metodo: 'BIZUM', descripcion: 'Cuota 2026', urlAviso: 'https://x/aviso', urlVuelta: 'https://x/vuelta', urlFallo: 'https://x/fallo' }, PRUEBAS);
    const datos = JSON.parse(Buffer.from(f.campos.Ds_MerchantParameters, 'base64').toString()) as Record<string, string>;
    assert.equal(datos.DS_MERCHANT_AMOUNT, '1250');
    assert.equal(datos.DS_MERCHANT_PAYMETHODS, 'z');
    assert.equal(f.campos.Ds_Signature, firmar(f.campos.Ds_MerchantParameters, '00000042AB7Z', PRUEBAS.clave));
    assert.notEqual(f.campos.Ds_Signature, firmar(f.campos.Ds_MerchantParameters, '00000043AB7Z', PRUEBAS.clave), 'la firma va atada al pedido');
  });

  test('el número de pedido: 12 caracteres y los 4 primeros, cifras', () => {
    assert.match(numeroDePedido(42), /^00000042[A-Z0-9]{4}$/);
    assert.match(numeroDePedido(123456789), /^\d{8}[A-Z0-9]{4}$/);
  });

  test('el modo: apagado en producción si no se enciende; el entorno real exige claves', () => {
    assert.equal(modoDePago({ NODE_ENV: 'production' }), null);
    assert.equal(modoDePago({ NODE_ENV: 'development' }), 'simulado');
    assert.equal(modoDePago({ NODE_ENV: 'production', PAGO_EN_LINEA: 'redsys' }), 'redsys');
    assert.throws(() => configuracionRedsys({ REDSYS_ENTORNO: 'real' }), /REDSYS_COMERCIO/);
    assert.deepEqual(pagoParaLaWeb({ PAGO_EN_LINEA: 'redsys', REDSYS_BIZUM: 'si' }), { metodos: ['TARJETA', 'BIZUM'], pruebas: true });
    assert.equal(pagoParaLaWeb({ NODE_ENV: 'production' }), null);
  });
});

let dbDisponible = false;
let server: Server;
let baseUrl: string;
// El .env del equipo puede tener sus propias claves o Bizum encendido: las
// pruebas van con las públicas de Redsys y sin Bizum, sea cual sea.
const VARIABLES = ['PAGO_EN_LINEA', 'REDSYS_ENTORNO', 'REDSYS_COMERCIO', 'REDSYS_TERMINAL', 'REDSYS_CLAVE', 'REDSYS_BIZUM'] as const;
const previas = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  for (const v of VARIABLES) delete process.env[v];
  process.env.PAGO_EN_LINEA = 'redsys';
});

after(async () => {
  for (const v of VARIABLES) {
    if (previas[v] === undefined) delete process.env[v];
    else process.env[v] = previas[v];
  }
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

/** Un hermano con su cuota pendiente. Todo se borra al terminar. */
async function escenario() {
  const usuario = await crearUsuarioPrueba(Role.USER);
  const marca = Date.now().toString(36);
  const hermano = await db.hermano.create({
    data: { userId: usuario.id, nombre: 'Rafael', apellidos: `Pago${marca} Luque`, fechaNacimiento: new Date(Date.UTC(1980, 1, 3)), activo: true, esTitular: true },
  });
  const cuota = (concepto: string, importe = 30) => db.recibo.create({
    data: { hermanoId: hermano.id, year: 2026, concepto: `${concepto} ${marca}`, importe, tipo: 'CUOTA_HERMANO' },
  });
  const recoger = async () => {
    const pagos = await db.pagoEnLinea.findMany({ where: { userId: usuario.id }, select: { pedido: true } });
    await db.operacionMesa.deleteMany({ where: { clave: { in: pagos.map((p) => `redsys-${p.pedido}`) } } });
    await db.pagoEnLinea.deleteMany({ where: { userId: usuario.id } });
    await db.auditLog.deleteMany({ where: { userId: usuario.id } });
    await db.transaccion.deleteMany({ where: { hermanoId: hermano.id } });
    await db.recibo.deleteMany({ where: { hermanoId: hermano.id } });
    await db.hermano.delete({ where: { id: hermano.id } });
    await borrarUsuarioPrueba(usuario.id);
  };
  return { usuario, hermano, cuota, recoger };
}

/** El aviso, por la ruta de verdad: en formulario y sin sesión, como lo manda el banco. */
const avisar = (campos: Record<string, string>) => fetch(`${baseUrl}/api/pagos/redsys/notificacion`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(campos).toString(),
});

async function empezar(userId: number, reciboIds: number[]) {
  const inicio = await PagoEnLineaService.iniciar(userId, { reciboIds, solicitudIds: [], metodo: 'TARJETA' }, undefined);
  assert.equal(inicio.tipo, 'banco');
  if (inicio.tipo !== 'banco') throw new Error('inalcanzable');
  return inicio;
}

test('el banco avisa del cobro: el recibo queda pagado una sola vez', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const recibo = await e.cuota('Cuota prueba');
    const inicio = await empezar(e.usuario.id, [recibo.id]);
    assert.equal(inicio.url, 'https://sis-t.redsys.es:25443/sis/realizarPago');
    const datos = JSON.parse(Buffer.from(inicio.campos.Ds_MerchantParameters, 'base64').toString()) as Record<string, string>;
    assert.equal(datos.DS_MERCHANT_AMOUNT, '3000', 'el importe lo calcula el servidor');
    assert.match(datos.DS_MERCHANT_URLOK, new RegExp(`/area-hermano/procesion\\?pago=${inicio.pedido}$`));
    assert.match(datos.DS_MERCHANT_URLKO, new RegExp(`/area-hermano/procesion\\?pago=${inicio.pedido}&resultado=no$`), 'sin pago vuelve diciéndolo');
    assert.equal((await PagoEnLineaService.estado(e.usuario.id, inicio.pedido)).estado, EstadoPagoEnLinea.PENDIENTE);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: recibo.id } })).estado, EstadoPago.PENDIENTE, 'empezar no paga nada');

    // Un aviso con la firma rota no toca nada.
    const falso = aviso({ Ds_Order: inicio.pedido, Ds_Amount: '3000', Ds_Response: '0000' }, Buffer.alloc(24, 1).toString('base64'));
    assert.equal((await avisar(falso)).status, 400);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: recibo.id } })).estado, EstadoPago.PENDIENTE);

    const bueno = aviso({ Ds_Order: inicio.pedido, Ds_Amount: '3000', Ds_Response: '0000', Ds_AuthorisationCode: '654321' });
    assert.equal((await avisar(bueno)).status, 200);
    assert.equal((await avisar(bueno)).status, 200, 'el banco puede repetir el aviso');

    const pagado = await db.recibo.findUniqueOrThrow({ where: { id: recibo.id } });
    assert.equal(pagado.estado, EstadoPago.PAGADO);
    assert.equal(pagado.metodoPago, 'TARJETA');
    assert.equal(await db.transaccion.count({ where: { reciboId: recibo.id } }), 1, 'un solo apunte aunque avise dos veces');
    const pago = await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: inicio.pedido } });
    assert.equal(pago.estado, EstadoPagoEnLinea.PAGADO);
    assert.equal(pago.autorizacion, '654321');

    // Otro usuario no ve ese pago.
    const otro = await crearUsuarioPrueba(Role.USER);
    try {
      await assert.rejects(PagoEnLineaService.estado(otro.id, inicio.pedido), /No se encontró ese pago/);
    } finally {
      await borrarUsuarioPrueba(otro.id);
    }
  } finally {
    await e.recoger();
  }
});

test('denegado: no se paga nada; si ya no cuadra, incidencia para Tesorería', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    // La tarjeta denegada.
    const denegada = await e.cuota('Cuota denegada');
    const i1 = await empezar(e.usuario.id, [denegada.id]);
    await avisar(aviso({ Ds_Order: i1.pedido, Ds_Amount: '3000', Ds_Response: '0190' }));
    assert.equal((await PagoEnLineaService.estado(e.usuario.id, i1.pedido)).estado, EstadoPagoEnLinea.RECHAZADO);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: denegada.id } })).estado, EstadoPago.PENDIENTE);

    // Pagada en Secretaría mientras el hermano estaba en el banco.
    const doble = await e.cuota('Cuota doble');
    const i2 = await empezar(e.usuario.id, [doble.id]);
    await db.recibo.update({ where: { id: doble.id }, data: { estado: EstadoPago.PAGADO, metodoPago: 'EFECTIVO', fechaPago: new Date() } });
    assert.equal((await avisar(aviso({ Ds_Order: i2.pedido, Ds_Amount: '3000', Ds_Response: '0000' }))).status, 200);
    assert.equal((await PagoEnLineaService.estado(e.usuario.id, i2.pedido)).estado, EstadoPagoEnLinea.INCIDENCIA);

    // El banco cobra otro importe.
    const otra = await e.cuota('Cuota importe');
    const i3 = await empezar(e.usuario.id, [otra.id]);
    await avisar(aviso({ Ds_Order: i3.pedido, Ds_Amount: '2999', Ds_Response: '0000' }));
    assert.equal((await PagoEnLineaService.estado(e.usuario.id, i3.pedido)).estado, EstadoPagoEnLinea.INCIDENCIA);
    assert.equal((await db.recibo.findUniqueOrThrow({ where: { id: otra.id } })).estado, EstadoPago.PENDIENTE);

    const incidencias = (await PagoEnLineaService.incidencias()).filter((x) => x.pedido === i2.pedido || x.pedido === i3.pedido);
    assert.equal(incidencias.length, 2);
    assert.match(incidencias.find((x) => x.pedido === i2.pedido)!.motivo!, /no está pendiente de pago/);
    assert.match(incidencias.find((x) => x.pedido === i3.pedido)!.motivo!, /cobró 29,99|cobró 29.99/);

    const pago = await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: i2.pedido } });
    await PagoEnLineaService.resolver(pago.id, { userId: e.usuario.id });
    assert.equal((await PagoEnLineaService.incidencias()).some((x) => x.pedido === i2.pedido), false, 'resuelta, deja de salir');
    await assert.rejects(PagoEnLineaService.resolver(pago.id, { userId: e.usuario.id }), /ya está resuelta/);

    // Lo que ya está pagado no se puede volver a empezar.
    await assert.rejects(PagoEnLineaService.iniciar(e.usuario.id, { reciboIds: [doble.id], solicitudIds: [], metodo: 'TARJETA' }, undefined), /no está pendiente de pago/);
    // Sin Bizum contratado, no se ofrece.
    await assert.rejects(PagoEnLineaService.iniciar(e.usuario.id, { reciboIds: [denegada.id], solicitudIds: [], metodo: 'BIZUM' }, undefined), /Bizum no está disponible/);
  } finally {
    await e.recoger();
  }
});

// Un recibo devuelto se cobra emitiendo su reemisión, y eso solo una vez. Antes
// cada cobro emitía una reemisión nueva: con el pago en línea empezado y la
// cuota cobrada en la mesa mientras tanto, el aviso del banco la volvía a
// cobrar («(reemisión 2)», con su ingreso). Ahora el aviso acaba en incidencia.
test('un devuelto ya reemitido no se vuelve a cobrar: el aviso del banco queda como incidencia', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const devuelto = await e.cuota('Cuota devuelta');
    await db.recibo.update({ where: { id: devuelto.id }, data: { estado: EstadoPago.DEVUELTO } });
    const inicio = await empezar(e.usuario.id, [devuelto.id]);

    // Mientras el hermano está en el banco, se cobra en la mesa.
    await ZonasService.cobrar({ hermanoId: e.hermano.id, reciboIds: [devuelto.id], metodoPago: 'EFECTIVO' }, undefined);
    const reemisiones = () => db.recibo.count({ where: { hermanoId: e.hermano.id, concepto: { contains: 'reemisión' } } });
    assert.equal(await reemisiones(), 1);

    assert.equal((await avisar(aviso({ Ds_Order: inicio.pedido, Ds_Amount: '3000', Ds_Response: '0000' }))).status, 200);
    assert.equal((await PagoEnLineaService.estado(e.usuario.id, inicio.pedido)).estado, EstadoPagoEnLinea.INCIDENCIA);
    assert.equal(await reemisiones(), 1, 'sin una segunda reemisión');
    assert.equal(await db.transaccion.count({ where: { hermanoId: e.hermano.id } }), 1, 'un solo ingreso');

    // Ni la mesa ni el área de hermanos lo vuelven a cobrar, ni se perdona otra vez.
    await assert.rejects(
      ZonasService.cobrar({ hermanoId: e.hermano.id, reciboIds: [devuelto.id], metodoPago: 'EFECTIVO' }, undefined),
      (err: { status?: number; message: string }) => err.status === 409 && /ya se volvió a emitir/.test(err.message),
    );
    await assert.rejects(PagoEnLineaService.iniciar(e.usuario.id, { reciboIds: [devuelto.id], solicitudIds: [], metodo: 'TARJETA' }, undefined), /ya se volvió a emitir/);
    await assert.rejects(ZonasService.perdonar({ reciboIds: [devuelto.id] }, undefined), /ya se volvió a emitir/);
    assert.equal(await reemisiones(), 1);
  } finally {
    await e.recoger();
  }
});
