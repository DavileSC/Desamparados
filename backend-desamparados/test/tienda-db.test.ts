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
    await db.transaccion.deleteMany({ where: { concepto: { in: ids.map((id) => `Tienda: pedido n.º ${id}`) } } });
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
