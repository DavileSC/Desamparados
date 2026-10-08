// La venta en mano de la tienda contra MariaDB: vender del catálogo y suelto
// sin caja que abrir (existencias, apunte en la contabilidad que no se toca a
// mano), anular, e ingresar el efectivo en el banco sin pasar de lo que queda.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { prepararVenta, resumenDeCaja } from '../src/domain/caja.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

test('preparar una venta: el precio del catálogo, lo suelto con el suyo, y lo que no queda no se vende', () => {
  const catalogo = [{ id: 1, nombre: 'Medalla', centimos: 15_00, activo: false, existencias: 3 }, { id: 2, nombre: 'Estampa', centimos: 1_00, activo: true, existencias: null }];
  const v = prepararVenta([{ productoId: 1, cantidad: 2 }, { nombre: 'Libro usado', centimos: 5_50, cantidad: 1 }, { productoId: 2, cantidad: 10 }], catalogo);
  assert.ok(!('problema' in v));
  assert.equal(v.centimos, 30_00 + 5_50 + 10_00, 'lo retirado de la web se vende igual en el mostrador');
  assert.deepEqual(prepararVenta([{ productoId: 1, cantidad: 2 }, { productoId: 1, cantidad: 2 }], catalogo), { problema: 'De «Medalla» solo quedan 3.' });
  assert.deepEqual(prepararVenta([{ nombre: ' ', centimos: 100, cantidad: 1 }], catalogo), { problema: 'Lo que se vende suelto necesita un nombre.' });
  const r = resumenDeCaja(50_00, [{ metodo: 'EFECTIVO', centimos: 20_00, anulada: false }, { metodo: 'TARJETA', centimos: 10_00, anulada: false }, { metodo: 'EFECTIVO', centimos: 5_00, anulada: true }]);
  assert.equal(r.efectivoEsperado, 70_00);
  assert.equal(r.total, 30_00);
  assert.equal(r.anuladas, 1);
});

test('vender en mano, anular e ingresar el efectivo en el banco', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  const cab = { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}`, 'Content-Type': 'application/json' };
  const post = (ruta: string, cuerpo: unknown = {}) => fetch(`${baseUrl}/api/tienda/admin/caja${ruta}`, { method: 'POST', headers: cab, body: JSON.stringify(cuerpo) });
  const estado = async () => (await fetch(`${baseUrl}/api/tienda/admin/caja`, { headers: cab })).json() as Promise<{ efectivoPorIngresar: number; ingresos: { id: number }[] }>;
  const producto = await db.producto.create({ data: { nombre: `Medalla en mano ${Date.now()}`, precio: '15', existencias: 3 } });
  const ventas: number[] = [];
  const ingresos: number[] = [];
  try {
    // La base de desarrollo puede tener efectivo de antes: se mira lo que cambia.
    const antes = (await estado()).efectivoPorIngresar;

    // Sin caja que abrir: se vende y ya.
    const v1 = await (await post('/ventas', { lineas: [{ productoId: producto.id, cantidad: 2 }, { nombre: 'Libro usado', centimos: 550, cantidad: 1 }], metodo: 'EFECTIVO' })).json();
    ventas.push(v1.ventaId);
    assert.equal(v1.total, 35.5);
    assert.equal(v1.estado.efectivoPorIngresar, antes + 35.5);
    const v2 = await (await post('/ventas', { lineas: [{ productoId: producto.id, cantidad: 1 }], metodo: 'BIZUM' })).json();
    ventas.push(v2.ventaId);
    assert.equal(v2.estado.efectivoPorIngresar, antes + 35.5, 'el Bizum ya está en el banco');
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).existencias, 0);
    assert.equal((await post('/ventas', { lineas: [{ productoId: producto.id, cantidad: 1 }], metodo: 'EFECTIVO' })).status, 409, 'agotado');

    // El apunte de una venta no se corrige desde Contabilidad.
    const apunte = await db.transaccion.findUniqueOrThrow({ where: { id: (await db.cajaVenta.findUniqueOrThrow({ where: { id: v1.ventaId } })).transaccionId! } });
    assert.equal(Number(apunte.importe), 35.5);
    assert.equal(apunte.metodoPago, 'EFECTIVO');
    assert.equal((await fetch(`${baseUrl}/api/transacciones/${apunte.id}`, { method: 'DELETE', headers: cab })).status, 409);

    // Anular la de Bizum: vuelve la medalla y se quita su apunte.
    const tx2 = (await db.cajaVenta.findUniqueOrThrow({ where: { id: v2.ventaId } })).transaccionId!;
    assert.equal((await post(`/ventas/${v2.ventaId}/anular`)).status, 200);
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).existencias, 1);
    assert.equal(await db.transaccion.count({ where: { id: tx2 } }), 0);
    assert.equal((await post(`/ventas/${v2.ventaId}/anular`)).status, 409, 'ya anulada');

    // Ingresar en el banco: no más de lo que queda, ni con fecha futura.
    assert.equal((await post('/ingresos', { fecha: '2026-01-01', importe: antes + 36 })).status, 409, 'más de lo que hay');
    assert.equal((await post('/ingresos', { fecha: '2999-01-01', importe: 1 })).status, 400);
    assert.equal((await post('/ingresos', { fecha: '2026-02-30', importe: 1 })).status, 400, 'un día que no existe');
    const tras = await (await post('/ingresos', { fecha: '2026-01-01', importe: 30, nota: 'Ingreso del viernes' })).json();
    ingresos.push(...tras.ingresos.filter((i: { nota: string }) => i.nota === 'Ingreso del viernes').map((i: { id: number }) => i.id));
    assert.equal(tras.efectivoPorIngresar, Math.round((antes + 5.5) * 100) / 100);

    // Si el efectivo de una venta ya consta en el banco, anularla dejaría ingresado más de lo vendido.
    if (antes === 0) assert.equal((await post(`/ventas/${v1.ventaId}/anular`)).status, 409);

    // Borrar el ingreso: el efectivo vuelve a quedar por ingresar.
    assert.equal((await fetch(`${baseUrl}/api/tienda/admin/caja/ingresos/${ingresos[0]}`, { method: 'DELETE', headers: cab })).status, 200);
    assert.equal((await estado()).efectivoPorIngresar, antes + 35.5);
    ingresos.length = 0;

    assert.deepEqual(
      (await db.auditLog.findMany({ where: { userId: tesorero.id, entityType: { in: ['cajaVenta', 'ingresoEfectivoTienda'] } }, orderBy: { id: 'asc' } })).map((a) => a.action),
      ['CAJA_VENDER', 'CAJA_VENDER', 'CAJA_ANULAR', 'TIENDA_INGRESO_BANCO', 'TIENDA_INGRESO_BORRAR'],
    );
  } finally {
    const apuntes = (await db.cajaVenta.findMany({ where: { id: { in: ventas } }, select: { transaccionId: true } })).flatMap((v) => (v.transaccionId ? [v.transaccionId] : []));
    await db.cajaVentaLinea.deleteMany({ where: { ventaId: { in: ventas } } });
    await db.cajaVenta.deleteMany({ where: { id: { in: ventas } } });
    await db.transaccion.deleteMany({ where: { id: { in: apuntes } } });
    await db.ingresoEfectivoTienda.deleteMany({ where: { id: { in: ingresos } } });
    await db.producto.deleteMany({ where: { id: producto.id } });
    await db.auditLog.deleteMany({ where: { userId: tesorero.id } });
    await borrarUsuarioPrueba(tesorero.id);
  }
});
