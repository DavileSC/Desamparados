// Los apadrinamientos contra MariaDB: una pieza se apadrina una vez (con dos
// a la vez por el banco, el segundo queda como incidencia), el nombre solo sale
// si se pidió, el ingreso va a contabilidad y la gestión pide sesión del CMS.

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
import { ApadrinamientosService } from '../src/services/apadrinamientos.service.js';
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
  const c = await ApadrinamientosService.crearCampana({ titulo: `Candelería ${Date.now()}`, descripcion: 'Las velas del trono.', foto: '/storage/public/trono.webp', activa: true });
  const conPiezas = await ApadrinamientosService.ponerPieza(c.id, { nombre: 'Vela 1', precio: 20, x: 10.5, y: 40 });
  const conDos = await ApadrinamientosService.ponerPieza(c.id, { nombre: 'Vela 2', precio: 20, x: 20, y: 40 });
  const [vela1, vela2] = conDos.piezas;
  assert.equal(conPiezas.piezas[0].x, 10.5);
  const persona = (nombre: string, mostrarNombre: boolean) => ({ nombre, email: `${nombre.toLowerCase()}@ejemplo.test`, telefono: '600000000', dedicatoria: 'Por mis padres', mostrarNombre, metodo: 'TARJETA' as const });
  const recoger = async () => {
    const ids = (await db.apadrinamiento.findMany({ where: { pieza: { campanaId: c.id } }, select: { id: true } })).map((a) => a.id);
    await db.transaccion.deleteMany({ where: { concepto: { contains: c.titulo } } });
    await db.pagoEnLinea.deleteMany({ where: { origen: 'APADRINAMIENTO', referenciaId: { in: ids } } });
    await db.auditLog.deleteMany({ where: { OR: [{ entityType: 'apadrinamiento', entityId: { in: ids.map(String) } }, { action: 'EMAIL_FALLIDO', createdAt: { gte: new Date(Date.now() - 120_000) } }] } });
    await db.campanaApadrinamiento.delete({ where: { id: c.id } });
  };
  return { c, vela1, vela2, persona, recoger };
}

test('con el pago simulado: apadrinada en el acto, con el nombre solo si se pidió, y en la contabilidad', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'simulado';
  const e = await escenario();
  try {
    const r1 = await ApadrinamientosService.apadrinar({ ...e.persona('Ana', true), piezaId: e.vela1.id }, {});
    await ApadrinamientosService.apadrinar({ ...e.persona('Luis', false), piezaId: e.vela2.id }, {});
    assert.equal((await ApadrinamientosService.apadrinamientoPublico(r1.token)).estado, 'PAGADO');

    const publica = await ApadrinamientosService.campanaPublica(e.c.id);
    assert.deepEqual(publica.piezas.map((p) => [p.nombre, p.apadrinada, p.padrino]), [['Vela 1', true, 'Ana'], ['Vela 2', true, null]]);
    assert.equal((publica.piezas[1] as Record<string, unknown>).contacto, undefined, 'la web pública no ve los datos de contacto');
    const cms = await ApadrinamientosService.campana(e.c.id);
    assert.equal(cms.piezas[1].padrino, 'Luis');

    await assert.rejects(ApadrinamientosService.apadrinar({ ...e.persona('Eva', true), piezaId: e.vela1.id }, {}), (err: unknown) => err instanceof HttpError && /ya está apadrinada/.test(err.message));
    await assert.rejects(ApadrinamientosService.quitarPieza(e.c.id, e.vela1.id), (err: unknown) => err instanceof HttpError && err.status === 409);
    await assert.rejects(ApadrinamientosService.cambiarPieza(e.c.id, e.vela1.id, { nombre: 'Vela 1', precio: 30, x: 10, y: 40 }), (err: unknown) => err instanceof HttpError && /precio no se cambia/.test(err.message));

    const apunte = await db.transaccion.findFirstOrThrow({ where: { concepto: `Apadrinamiento: Vela 1 (${e.c.titulo})` }, include: { categoria: true } });
    assert.deepEqual([Number(apunte.importe), apunte.categoria.nombre], [20, 'Apadrinamientos']);
    const resumen = (await ApadrinamientosService.campanas()).find((x) => x.id === e.c.id)!;
    assert.deepEqual([resumen.piezas, resumen.apadrinadas, resumen.recaudado], [2, 2, 40]);
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('con Redsys, dos a por la misma pieza: se la lleva el primer aviso y el otro queda como incidencia', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  process.env.PAGO_EN_LINEA = 'redsys';
  const e = await escenario();
  try {
    const a = await ApadrinamientosService.apadrinar({ ...e.persona('Ana', true), piezaId: e.vela1.id }, {});
    const b = await ApadrinamientosService.apadrinar({ ...e.persona('Luis', true), piezaId: e.vela1.id }, {});
    if (a.tipo !== 'banco' || b.tipo !== 'banco') throw new Error('se esperaba ir al banco');

    assert.ok(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: b.pedido, Ds_Amount: '2000', Ds_Response: '0000' }), {}));
    assert.ok(await PagoEnLineaService.avisoDelBanco(aviso({ Ds_Order: a.pedido, Ds_Amount: '2000', Ds_Response: '0000' }), {}));
    assert.equal((await ApadrinamientosService.apadrinamientoPublico(b.token)).estado, 'PAGADO');
    assert.equal((await ApadrinamientosService.apadrinamientoPublico(a.token)).estado, 'PENDIENTE_PAGO');
    const pago = await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: a.pedido } });
    assert.equal(pago.estado, 'INCIDENCIA');
    assert.match(pago.motivo ?? '', /la apadrinó otra persona/);
    assert.equal((await ApadrinamientosService.campanaPublica(e.c.id)).piezas[0].padrino, 'Luis');
  } finally {
    delete process.env.PAGO_EN_LINEA;
    await e.recoger();
  }
});

test('lo público sin sesión, la gestión solo con la del CMS', async (t) => {
  assert.equal((await fetch(`${baseUrl}/api/apadrinamientos/admin/campanas`)).status, 401);
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  const albacea = await crearUsuarioPrueba(Role.ALBACERIA);
  const redes = await crearUsuarioPrueba(Role.REDES);
  try {
    const publicas = await (await fetch(`${baseUrl}/api/apadrinamientos`)).json() as { campanas: { id: number; libres: number }[] };
    assert.equal(publicas.campanas.find((c) => c.id === e.c.id)?.libres, 2);
    const cookie = (id: number, rol: Role) => ({ Cookie: `${COOKIE_CMS}=${generateToken(id, rol)}` });
    assert.equal((await fetch(`${baseUrl}/api/apadrinamientos/admin/campanas`, { headers: cookie(albacea.id, Role.ALBACERIA) })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/apadrinamientos/admin/campanas`, { headers: cookie(redes.id, Role.REDES) })).status, 403);
    const fuera = await fetch(`${baseUrl}/api/apadrinamientos/admin/campanas/${e.c.id}/piezas`, {
      method: 'POST', headers: { ...cookie(albacea.id, Role.ALBACERIA), 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'Vela 3', precio: 20, x: 120, y: 10 }),
    });
    assert.equal(fuera.status, 400);
  } finally {
    await borrarUsuarioPrueba(albacea.id);
    await borrarUsuarioPrueba(redes.id);
    await e.recoger();
  }
});
