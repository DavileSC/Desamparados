// La lotería de punta a punta (octubre de 2026): el sorteo, los talonarios,
// la entrega, la liquidación con su ingreso, la compra con su gasto, los
// premios y el PDF de las participaciones.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
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

const paginas = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

interface Sorteo {
  id: number; maximoDeParticipaciones: number; talonarios: number; entregados: number; liquidados: number; vendidas: number; recaudado: number;
  premioPorParticipacion: number; premiosVendidos: number; compra: { importe: number } | null;
  lista: { id: number; numero: number; desde: number; hasta: number; responsable: string | null; vendidas: number | null; importe: number | null }[];
}

test('la lotería: sorteo, talonarios, liquidación, compra, premios y participaciones', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  const albacea = await crearUsuarioPrueba(Role.ALBACERIA);
  const marca = `Loteria${Date.now().toString(36)}`;
  const como = (userId: number, rol: Role, ruta: string, init: { method?: string; json?: unknown } = {}) => fetch(`${baseUrl}/api/loteria${ruta}`, {
    method: init.method ?? 'GET',
    headers: { Cookie: `${COOKIE_CMS}=${generateToken(userId, rol)}`, ...(init.json !== undefined && { 'Content-Type': 'application/json' }) },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  const yo = (ruta: string, init: { method?: string; json?: unknown } = {}) => como(tesorero.id, Role.TESORERIA, ruta, init);
  const json = async (r: Response) => { const cuerpo = await r.json(); assert.ok(r.ok, JSON.stringify(cuerpo)); return cuerpo as Sorteo; };
  const datos = { nombre: marca, fecha: '2026-12-22', numeros: ['04512'], precioDecimo: 20, decimos: 10, precioParticipacion: 5, jugado: 4, porTalonario: 10, leyenda: '' };
  let sorteoId = 0;
  try {
    // Solo la Junta de las cuentas.
    assert.equal((await como(albacea.id, Role.ALBACERIA, '/')).status, 403);
    assert.equal((await yo('/', { method: 'POST', json: { ...datos, jugado: 6 } })).status, 400, 'no juega más de lo que cuesta');
    assert.equal((await yo('/', { method: 'POST', json: { ...datos, numeros: ['04512', '04512'] } })).status, 400, 'número repetido');

    let s = await json(await yo('/', { method: 'POST', json: datos }));
    sorteoId = s.id;
    assert.equal(s.maximoDeParticipaciones, 50, '200 € en décimos / 4 €');

    // Talonarios: caben cinco de diez; el sexto no.
    s = await json(await yo(`/${sorteoId}/talonarios`, { method: 'POST', json: { cantidad: 5 } }));
    assert.deepEqual(s.lista.map((x) => [x.numero, x.desde, x.hasta]).at(-1), [5, 41, 50]);
    assert.equal((await yo(`/${sorteoId}/talonarios`, { method: 'POST', json: { cantidad: 1 } })).status, 409);
    assert.equal((await yo(`/${sorteoId}`, { method: 'PUT', json: { ...datos, jugado: 3 } })).status, 409, 'con talonarios no cambia lo impreso');

    // Entregar el 1 y el 2 a un bar; quitar el último (sin dar) sí, el primero no.
    s = await json(await yo(`/${sorteoId}/entregas`, { method: 'POST', json: { desde: 1, hasta: 2, responsable: 'Bar Pepe', telefono: '600000000' } }));
    assert.equal(s.entregados, 2);
    assert.equal((await yo(`/talonarios/${s.lista[0].id}`, { method: 'DELETE' })).status, 409);
    s = await json(await yo(`/talonarios/${s.lista[4].id}`, { method: 'DELETE' }));
    assert.equal(s.talonarios, 4);

    // Liquidar el 1: 7 vendidas, 35 € en efectivo, apuntados como lotería.
    const talonario1 = s.lista[0].id;
    assert.equal((await yo(`/talonarios/${talonario1}/liquidacion`, { method: 'POST', json: { vendidas: 7, metodoPago: null } })).status, 400, 'sin decir cómo se pagó');
    s = await json(await yo(`/talonarios/${talonario1}/liquidacion`, { method: 'POST', json: { vendidas: 7, metodoPago: 'EFECTIVO' } }));
    assert.deepEqual([s.liquidados, s.vendidas, s.recaudado, s.entregados], [1, 7, 35, 1]);
    const ingreso = await db.talonarioLoteria.findUniqueOrThrow({ where: { id: talonario1 }, include: { transaccion: { include: { categoria: true } } } });
    assert.equal(Number(ingreso.transaccion?.importe), 35);
    assert.equal(ingreso.transaccion?.categoria.nombre, 'Lotería y rifas');
    assert.equal((await yo(`/talonarios/${talonario1}/liquidacion`, { method: 'POST', json: { vendidas: 7, metodoPago: 'EFECTIVO' } })).status, 409, 'dos veces no');

    // El apunte no se toca desde Contabilidad.
    const contabilidad = await fetch(`${baseUrl}/api/transacciones/${ingreso.transaccionId}`, { method: 'DELETE', headers: { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}` } });
    assert.equal(contabilidad.status, 409);

    // Deshacer la liquidación quita el ingreso.
    s = await json(await yo(`/talonarios/${talonario1}/liquidacion`, { method: 'DELETE' }));
    assert.equal(s.liquidados, 0);
    assert.equal(await db.transaccion.count({ where: { id: ingreso.transaccionId! } }), 0);
    s = await json(await yo(`/talonarios/${talonario1}/liquidacion`, { method: 'POST', json: { vendidas: 10, metodoPago: 'BIZUM' } }));

    // La compra: 10 décimos de 20 €, un gasto; una sola vez, y luego no cambian los décimos.
    s = await json(await yo(`/${sorteoId}/compra`, { method: 'POST', json: { metodoPago: 'TRANSFERENCIA' } }));
    assert.equal(s.compra?.importe, 200);
    assert.equal((await yo(`/${sorteoId}/compra`, { method: 'POST', json: { metodoPago: 'TRANSFERENCIA' } })).status, 409);
    assert.equal((await yo(`/${sorteoId}`, { method: 'PUT', json: { ...datos, decimos: 20 } })).status, 409);
    assert.equal((await yo(`/${sorteoId}`, { method: 'DELETE' })).status, 409, 'con la compra apuntada no se borra');

    // Toca la pedrea: 100 € al décimo; cada participación cobra 20 €.
    s = await json(await yo(`/${sorteoId}/premios`, { method: 'PUT', json: { premios: [100] } }));
    assert.deepEqual([s.premioPorParticipacion, s.premiosVendidos], [20, 200]);

    // Las participaciones: diez por talonario, cinco por hoja.
    const pdf = await yo(`/${sorteoId}/participaciones`, { method: 'POST', json: { desde: 1, hasta: 2 } });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(paginas(Buffer.from(await pdf.arrayBuffer())), 4);

    // Para terminar, se deshace la compra (el gasto se va).
    s = await json(await yo(`/${sorteoId}/compra`, { method: 'DELETE' }));
    assert.equal(s.compra, null);
    assert.equal(await db.auditLog.count({ where: { userId: tesorero.id, action: { startsWith: 'LOTERIA_' } } }), 7);
  } finally {
    if (sorteoId) {
      const s = await db.sorteoLoteria.findUnique({ where: { id: sorteoId }, include: { talonarios: true } });
      const apuntes = [s?.compraId, ...(s?.talonarios.map((x) => x.transaccionId) ?? [])].filter((x): x is number => typeof x === 'number');
      await db.sorteoLoteria.deleteMany({ where: { id: sorteoId } });
      await db.transaccion.deleteMany({ where: { id: { in: apuntes } } });
    }
    await db.auditLog.deleteMany({ where: { userId: tesorero.id } });
    for (const u of [tesorero, albacea]) await borrarUsuarioPrueba(u.id);
  }
});
