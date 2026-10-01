// La caja de la tienda contra MariaDB: abrir con fondo (y no dos a la vez),
// vender del catálogo y suelto (existencias, apunte en la contabilidad que no
// se toca a mano), anular con la caja abierta y cerrar con el arqueo. Si la
// base de desarrollo ya tiene una caja abierta, la prueba se omite: no la toca.

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

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
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

test('abrir, vender, anular y cerrar la caja', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // Hay una sola caja abierta a la vez: si la base de desarrollo tiene una, no se toca.
  if (await db.cajaSesion.findFirst({ where: { cerradaEl: null } })) return t.skip('hay una caja abierta en la base de desarrollo');
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  const cab = { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}`, 'Content-Type': 'application/json' };
  const post = (ruta: string, cuerpo: unknown = {}) => fetch(`${baseUrl}/api/tienda/admin/caja${ruta}`, { method: 'POST', headers: cab, body: JSON.stringify(cuerpo) });
  const producto = await db.producto.create({ data: { nombre: `Medalla caja ${Date.now()}`, precio: '15', existencias: 3 } });
  let sesionId: number | null = null;
  const apuntes: number[] = [];
  try {
    assert.equal((await post('/ventas', { lineas: [{ productoId: producto.id, cantidad: 1 }], metodo: 'EFECTIVO' })).status, 409, 'con la caja cerrada no se vende');
    const abierta = await (await post('/abrir', { fondoInicial: 50 })).json();
    sesionId = abierta.abierta.id;
    assert.equal((await post('/abrir', { fondoInicial: 10 })).status, 409, 'no se abren dos');

    const v1 = await (await post('/ventas', { lineas: [{ productoId: producto.id, cantidad: 2 }, { nombre: 'Libro usado', centimos: 550, cantidad: 1 }], metodo: 'EFECTIVO' })).json();
    assert.equal(v1.total, 35.5);
    const v2 = await (await post('/ventas', { lineas: [{ productoId: producto.id, cantidad: 1 }], metodo: 'TARJETA' })).json();
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).existencias, 0);
    assert.equal((await post('/ventas', { lineas: [{ productoId: producto.id, cantidad: 1 }], metodo: 'BIZUM' })).status, 409, 'agotado');

    // El apunte de una venta no se corrige desde Contabilidad.
    const venta1 = await db.cajaVenta.findUniqueOrThrow({ where: { id: v1.ventaId } });
    apuntes.push(venta1.transaccionId!);
    const apunte = await db.transaccion.findUniqueOrThrow({ where: { id: venta1.transaccionId! } });
    assert.equal(Number(apunte.importe), 35.5);
    assert.equal(apunte.metodoPago, 'EFECTIVO');
    assert.equal((await fetch(`${baseUrl}/api/transacciones/${apunte.id}`, { method: 'DELETE', headers: cab })).status, 409);

    // Anular la de tarjeta: vuelve la medalla y se quita su apunte.
    const tx2 = (await db.cajaVenta.findUniqueOrThrow({ where: { id: v2.ventaId } })).transaccionId!;
    const tras = await (await post(`/ventas/${v2.ventaId}/anular`)).json();
    assert.equal(tras.abierta.resumen.anuladas, 1);
    assert.equal((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).existencias, 1);
    assert.equal(await db.transaccion.count({ where: { id: tx2 } }), 0);
    assert.equal((await post(`/ventas/${v2.ventaId}/anular`)).status, 409);

    // Cerrar: debía haber 50 + 35,50; se cuentan 85.
    const cierre = await (await post('/cerrar', { efectivoContado: 85, observaciones: 'Faltan 50 céntimos' })).json();
    assert.equal(cierre.diferencia, -0.5);
    assert.equal(cierre.estado.abierta, null);
    const cerrada = cierre.estado.cerradas.find((s: { id: number }) => s.id === sesionId);
    assert.equal(cerrada.efectivoEsperado, 85.5);
    assert.equal((await post(`/ventas/${v1.ventaId}/anular`)).status, 409, 'con la caja cerrada ya no se anula');
    assert.deepEqual(
      (await db.auditLog.findMany({ where: { userId: tesorero.id, entityType: { in: ['cajaSesion', 'cajaVenta'] } }, orderBy: { id: 'asc' } })).map((a) => a.action),
      ['CAJA_ABRIR', 'CAJA_VENDER', 'CAJA_VENDER', 'CAJA_ANULAR', 'CAJA_CERRAR'],
    );
  } finally {
    if (sesionId) {
      await db.cajaVentaLinea.deleteMany({ where: { venta: { sesionId } } });
      await db.cajaVenta.deleteMany({ where: { sesionId } });
      await db.cajaSesion.deleteMany({ where: { id: sesionId } });
    }
    await db.transaccion.deleteMany({ where: { id: { in: apuntes } } });
    await db.producto.deleteMany({ where: { id: producto.id } });
    await db.auditLog.deleteMany({ where: { userId: tesorero.id } });
    await borrarUsuarioPrueba(tesorero.id);
  }
});
