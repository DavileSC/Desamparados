// test/contabilidad-apuntes.test.ts
// Apuntes manuales y categorías de la contabilidad, de punta a punta: la ruta,
// el esquema, el servicio y la auditoría. Consulta la base de datos: sin MariaDB
// levantada se omite con el motivo a la vista (skip dentro del cuerpo, ver
// docs/notas-del-proyecto.md §6). Todo lo que crea lleva «ZZTest» y se borra al final.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role, TipoTransaccion } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { diaMadrid, inicioDiaMadrid } from '../src/domain/contabilidad.js';
import { TransaccionService } from '../src/services/transaccion.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let server: Server;
let baseUrl: string;
let dbDisponible = false;

const usuarios: Partial<Record<'TESORERIA' | 'REDES' | 'USER', number>> = {};
const categoriasCreadas: number[] = [];
const transaccionesCreadas: number[] = [];
let hermanoId: number | undefined;
let reciboId: number | undefined;
let apunteDeReciboId: number | undefined;
let categoriaGastoId: number;
let categoriaIngresoId: number;
const SUFIJO = String(Date.now()).slice(-7);

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const);
  dbDisponible = (await Promise.race([consulta, timeout])) === 'ok';
  if (!dbDisponible) return;

  for (const rol of ['TESORERIA', 'REDES', 'USER'] as const) {
    usuarios[rol] = (await crearUsuarioPrueba(Role[rol])).id;
  }

  const gasto = await db.categoriaTransaccion.create({ data: { nombre: `ZZTest Gasto ${SUFIJO}`, tipo: TipoTransaccion.GASTO } });
  const ingreso = await db.categoriaTransaccion.create({ data: { nombre: `ZZTest Ingreso ${SUFIJO}`, tipo: TipoTransaccion.INGRESO } });
  categoriaGastoId = gasto.id;
  categoriaIngresoId = ingreso.id;
  categoriasCreadas.push(gasto.id, ingreso.id);

  // Un apunte que viene de un recibo: esos no se corrigen desde la contabilidad.
  const hermano = await db.hermano.create({
    data: { nombre: 'ZZTest', apellidos: 'Recibo', fechaNacimiento: new Date(Date.UTC(1990, 0, 1)), activo: true, userId: usuarios.USER! },
  });
  hermanoId = hermano.id;
  const recibo = await db.recibo.create({
    data: { year: 2026, concepto: `ZZTest recibo ${SUFIJO}`, importe: 18, hermanoId: hermano.id, estado: 'PAGADO', fechaPago: new Date() },
  });
  reciboId = recibo.id;
  const deRecibo = await db.transaccion.create({
    data: { tipo: TipoTransaccion.INGRESO, categoriaId: ingreso.id, concepto: `ZZTest cobro ${SUFIJO}`, importe: 18, hermanoId: hermano.id, reciboId: recibo.id, metodoPago: 'EFECTIVO' },
  });
  apunteDeReciboId = deRecibo.id;
  transaccionesCreadas.push(deRecibo.id);
});

after(async () => {
  server.close();
  if (dbDisponible) {
    await db.transaccion.deleteMany({ where: { OR: [{ id: { in: transaccionesCreadas } }, { categoriaId: { in: categoriasCreadas } }] } });
    if (reciboId) await db.recibo.deleteMany({ where: { id: reciboId } });
    if (hermanoId) await db.hermano.deleteMany({ where: { id: hermanoId } });
    await db.categoriaTransaccion.deleteMany({ where: { id: { in: categoriasCreadas } } });
    // La auditoría de lo que se ha probado aquí no da fe de nada real.
    await db.auditLog.deleteMany({ where: { userId: { in: Object.values(usuarios) } } });
    for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

type Rol = keyof typeof usuarios;
async function pedir(rol: Rol, ruta: string, metodo = 'GET', cuerpo?: unknown) {
  const res = await fetch(`${baseUrl}/api/transacciones${ruta}`, {
    method: metodo,
    headers: {
      Cookie: `${COOKIE_CMS}=${generateToken(usuarios[rol]!, rol)}`,
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  return { status: res.status, cuerpo: texto ? JSON.parse(texto) : null };
}

/** La auditoría se escribe sin esperar a la respuesta: se le da un momento. */
async function auditoria(action: string, entityId: number) {
  for (let intento = 0; intento < 20; intento++) {
    const fila = await db.auditLog.findFirst({ where: { action, entityId: String(entityId) }, orderBy: { id: 'desc' } });
    if (fila) return fila;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

const apunte = (cambios: Record<string, unknown> = {}) => ({
  tipo: 'GASTO',
  categoriaId: categoriaGastoId,
  concepto: `ZZTest exorno ${SUFIJO}`,
  importe: 342.5,
  metodoPago: 'TRANSFERENCIA',
  fecha: '2026-03-29',
  ...cambios,
});

async function crearApunte(cambios: Record<string, unknown> = {}) {
  const res = await pedir('TESORERIA', '', 'POST', apunte(cambios));
  assert.equal(res.status, 201, JSON.stringify(res.cuerpo));
  transaccionesCreadas.push(res.cuerpo.data.id);
  return res.cuerpo.data as { id: number; fecha: string; importe: string; metodoPago: string };
}

describe('alta de un apunte manual (D8)', () => {
  test('guarda la fecha elegida, en su día de Madrid, y el método', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const creado = await crearApunte();
    // El 29-03-2026 (día del cambio de hora) empieza a las 23:00 UTC del 28.
    assert.equal(creado.fecha, '2026-03-28T23:00:00.000Z');
    assert.equal(creado.metodoPago, 'TRANSFERENCIA');
    const fila = await auditoria('TRANSACCION_CREAR', creado.id);
    assert.ok(fila, 'no se auditó el alta');
  });

  test('sin fecha es hoy', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { fecha: _fecha, ...sinFecha } = apunte();
    const res = await pedir('TESORERIA', '', 'POST', sinFecha);
    assert.equal(res.status, 201);
    transaccionesCreadas.push(res.cuerpo.data.id);
    assert.equal(diaMadrid(new Date(res.cuerpo.data.fecha)), diaMadrid(new Date()));
  });

  test('rechaza con 400 fechas libres, futuras o inexistentes (antes, 500)', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const manana = diaMadrid(new Date(Date.now() + 36 * 3600_000));
    for (const fecha of ['ayer', '2026-02-30', manana]) {
      const res = await pedir('TESORERIA', '', 'POST', apunte({ fecha }));
      assert.equal(res.status, 400, `fecha ${fecha}: ${res.status}`);
    }
  });

  test('rechaza con 400 importes con tres decimales o por encima de 99.999.999,99 (antes, redondeo o 500)', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    for (const importe of [12.345, 100_000_000, 0, -3]) {
      const res = await pedir('TESORERIA', '', 'POST', apunte({ importe }));
      assert.equal(res.status, 400, `importe ${importe}: ${res.status}`);
    }
    const tope = await crearApunte({ importe: 99_999_999.99 });
    assert.equal(Number(tope.importe), 99_999_999.99);
  });

  test('rechaza una categoría del otro tipo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await pedir('TESORERIA', '', 'POST', apunte({ categoriaId: categoriaIngresoId }));
    assert.equal(res.status, 400);
    assert.match(res.cuerpo.error, /es de ingreso y el apunte es un gasto/);
  });
});

describe('corregir y borrar apuntes manuales (D8)', () => {
  test('corregir el importe lo cambia, conserva la hora y audita antes y después', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const creado = await crearApunte({ fecha: '2026-03-10', importe: 100 });
    const res = await pedir('TESORERIA', `/${creado.id}`, 'PUT', apunte({ fecha: '2026-03-10', importe: 10, metodoPago: 'EFECTIVO' }));
    assert.equal(res.status, 200, JSON.stringify(res.cuerpo));
    assert.equal(Number(res.cuerpo.data.importe), 10);
    assert.equal(res.cuerpo.data.fecha, creado.fecha, 'el mismo día no debe mover el apunte de sitio');
    assert.equal(res.cuerpo.data.metodoPago, 'EFECTIVO');

    const fila = await auditoria('TRANSACCION_ACTUALIZAR', creado.id);
    assert.ok(fila, 'no se auditó la corrección');
    const detalles = fila!.detalles as { antes: { importe: number; metodoPago: string }; despues: { importe: number; metodoPago: string } };
    assert.equal(detalles.antes.importe, 100);
    assert.equal(detalles.despues.importe, 10);
    assert.equal(detalles.antes.metodoPago, 'TRANSFERENCIA');
  });

  test('cambiar de día lo lleva a la medianoche de Madrid de ese día', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const creado = await crearApunte({ fecha: '2026-03-10' });
    // 26-10-2025: el día que se retrasó la hora ese año.
    const res = await pedir('TESORERIA', `/${creado.id}`, 'PUT', apunte({ fecha: '2025-10-26' }));
    assert.equal(res.status, 200);
    assert.equal(res.cuerpo.data.fecha, '2025-10-25T22:00:00.000Z');
    assert.equal(res.cuerpo.data.fecha, inicioDiaMadrid('2025-10-26').toISOString());
  });

  test('borrar lo quita del libro y la auditoría guarda cómo era', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const creado = await crearApunte({ importe: 77.7 });
    const res = await pedir('TESORERIA', `/${creado.id}`, 'DELETE');
    assert.equal(res.status, 200);
    assert.equal(await db.transaccion.count({ where: { id: creado.id } }), 0);
    const fila = await auditoria('TRANSACCION_ELIMINAR', creado.id);
    assert.ok(fila, 'no se auditó el borrado');
    assert.equal((fila!.detalles as { antes: { importe: number } }).antes.importe, 77.7);
  });

  test('un apunte que viene de un recibo no se corrige ni se borra aquí: 409', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const corregir = await pedir('TESORERIA', `/${apunteDeReciboId}`, 'PUT', apunte({ tipo: 'INGRESO', categoriaId: categoriaIngresoId, importe: 1 }));
    assert.equal(corregir.status, 409);
    assert.match(corregir.cuerpo.error, /recibo/);
    const borrar = await pedir('TESORERIA', `/${apunteDeReciboId}`, 'DELETE');
    assert.equal(borrar.status, 409);
    assert.equal(Number((await db.transaccion.findUnique({ where: { id: apunteDeReciboId } }))!.importe), 18);
  });

  test('un apunte que no existe es 404', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedir('TESORERIA', '/999999999', 'DELETE')).status, 404);
  });

  test('los roles que no apuntan tampoco corrigen ni borran', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const creado = await crearApunte();
    assert.equal((await pedir('REDES', `/${creado.id}`, 'PUT', apunte())).status, 403);
    assert.equal((await pedir('REDES', `/${creado.id}`, 'DELETE')).status, 403);
    assert.equal((await pedir('REDES', `/categorias/${categoriaGastoId}/activa`, 'PATCH', { activa: false })).status, 403);
  });
});

describe('gestión de categorías (D8)', () => {
  test('no admite dos del mismo tipo con el mismo nombre, aunque cambien mayúsculas o tildes', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await pedir('TESORERIA', '/categorias', 'POST', { nombre: `  zztest   gastó ${SUFIJO} `, tipo: 'GASTO' });
    assert.equal(res.status, 409);
    // Con el mismo nombre en el otro tipo sí se puede.
    const otroTipo = await pedir('TESORERIA', '/categorias', 'POST', { nombre: `ZZTest Gasto ${SUFIJO}`, tipo: 'INGRESO' });
    assert.equal(otroTipo.status, 201);
    categoriasCreadas.push(otroTipo.cuerpo.data.id);
  });

  test('renombrar cambia el nombre, lo guarda limpio y lo audita', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const creada = await pedir('TESORERIA', '/categorias', 'POST', { nombre: `ZZTest Renombrar ${SUFIJO}`, tipo: 'GASTO' });
    assert.equal(creada.status, 201);
    const id = creada.cuerpo.data.id as number;
    categoriasCreadas.push(id);

    const res = await pedir('TESORERIA', `/categorias/${id}`, 'PUT', { nombre: `  ZZTest   Renombrada ${SUFIJO} ` });
    assert.equal(res.status, 200);
    assert.equal(res.cuerpo.data.nombre, `ZZTest Renombrada ${SUFIJO}`);
    const fila = await auditoria('CATEGORIA_RENOMBRAR', id);
    assert.deepEqual(fila?.detalles, { antes: { nombre: `ZZTest Renombrar ${SUFIJO}` }, despues: { nombre: `ZZTest Renombrada ${SUFIJO}` } });

    // Al nombre de otra del mismo tipo, no.
    assert.equal((await pedir('TESORERIA', `/categorias/${id}`, 'PUT', { nombre: `ZZTest Gasto ${SUFIJO}` })).status, 409);
  });

  test('las categorías de los recibos no se renombran', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const cuotas = await db.categoriaTransaccion.findFirst({ where: { nombre: 'Cuotas de hermanos', tipo: TipoTransaccion.INGRESO } });
    if (!cuotas) return t.skip('la base no tiene la categoría «Cuotas de hermanos» (npm run seed)');
    // La lista las marca, para que la pantalla no ofrezca renombrarlas.
    const lista = await pedir('TESORERIA', '/categorias?todas=true');
    const marcadas = lista.cuerpo.filter((c: { deRecibos: boolean }) => c.deRecibos).map((c: { id: number }) => c.id);
    assert.ok(marcadas.includes(cuotas.id));
    assert.ok(!marcadas.includes(categoriaGastoId));

    const res = await pedir('TESORERIA', `/categorias/${cuotas.id}`, 'PUT', { nombre: 'Cuotas' });
    assert.equal(res.status, 409);
    assert.equal((await db.categoriaTransaccion.findUnique({ where: { id: cuotas.id } }))!.nombre, 'Cuotas de hermanos');
  });

  test('desactivada deja de ofrecerse y de admitir apuntes; reactivada vuelve', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const creada = await pedir('TESORERIA', '/categorias', 'POST', { nombre: `ZZTest Temporal ${SUFIJO}`, tipo: 'GASTO' });
    const id = creada.cuerpo.data.id as number;
    categoriasCreadas.push(id);
    // Un apunte hecho mientras estaba activa.
    const viejo = await crearApunte({ categoriaId: id });

    const desactivar = await pedir('TESORERIA', `/categorias/${id}/activa`, 'PATCH', { activa: false });
    assert.equal(desactivar.status, 200);
    assert.equal(desactivar.cuerpo.data.activa, false);
    assert.ok(await auditoria('CATEGORIA_DESACTIVAR', id), 'no se auditó la desactivación');

    const activas = await pedir('TESORERIA', '/categorias?tipo=GASTO');
    assert.ok(!activas.cuerpo.some((c: { id: number }) => c.id === id), 'una desactivada no se ofrece al apuntar');
    const todas = await pedir('TESORERIA', '/categorias?todas=true');
    assert.ok(todas.cuerpo.some((c: { id: number; activa: boolean }) => c.id === id && !c.activa), 'la gestión sí la ve');

    const nuevo = await pedir('TESORERIA', '', 'POST', apunte({ categoriaId: id }));
    assert.equal(nuevo.status, 400);
    assert.match(nuevo.cuerpo.error, /desactivada/);
    // Corregir un apunte que ya la tenía no obliga a recategorizarlo.
    assert.equal((await pedir('TESORERIA', `/${viejo.id}`, 'PUT', apunte({ categoriaId: id, importe: 5 }))).status, 200);

    const reactivar = await pedir('TESORERIA', `/categorias/${id}/activa`, 'PATCH', { activa: true });
    assert.equal(reactivar.status, 200);
    assert.equal(reactivar.cuerpo.data.activa, true);
    assert.ok(await auditoria('CATEGORIA_REACTIVAR', id), 'no se auditó la reactivación');
  });
});

// El índice único (tipo, nombre) compara con utf8mb4_unicode_ci: «Año» y «Ano»
// son el mismo nombre. Si el servicio los diera por distintos, la base
// respondería con un choque de clave y el usuario vería un 409 sin decir con qué.
describe('nombres de categoría como los compara la base de datos', () => {
  test('«Ano» choca con «Año» con el mensaje del servicio, al crear y al renombrar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const creada = await pedir('TESORERIA', '/categorias', 'POST', { nombre: `ZZTest Año ${SUFIJO}`, tipo: 'GASTO' });
    assert.equal(creada.status, 201);
    categoriasCreadas.push(creada.cuerpo.data.id);

    const otra = await pedir('TESORERIA', '/categorias', 'POST', { nombre: `zztest ano ${SUFIJO}`, tipo: 'GASTO' });
    assert.equal(otra.status, 409);
    assert.equal(otra.cuerpo.error, `Ya hay una categoría de gasto llamada «ZZTest Año ${SUFIJO}».`);

    const renombrar = await pedir('TESORERIA', `/categorias/${categoriaGastoId}`, 'PUT', { nombre: `ZZTEST AÑO ${SUFIJO}` });
    assert.equal(renombrar.status, 409);
    assert.equal(renombrar.cuerpo.error, `Ya hay una categoría de gasto llamada «ZZTest Año ${SUFIJO}».`);
  });

  // Dos altas a la vez pueden pasar las dos la comprobación previa; la segunda
  // choca con el índice (P2002). Se fuerza saltando la comprobación una vez.
  test('un P2002 del índice al crear o renombrar sale como el mismo 409 claro', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const existente = await db.categoriaTransaccion.create({ data: { nombre: `ZZTest Carrera ${SUFIJO}`, tipo: TipoTransaccion.GASTO } });
    const aRenombrar = await db.categoriaTransaccion.create({ data: { nombre: `ZZTest Otra ${SUFIJO}`, tipo: TipoTransaccion.GASTO } });
    categoriasCreadas.push(existente.id, aRenombrar.id);

    const original = TransaccionService.exigirNombreLibre;
    const saltarLaPrimera = () => {
      let primera = true;
      TransaccionService.exigirNombreLibre = async (nombre, tipo, salvoId) => {
        if (primera) { primera = false; return; }
        return original(nombre, tipo, salvoId);
      };
    };
    const esElMismo409 = (e: unknown) => {
      assert.ok(e instanceof HttpError, `se esperaba un HttpError y llegó ${String(e)}`);
      assert.equal(e.status, 409);
      assert.equal(e.message, `Ya hay una categoría de gasto llamada «ZZTest Carrera ${SUFIJO}».`);
      return true;
    };

    try {
      saltarLaPrimera();
      await assert.rejects(TransaccionService.createCategoria(`zztest carrera ${SUFIJO}`, 'GASTO'), esElMismo409);
      saltarLaPrimera();
      await assert.rejects(TransaccionService.renombrarCategoria(aRenombrar.id, `ZZTest Carrera ${SUFIJO}`), esElMismo409);
    } finally {
      TransaccionService.exigirNombreLibre = original;
    }
    assert.equal((await db.categoriaTransaccion.findUnique({ where: { id: aRenombrar.id } }))!.nombre, `ZZTest Otra ${SUFIJO}`);
  });

  test('dos altas simultáneas con el mismo nombre: una entra y la otra recibe el 409 claro', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const nombre = `ZZTest Simultanea ${SUFIJO}`;
    const resultados = await Promise.allSettled([
      TransaccionService.createCategoria(nombre, 'INGRESO'),
      TransaccionService.createCategoria(nombre.toUpperCase(), 'INGRESO'),
    ]);
    for (const r of resultados) if (r.status === 'fulfilled') categoriasCreadas.push(r.value.id);
    assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
    const rechazo = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.ok(rechazo.reason instanceof HttpError, `llegó ${String(rechazo.reason)}`);
    assert.equal(rechazo.reason.status, 409);
    assert.match(rechazo.reason.message, /^Ya hay una categoría de ingreso llamada «ZZTest Simultanea/i);
  });
});

describe('consultas de la contabilidad (D12, S10)', () => {
  test('un periodo al revés es 400 en el resumen y en el libro mayor', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedir('TESORERIA', '/resumen?desde=2026-12-01&hasta=2026-01-31')).status, 400);
    assert.equal((await pedir('TESORERIA', '/libro-mayor?desde=2026-12-01&hasta=2026-01-31')).status, 400);
  });

  test('un parámetro repetido en las categorías no da 500', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await pedir('TESORERIA', '/categorias?tipo=INGRESO&tipo=GASTO');
    assert.ok(res.status < 500, `recibió ${res.status}`);
  });

  test('el balance sale en céntimos exactos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await pedir('TESORERIA', '/balance');
    assert.equal(res.status, 200);
    for (const valor of [res.cuerpo.ingresos, res.cuerpo.gastos, res.cuerpo.balanceTotal]) {
      assert.match(String(valor), /^-?\d+(\.\d{1,2})?$/, `${valor} tiene más de dos decimales`);
    }
  });
});
