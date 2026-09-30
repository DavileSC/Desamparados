// La tienda contra MariaDB: comprar sin cuenta con el pago simulado y con
// Redsys (el aviso firmado es lo único que da el pedido por pagado), las
// existencias, el apunte en contabilidad, lo que queda como incidencia y la
// gestión desde el CMS. Cada prueba crea sus productos y los recoge.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { HttpError } from '../src/utils/error.handle.js';
import { configuracionRedsys, firmar } from '../src/domain/redsys.js';
import { TiendaService } from '../src/services/tienda.service.js';
import { PagoEnLineaService } from '../src/services/pagos/pago-en-linea.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
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
    await db.transaccion.deleteMany({ where: { concepto: { in: ids.map((id) => `Tienda: pedido n.º ${id}`) } } });
    await db.pagoEnLinea.deleteMany({ where: { origen: 'TIENDA', referenciaId: { in: ids } } });
    await db.auditLog.deleteMany({ where: { OR: [{ entityType: 'pedido', entityId: { in: ids.map(String) } }, { action: 'EMAIL_FALLIDO', createdAt: { gte: new Date(Date.now() - 120_000) } }] } });
    await db.pedidoTienda.deleteMany({ where: { id: { in: ids } } });
    await db.producto.deleteMany({ where: { id: { in: [medalla.id, estampa.id] } } });
  };
  const compra = (lineas: { productoId: number; cantidad: number }[]) => ({ nombre: marca, email: 'comprador@ejemplo.test', telefono: '600000000', metodo: 'TARJETA' as const, lineas });
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

    // Un aviso repetido del pedido pagado no cobra dos veces.
    assert.ok(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: otro.pedido, Ds_Amount: '3000', Ds_Response: '0000' }), {}));
    const numeroOtro = (await TiendaService.pedidoPublico(otro.token)).numero;
    assert.equal(await db.transaccion.count({ where: { concepto: `Tienda: pedido n.º ${numeroOtro}` } }), 1);
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
    const cookie = { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}` };
    const pedidos = await (await fetch(`${baseUrl}/api/tienda/admin/pedidos`, { headers: cookie })).json() as { email: string; nombre: string }[];
    assert.ok(pedidos.some((p) => p.nombre === e.marca && p.email === 'comprador@ejemplo.test'));
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await borrarUsuarioPrueba(tesorero.id);
    await e.recoger();
  }
});
