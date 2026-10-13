// La tienda contra MariaDB: comprar sin cuenta con el pago simulado y con
// Redsys (el aviso firmado es lo único que da el pedido por pagado), las
// existencias, el apunte en contabilidad, lo que queda como incidencia y la
// gestión desde el CMS. Cada prueba crea sus productos y los recoge.

import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Prisma, Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { HttpError } from '../src/utils/error.handle.js';
import { configuracionRedsys, firmar } from '../src/domain/redsys.js';
import { TiendaService } from '../src/services/tienda.service.js';
import { PagoEnLineaService } from '../src/services/pagos/pago-en-linea.service.js';
import { TransaccionService } from '../src/services/transaccion.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const PRUEBAS = configuracionRedsys({});
let dbDisponible = false;
let server: Server;
let baseUrl: string;
const VARIABLES = ['PAGO_EN_LINEA', 'REDSYS_ENTORNO', 'REDSYS_COMERCIO', 'REDSYS_TERMINAL', 'REDSYS_CLAVE', 'REDSYS_BIZUM'] as const;
const previas = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));

function aviso(datos: Record<string, string>) {
  const parametros = Buffer.from(JSON.stringify(datos)).toString('base64');
  const firma = firmar(parametros, datos.Ds_Order, PRUEBAS.clave).replace(/\+/g, '-').replace(/\//g, '_');
  return { Ds_SignatureVersion: 'HMAC_SHA256_V1', Ds_MerchantParameters: parametros, Ds_Signature: firma };
}

before(async () => {
  for (const v of VARIABLES) delete process.env[v];
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  for (const v of VARIABLES) {
    if (previas[v] === undefined) delete process.env[v];
    else process.env[v] = previas[v];
  }
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

async function escenario() {
  const marca = `Prueba${Date.now()}`;
  const medalla = await db.producto.create({ data: { nombre: `Medalla ${marca}`, precio: '15.00', existencias: 2 } });
  const estampa = await db.producto.create({ data: { nombre: `Estampa ${marca}`, precio: '1.50', existencias: null } });
  const recoger = async () => {
    const pedidos = await db.pedidoTienda.findMany({ where: { nombre: marca }, select: { id: true } });
    const ids = pedidos.map((p) => p.id);
    await db.transaccion.deleteMany({ where: { concepto: { in: ids.flatMap((id) => [`Tienda: pedido n.º ${id}`, `Tienda: reembolso del pedido n.º ${id}`]) } } });
    await db.pagoEnLinea.deleteMany({ where: { origen: 'TIENDA', referenciaId: { in: ids } } });
    await db.auditLog.deleteMany({ where: { OR: [{ entityType: 'pedido', entityId: { in: ids.map(String) } }, { action: 'EMAIL_FALLIDO', createdAt: { gte: new Date(Date.now() - 120_000) } }] } });
    await db.pedidoTienda.deleteMany({ where: { id: { in: ids } } });
    await db.producto.deleteMany({ where: { id: { in: [medalla.id, estampa.id] } } });
  };
  const compra = (lineas: { productoId: number; tallaId?: number; cantidad: number }[]) => ({ nombre: marca, email: 'comprador@ejemplo.test', telefono: '600000000', metodo: 'TARJETA' as const, lineas });
  return { marca, medalla, estampa, compra, recoger };
}

test('con el pago simulado, el pedido se paga en el acto: existencias, contabilidad y estado', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'simulado';
  const e = await escenario();
  try {
    const r = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }, { productoId: e.estampa.id, cantidad: 3 }]), {});
    assert.equal(r.tipo, 'hecho');
    const pedido = await TiendaService.pedidoPublico(r.token);
    assert.equal(pedido.estado, 'PAGADO');
    assert.equal(pedido.total, 19.5);
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.medalla.id } })).existencias, 1);
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.estampa.id } })).existencias, null, 'sin límite sigue sin límite');
    const apunte = await db.transaccion.findFirstOrThrow({ where: { concepto: `Tienda: pedido n.º ${pedido.numero}` }, include: { categoria: true } });
    assert.equal(Number(apunte.importe), 19.5);
    assert.equal(apunte.categoria.nombre, 'Ventas de la tienda');
    // El pedido guarda su apunte, y la contabilidad no lo trata como manual.
    assert.equal((await db.pedidoTienda.findUniqueOrThrow({ where: { id: pedido.numero } })).transaccionId, apunte.id);
    await assert.rejects(TransaccionService.remove(apunte.id), (err: unknown) => err instanceof HttpError && err.status === 409 && /pedido de la tienda/.test(err.message));

    await assert.rejects(TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 2 }]), {}), (err: unknown) => err instanceof HttpError && /solo quedan 1/.test(err.message));

    await TiendaService.entregar(pedido.numero, {});
    assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'ENTREGADO');
    await assert.rejects(TiendaService.entregar(pedido.numero, {}), (err: unknown) => err instanceof HttpError && err.status === 409);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('con Redsys, solo el aviso firmado lo da por pagado; sin existencias, queda como incidencia', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'redsys';
  const e = await escenario();
  try {
    const r = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 2 }]), {});
    assert.equal(r.tipo, 'banco');
    if (r.tipo !== 'banco') return;
    assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'PENDIENTE_PAGO');

    // Otro pedido se lleva las dos medallas antes de que llegue el aviso del primero.
    const otro = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 2 }]), {});
    if (otro.tipo !== 'banco') return;
    assert.ok(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: otro.pedido, Ds_Amount: '3000', Ds_Response: '0000', Ds_AuthorisationCode: '111111' }), {}));
    assert.equal((await TiendaService.pedidoPublico(otro.token)).estado, 'PAGADO');
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.medalla.id } })).existencias, 0);

    assert.ok(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: r.pedido, Ds_Amount: '3000', Ds_Response: '0000', Ds_AuthorisationCode: '222222' }), {}));
    assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'PENDIENTE_PAGO');
    const pago = await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: r.pedido } });
    assert.equal(pago.estado, 'INCIDENCIA');
    assert.match(pago.motivo ?? '', /se agotó mientras se pagaba/);
    const incidencia = (await PagoEnLineaService.incidencias()).find((i) => i.pedido === r.pedido);
    assert.equal(incidencia?.correo, 'comprador@ejemplo.test');
    // De la tienda, y se puede anular al resolverla.
    assert.equal(incidencia?.origen, 'TIENDA');
    assert.equal(incidencia?.anulable, true);

    // Un aviso repetido del pedido pagado no cobra dos veces.
    assert.ok(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: otro.pedido, Ds_Amount: '3000', Ds_Response: '0000' }), {}));
    const numeroOtro = (await TiendaService.pedidoPublico(otro.token)).numero;
    assert.equal(await db.transaccion.count({ where: { concepto: `Tienda: pedido n.º ${numeroOtro}` } }), 1);

    // Dos avisos del mismo pedido a la vez: uno lo cobra y el otro es el repetido, sin incidencia falsa.
    await db.producto.update({ where: { id: e.medalla.id }, data: { existencias: 5 } });
    const doble = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }]), {});
    if (doble.tipo !== 'banco') return;
    const avisoDoble = aviso({ Ds_Order: doble.pedido, Ds_Amount: '1500', Ds_Response: '0000', Ds_AuthorisationCode: '333333' });
    await Promise.all([PagoEnLineaService.avisoDelBanco(avisoDoble, {}), PagoEnLineaService.avisoDelBanco(avisoDoble, {})]);
    assert.equal((await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: doble.pedido } })).estado, 'PAGADO');
    assert.equal((await TiendaService.pedidoPublico(doble.token)).estado, 'PAGADO');
    const numeroDoble = (await TiendaService.pedidoPublico(doble.token)).numero;
    assert.equal(await db.transaccion.count({ where: { concepto: `Tienda: pedido n.º ${numeroDoble}` } }), 1);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('NG2: dos avisos a la vez de pedidos del mismo producto se aplican los dos (el choque se reintenta)', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'redsys';
  const e = await escenario();
  try {
    await db.producto.update({ where: { id: e.medalla.id }, data: { existencias: 5 } });
    const pedidos = await Promise.all([1, 2, 3].map(() => TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }]), {})));
    await Promise.all(pedidos.map((p, i) => p.tipo === 'banco'
      ? PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: p.pedido, Ds_Amount: '1500', Ds_Response: '0000', Ds_AuthorisationCode: `44444${i}` }), {})
      : null));
    for (const p of pedidos) {
      assert.equal((await TiendaService.pedidoPublico(p.token)).estado, 'PAGADO');
      if (p.tipo === 'banco') assert.equal((await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: p.pedido } })).estado, 'PAGADO');
    }
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.medalla.id } })).existencias, 2);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

/** Un error de Prisma con su código, como los que llegan de la base. */
const errorDePrisma = (code: string) => new Prisma.PrismaClientKnownRequestError(`fallo ${code} provocado por la prueba`, { code, clientVersion: 'prueba' });

/**
 * Hace fallar las `veces` primeras transacciones Serializable (las de los
 * aplicadores) con `error`; las demás van a la base de verdad. Así el choque
 * entre dos avisos se provoca siempre, en vez de esperar a que dos avisos en
 * paralelo choquen o no según la máquina.
 */
function forzarFallos(veces: number, error: () => Error) {
  const real = db.$transaction.bind(db) as (...a: unknown[]) => Promise<unknown>;
  let quedan = veces;
  const llamadas = { serializables: 0 };
  // `$transaction` sale del proxy del cliente, no de su prototipo, y
  // `mock.method` no lo encuentra: se cambia a mano y se devuelve igual.
  const cliente = db as unknown as { $transaction: unknown };
  const original = cliente.$transaction;
  cliente.$transaction = (...args: unknown[]) => {
    const opciones = args[1] as { isolationLevel?: string } | undefined;
    if (typeof args[0] === 'function' && opciones?.isolationLevel === Prisma.TransactionIsolationLevel.Serializable) {
      llamadas.serializables += 1;
      if (quedan > 0) { quedan -= 1; return Promise.reject(error()); }
    }
    return real(...args);
  };
  return { llamadas, restaurar: () => { cliente.$transaction = original; } };
}

test('NG2: el choque al aplicar el pago se reintenta (forzado: la primera transacción choca)', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'redsys';
  const e = await escenario();
  try {
    const r = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }]), {});
    if (r.tipo !== 'banco') return assert.fail('esperaba ir al banco');
    const choque = forzarFallos(1, () => errorDePrisma('P2034'));
    try {
      assert.ok(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: r.pedido, Ds_Amount: '1500', Ds_Response: '0000', Ds_AuthorisationCode: '454545' }), {}));
    } finally {
      choque.restaurar();
    }
    assert.equal(choque.llamadas.serializables, 2, 'el primer intento chocó y el segundo lo aplicó');
    assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'PAGADO');
    assert.equal((await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: r.pedido } })).estado, 'PAGADO');
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.medalla.id } })).existencias, 1);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('R2: un choque que agota los reintentos o la base caída dejan el pago pendiente, y el reenvío del banco lo aplica', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'redsys';
  const e = await escenario();
  try {
    for (const [i, codigo] of ['P2034', 'P1001'].entries()) {
      const r = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }]), {});
      if (r.tipo !== 'banco') return assert.fail('esperaba ir al banco');
      const avisoPagado = aviso({ Ds_Order: r.pedido, Ds_Amount: '1500', Ds_Response: '0000', Ds_AuthorisationCode: `46464${i}` });
      const caida = forzarFallos(Infinity, () => errorDePrisma(codigo));
      try {
        await assert.rejects(PagoEnLineaService.avisoDelBanco(avisoPagado, {}), (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === codigo);
      } finally {
        caida.restaurar();
      }
      assert.equal((await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: r.pedido } })).estado, 'PENDIENTE', `${codigo}: sin incidencia`);
      assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'PENDIENTE_PAGO');

      assert.ok(await PagoEnLineaService.avisoDelBanco(avisoPagado, {}));
      assert.equal((await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: r.pedido } })).estado, 'PAGADO', `${codigo}: el reenvío lo aplica`);
      assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'PAGADO');
    }
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.medalla.id } })).existencias, 0);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('R2: cualquier otro error al aplicar queda como incidencia y se responde al banco sin error', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'redsys';
  const e = await escenario();
  const errores = mock.method(console, 'error', () => {});
  try {
    const r = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }]), {});
    if (r.tipo !== 'banco') return assert.fail('esperaba ir al banco');
    const raro = forzarFallos(1, () => new TypeError('algo que no se esperaba'));
    try {
      assert.equal(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: r.pedido, Ds_Amount: '1500', Ds_Response: '0000', Ds_AuthorisationCode: '474747' }), {}), true);
    } finally {
      raro.restaurar();
    }
    const pago = await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: r.pedido } });
    assert.equal(pago.estado, 'INCIDENCIA');
    assert.match(pago.motivo ?? '', /error del servidor/);
    assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'PENDIENTE_PAGO');
  } finally {
    errores.mock.restore();
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('R3: el pago se cierra en la misma transacción que el pedido: si falla cerrarlo, no queda nada a medias y el reenvío lo aplica', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'redsys';
  const e = await escenario();
  try {
    const r = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }]), {});
    if (r.tipo !== 'banco') return assert.fail('esperaba ir al banco');
    const avisoPagado = aviso({ Ds_Order: r.pedido, Ds_Amount: '1500', Ds_Response: '0000', Ds_AuthorisationCode: '555555' });
    // La base se corta justo al cerrar el pago: antes, el pedido ya estaba
    // pagado y el pago se quedaba PENDIENTE para siempre.
    const falla = mock.method(PagoEnLineaService, 'marcarPagado', async () => { throw errorDePrisma('P1017'); });
    try {
      await assert.rejects(PagoEnLineaService.avisoDelBanco(avisoPagado, {}), /P1017/);
    } finally {
      falla.mock.restore();
    }
    assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'PENDIENTE_PAGO', 'nada a medias');
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.medalla.id } })).existencias, 2);
    assert.equal((await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: r.pedido } })).estado, 'PENDIENTE');

    assert.ok(await PagoEnLineaService.avisoDelBanco(avisoPagado, {}));
    assert.equal((await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: r.pedido } })).estado, 'PAGADO', 'sin incidencia falsa');
    assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'PAGADO');
    assert.equal(await db.transaccion.count({ where: { concepto: `Tienda: pedido n.º ${(await TiendaService.pedidoPublico(r.token)).numero}` } }), 1);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('NG18: si se borra la talla con el pedido en el banco, el aviso queda como incidencia', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'redsys';
  const e = await escenario();
  try {
    await TiendaService.actualizarProducto(e.medalla.id, { nombre: e.medalla.nombre, descripcion: '', precio: 15, foto: null, existencias: null, activo: true, orden: 0, tallas: [{ nombre: 'M', existencias: 3 }] });
    const m = await db.tallaProducto.findFirstOrThrow({ where: { productoId: e.medalla.id } });
    const r = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, tallaId: m.id, cantidad: 1 }]), {});
    if (r.tipo !== 'banco') return assert.fail('esperaba ir al banco');
    await TiendaService.actualizarProducto(e.medalla.id, { nombre: e.medalla.nombre, descripcion: '', precio: 15, foto: null, existencias: null, activo: true, orden: 0, tallas: [{ nombre: 'L', existencias: 3 }] });

    assert.ok(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: r.pedido, Ds_Amount: '1500', Ds_Response: '0000', Ds_AuthorisationCode: '666666' }), {}));
    assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'PENDIENTE_PAGO');
    const pago = await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: r.pedido } });
    assert.equal(pago.estado, 'INCIDENCIA');
    assert.match(pago.motivo ?? '', /talla M .* ya no está a la venta/);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('NG9: si el banco no lo cobra, el pedido se cancela y ya no ata al producto', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'redsys';
  const e = await escenario();
  try {
    const r = await TiendaService.comprar(e.compra([{ productoId: e.estampa.id, cantidad: 1 }]), {});
    if (r.tipo !== 'banco') return assert.fail('esperaba ir al banco');
    assert.ok(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: r.pedido, Ds_Amount: '150', Ds_Response: '0190' }), {}));
    assert.equal((await TiendaService.pedidoPublico(r.token)).estado, 'CANCELADO');
    assert.equal((await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: r.pedido } })).estado, 'RECHAZADO');
    assert.equal((await TiendaService.borrarProducto(e.estampa.id)).message, 'Producto borrado.');
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('NG8: un pedido cobrado y entregado se anula: vuelven las existencias y queda el reembolso', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'simulado';
  const e = await escenario();
  try {
    const r = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }, { productoId: e.estampa.id, cantidad: 2 }]), {});
    const { numero } = await TiendaService.pedidoPublico(r.token);
    await TiendaService.entregar(numero, {});
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.medalla.id } })).existencias, 1);

    assert.match((await TiendaService.anular(numero, {}, { puedeReembolsar: true })).message, /reembolso/);
    const pedido = await TiendaService.pedidoPublico(r.token);
    assert.equal(pedido.estado, 'CANCELADO');
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.medalla.id } })).existencias, 2, 'la medalla vuelve');
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.estampa.id } })).existencias, null, 'sin límite sigue sin límite');

    // El ingreso se queda y el reembolso es un gasto enlazado, que no se toca a mano.
    const fila = await db.pedidoTienda.findUniqueOrThrow({ where: { id: numero }, include: { reembolso: { include: { categoria: true } } } });
    assert.ok(fila.canceladoEl);
    assert.equal(fila.reembolso?.tipo, 'GASTO');
    assert.equal(Number(fila.reembolso?.importe), 18);
    assert.equal(fila.reembolso?.categoria.nombre, 'Reembolsos de la tienda');
    assert.equal(await db.transaccion.count({ where: { concepto: `Tienda: pedido n.º ${numero}` } }), 1);
    await assert.rejects(TransaccionService.remove(fila.reembolsoId!), (err: unknown) => err instanceof HttpError && err.status === 409);

    await assert.rejects(TiendaService.anular(numero, {}, { puedeReembolsar: true }), (err: unknown) => err instanceof HttpError && err.status === 409);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('R5: anular un pedido cobrado (deja un reembolso en Contabilidad) es de Tesorería; uno sin cobrar, de quien lleva la tienda', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'simulado';
  const e = await escenario();
  const secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  const anular = (id: number, quien: { id: number }, rol: Role) => fetch(`${baseUrl}/api/tienda/admin/pedidos/${id}/anular`, {
    method: 'POST', headers: { Cookie: `${COOKIE_CMS}=${generateToken(quien.id, rol)}` },
  });
  try {
    const { token } = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }]), {});
    const cobrado = await TiendaService.pedidoPublico(token);
    const res = await anular(cobrado.numero, secretaria, Role.SECRETARIA);
    assert.equal(res.status, 403);
    const cuerpo = await res.json() as { error: string; soloTesoreria?: boolean };
    assert.equal(cuerpo.soloTesoreria, true);
    assert.match(cuerpo.error, /Tesorería/);
    const intacto = await db.pedidoTienda.findUniqueOrThrow({ where: { id: cobrado.numero } });
    assert.equal(intacto.estado, 'PAGADO', 'no se anula');
    assert.equal(intacto.reembolsoId, null, 'ni se apunta el reembolso');
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.medalla.id } })).existencias, 1);

    assert.equal((await anular(cobrado.numero, tesorero, Role.TESORERIA)).status, 200);
    assert.equal((await TiendaService.pedidoPublico(token)).estado, 'CANCELADO');

    // Sin cobrar no hay reembolso: lo sigue pudiendo anular Secretaría.
    process.env.PAGO_EN_LINEA = 'redsys';
    const sinCobrar = await TiendaService.comprar(e.compra([{ productoId: e.estampa.id, cantidad: 1 }]), {});
    const numero = (await TiendaService.pedidoPublico(sinCobrar.token)).numero;
    assert.equal((await anular(numero, secretaria, Role.SECRETARIA)).status, 200);
    assert.equal((await TiendaService.pedidoPublico(sinCobrar.token)).estado, 'CANCELADO');
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await borrarUsuarioPrueba(secretaria.id);
    await borrarUsuarioPrueba(tesorero.id);
    await e.recoger();
  }
});

test('NG8: el pedido cobrado con incidencia lo dice, sale en la lista y se anula al resolverla', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'redsys';
  const e = await escenario();
  try {
    await db.producto.update({ where: { id: e.medalla.id }, data: { existencias: 1 } });
    const r = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }]), {});
    if (r.tipo !== 'banco') return assert.fail('esperaba ir al banco');
    assert.equal((await TiendaService.pedidoPublico(r.token)).pagoConIncidencia, false);
    // Se vende la última en Secretaría antes de que llegue el aviso.
    await db.producto.update({ where: { id: e.medalla.id }, data: { existencias: 0 } });
    assert.ok(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: r.pedido, Ds_Amount: '1500', Ds_Response: '0000', Ds_AuthorisationCode: '777777' }), {}));

    const pedido = await TiendaService.pedidoPublico(r.token);
    assert.deepEqual([pedido.estado, pedido.pagoConIncidencia], ['PENDIENTE_PAGO', true]);
    const enLista = (await TiendaService.pedidos()).find((p) => p.id === pedido.numero);
    assert.equal(enLista?.pagoConIncidencia, true, 'sale en la lista aunque no se pagó');

    const pago = await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: r.pedido } });
    await PagoEnLineaService.resolver(pago.id, {}, { anular: true });
    const anulado = await TiendaService.pedidoPublico(r.token);
    assert.deepEqual([anulado.estado, anulado.pagoConIncidencia], ['CANCELADO', false]);
    assert.equal((await db.pedidoTienda.findUniqueOrThrow({ where: { id: anulado.numero } })).reembolsoId, null, 'nunca entró en Contabilidad: sin reembolso');
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: e.medalla.id } })).existencias, 0, 'no se descontó, no vuelve');
    assert.ok((await db.pagoEnLinea.findUniqueOrThrow({ where: { id: pago.id } })).resueltaEl);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('la tienda pública sin sesión, la gestión solo con la del CMS', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'simulado';
  const e = await escenario();
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    const catalogo = await (await fetch(`${baseUrl}/api/tienda`)).json() as { productos: { id: number }[]; pagoDisponible: boolean };
    assert.ok(catalogo.productos.some((p) => p.id === e.medalla.id));
    assert.equal(catalogo.pagoDisponible, true);

    const res = await fetch(`${baseUrl}/api/tienda/pedidos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e.compra([{ productoId: e.estampa.id, cantidad: 2 }])) });
    assert.equal(res.status, 201);
    const { token } = await res.json() as { token: string };
    const pedido = await (await fetch(`${baseUrl}/api/tienda/pedidos/${token}`)).json() as Record<string, unknown>;
    assert.equal(pedido.estado, 'PAGADO');
    assert.equal(pedido.email, undefined, 'el enlace del pedido no enseña el correo');

    assert.equal((await fetch(`${baseUrl}/api/tienda/admin/pedidos`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/tienda/admin/pedidos/1/anular`, { method: 'POST' })).status, 401, 'anular pide sesión del CMS');
    const cookie = { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}` };
    const pedidos = await (await fetch(`${baseUrl}/api/tienda/admin/pedidos`, { headers: cookie })).json() as { email: string; nombre: string }[];
    assert.ok(pedidos.some((p) => p.nombre === e.marca && p.email === 'comprador@ejemplo.test'));
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await borrarUsuarioPrueba(tesorero.id);
    await e.recoger();
  }
});

test('las tallas: se ponen desde el CMS, se compra por talla y se descuenta de la talla', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'simulado';
  const e = await escenario();
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}`, 'Content-Type': 'application/json' };
    const base = { nombre: e.medalla.nombre, descripcion: '', precio: 15, foto: null, existencias: 2, activo: true, orden: 0 };
    const guardar = async (cuerpo: unknown) => {
      const r = await fetch(`${baseUrl}/api/tienda/admin/productos/${e.medalla.id}`, { method: 'PUT', headers: cabeceras, body: JSON.stringify(cuerpo) });
      return { status: r.status, cuerpo: await r.json() as { existencias: number | null; tallas: { id: number; nombre: string; existencias: number | null }[] } };
    };

    // Con tallas, lo que queda está en cada una y el del producto se deja en null.
    const puesto = await guardar({ ...base, tallas: [{ nombre: 'S', existencias: 1 }, { nombre: ' M ', existencias: 4 }, { nombre: 'XXL', existencias: null }] });
    assert.equal(puesto.status, 200);
    assert.equal(puesto.cuerpo.existencias, null);
    assert.deepEqual(puesto.cuerpo.tallas.map((x) => [x.nombre, x.existencias]), [['S', 1], ['M', 4], ['XXL', null]]);
    const [s, m, xxl] = puesto.cuerpo.tallas;

    // Repetidas (sin mirar mayúsculas), no.
    assert.equal((await guardar({ ...base, tallas: [{ nombre: 'm', existencias: 1 }, { nombre: 'M', existencias: 1 }] })).status, 400);

    // Sin talla no se compra; con ella, se descuenta de la suya.
    await assert.rejects(TiendaService.comprar(e.compra([{ productoId: e.medalla.id, cantidad: 1 }]), {}), (err: unknown) => err instanceof HttpError && /elegir la talla/.test(err.message));
    await assert.rejects(TiendaService.comprar(e.compra([{ productoId: e.medalla.id, tallaId: s.id, cantidad: 2 }]), {}), (err: unknown) => err instanceof HttpError && /talla S\)» solo quedan 1/.test(err.message));
    const r = await TiendaService.comprar(e.compra([{ productoId: e.medalla.id, tallaId: m.id, cantidad: 3 }, { productoId: e.medalla.id, tallaId: xxl.id, cantidad: 2 }]), {});
    const tallas = await db.tallaProducto.findMany({ where: { productoId: e.medalla.id }, orderBy: { orden: 'asc' } });
    assert.deepEqual(tallas.map((x) => x.existencias), [1, 1, null], 'la M baja a 1; la XXL, sin límite, sigue sin límite');
    const pedido = await TiendaService.pedidoPublico(r.token);
    assert.deepEqual(pedido.lineas.map((l) => [l.talla, l.cantidad]), [['M', 3], ['XXL', 2]]);

    // Cambiar una, quitar otra y añadir otra: el pedido conserva el nombre copiado.
    const cambiado = await guardar({ ...base, tallas: [{ id: m.id, nombre: 'M', existencias: 10 }, { nombre: 'L', existencias: 2 }] });
    assert.deepEqual(cambiado.cuerpo.tallas.map((x) => [x.nombre, x.existencias]), [['M', 10], ['L', 2]]);
    assert.equal(cambiado.cuerpo.tallas[0].id, m.id, 'la que ya estaba conserva su id');
    assert.deepEqual((await TiendaService.pedidoPublico(r.token)).lineas.map((l) => l.talla), ['M', 'XXL']);

    // Una pantalla que no manda `tallas` no las toca; una lista vacía las quita y vuelve a contar el producto.
    assert.equal((await guardar(base)).cuerpo.tallas.length, 2);
    const sinTallas = await guardar({ ...base, tallas: [] });
    assert.deepEqual(sinTallas.cuerpo.tallas, []);
    assert.equal(sinTallas.cuerpo.existencias, 2);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await borrarUsuarioPrueba(tesorero.id);
    await e.recoger();
  }
});

test('las fotos de más de un producto: se guardan con su pie, salen en el catálogo y sin mandarlas no se borran', async (t) => {

  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}`, 'Content-Type': 'application/json' };
    const base = { nombre: e.medalla.nombre, descripcion: '', precio: 15, foto: '/uploads/medalla.webp', existencias: 2, activo: true, orden: 0 };
    const guardar = (cuerpo: unknown) => fetch(`${baseUrl}/api/tienda/admin/productos/${e.medalla.id}`, { method: 'PUT', headers: cabeceras, body: JSON.stringify(cuerpo) });
    const guardadas = async () => (await db.producto.findUnique({ where: { id: e.medalla.id } }))?.fotos;

    // La que no tiene dirección (un hueco sin subir) se descarta.
    assert.equal((await guardar({ ...base, fotos: [{ url: '/images/reverso.webp', pie: '  El reverso ' }, { url: null, pie: '' }] })).status, 200);
    const catalogo = await (await fetch(`${baseUrl}/api/tienda`)).json() as { productos: { id: number; fotos: unknown }[] };
    assert.deepEqual(catalogo.productos.find((p) => p.id === e.medalla.id)?.fotos, [{ url: '/images/reverso.webp', pie: 'El reverso' }]);
    // Los productos de antes, sin fotos guardadas, dan una lista vacía.
    assert.deepEqual(catalogo.productos.find((p) => p.id === e.estampa.id)?.fotos, []);

    // Una pantalla que no manda `fotos` no las borra; una lista vacía, sí.
    assert.equal((await guardar(base)).status, 200);
    assert.equal((await guardadas() as unknown[]).length, 1);
    assert.equal((await guardar({ ...base, fotos: [] })).status, 200);
    assert.deepEqual(await guardadas(), []);

    // Más de ocho, no.
    assert.equal((await guardar({ ...base, fotos: Array.from({ length: 9 }, (_, i) => ({ url: `/images/f${i}.webp`, pie: '' })) })).status, 400);
  } finally {
    await borrarUsuarioPrueba(tesorero.id);
    await e.recoger();
  }
});

test('las categorías: se crean al final, se ordenan, filtran el catálogo y al borrarlas el producto se queda', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  const creadas: number[] = [];
  try {
    const cabeceras = { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}`, 'Content-Type': 'application/json' };
    const api = (ruta: string, method = 'GET', cuerpo?: unknown) => fetch(`${baseUrl}/api/tienda/admin${ruta}`, { method, headers: cabeceras, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) });
    const crear = async (nombre: string) => {
      const r = await api('/categorias', 'POST', { nombre });
      assert.equal(r.status, 201);
      const c = await r.json() as { id: number; orden: number };
      creadas.push(c.id);
      return c;
    };
    const ropa = await crear(`Ropa ${e.marca}`);
    const medallas = await crear(`Medallas ${e.marca}`);
    assert.ok(medallas.orden > ropa.orden, 'la nueva va al final');
    // El mismo nombre, aunque cambien las mayúsculas, no.
    assert.equal((await api('/categorias', 'POST', { nombre: `ropa ${e.marca}`.toUpperCase() })).status, 409);

    // Ordenar: la que se manda primero queda primero.
    assert.equal((await api('/categorias/orden', 'PUT', { ids: [medallas.id, ropa.id] })).status, 200);
    const lista = await (await api('/categorias')).json() as { id: number }[];
    assert.ok(lista.findIndex((c) => c.id === medallas.id) < lista.findIndex((c) => c.id === ropa.id));

    // El producto se pone en su categoría y como destacado; una categoría que no existe, no.
    const base = { nombre: e.medalla.nombre, descripcion: '', precio: 15, foto: null, existencias: 2, activo: true, orden: 0 };
    assert.equal((await api(`/productos/${e.medalla.id}`, 'PUT', { ...base, categoriaId: medallas.id, destacado: true })).status, 200);
    assert.equal((await api(`/productos/${e.medalla.id}`, 'PUT', { ...base, categoriaId: 99_999_999 })).status, 409);
    // Sin mandarlos (una pantalla vieja), no se tocan.
    assert.equal((await api(`/productos/${e.medalla.id}`, 'PUT', base)).status, 200);

    // El catálogo solo trae las categorías con algo a la venta.
    const catalogo = await (await fetch(`${baseUrl}/api/tienda`)).json() as { categorias: { id: number }[]; productos: { id: number; categoriaId: number | null; destacado: boolean }[] };
    assert.ok(catalogo.categorias.some((c) => c.id === medallas.id));
    assert.ok(!catalogo.categorias.some((c) => c.id === ropa.id), 'Ropa no tiene nada: no sale');
    const enCatalogo = catalogo.productos.find((p) => p.id === e.medalla.id);
    assert.equal(enCatalogo?.categoriaId, medallas.id);
    assert.equal(enCatalogo?.destacado, true);

    // Borrar la categoría deja el producto a la venta, sin ella.
    assert.equal((await api(`/categorias/${medallas.id}`, 'DELETE')).status, 200);
    assert.equal((await db.producto.findUnique({ where: { id: e.medalla.id } }))?.categoriaId, null);
    assert.equal((await api(`/categorias/${medallas.id}`, 'DELETE')).status, 404);

    // Sin sesión del CMS, nada.
    assert.equal((await fetch(`${baseUrl}/api/tienda/admin/categorias`)).status, 401);
  } finally {
    await db.categoriaProducto.deleteMany({ where: { id: { in: creadas } } });
    await borrarUsuarioPrueba(tesorero.id);
    await e.recoger();
  }
});

test('DS5: guardar la ficha no pisa lo vendido mientras estaba abierta; cambiar «Quedan» sobre un número viejo pide revisarlo', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const base = { nombre: e.medalla.nombre, descripcion: 'Nueva', precio: 15, foto: null, activo: true, orden: 0 };
    // Se abre la ficha con 2 y, entretanto, se vende 1.
    await db.producto.update({ where: { id: e.medalla.id }, data: { existencias: { decrement: 1 } } });
    const guardado = await TiendaService.actualizarProducto(e.medalla.id, { ...base, existencias: 2, existenciasLeidas: 2 });
    assert.equal(guardado.existencias, 1, 'sin tocar «Quedan», se queda lo que hay');
    await assert.rejects(TiendaService.actualizarProducto(e.medalla.id, { ...base, existencias: 10, existenciasLeidas: 2 }),
      (err: unknown) => err instanceof HttpError && err.status === 409 && /quedan 1/.test(err.message));
    // Leído al día, el cambio entra tal cual.
    assert.equal((await TiendaService.actualizarProducto(e.medalla.id, { ...base, existencias: 10, existenciasLeidas: 1 })).existencias, 10);

    // Igual en cada talla.
    const conTallas = await TiendaService.actualizarProducto(e.medalla.id, { ...base, existencias: null, tallas: [{ nombre: 'M', existencias: 4 }] });
    const m = conTallas.tallas[0];
    await db.tallaProducto.update({ where: { id: m.id }, data: { existencias: { decrement: 1 } } });
    const tras = await TiendaService.actualizarProducto(e.medalla.id, { ...base, existencias: null, tallas: [{ id: m.id, nombre: 'M', existencias: 4, existenciasLeidas: 4 }] });
    assert.equal(tras.tallas[0].existencias, 3);
  } finally {
    await db.tallaProducto.deleteMany({ where: { productoId: e.medalla.id } });
    await e.recoger();
  }
});
