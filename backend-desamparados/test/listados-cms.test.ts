// test/listados-cms.test.ts
//
// Búsqueda, filtros y orden de los listados del CMS: censo, enseres, ropero,
// recibos y libro mayor. Los esquemas se prueban sin base de datos; las
// consultas, contra MariaDB (sobre todo `nulls: 'last'`, que Prisma traduce
// distinto en cada motor).

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomInt } from 'node:crypto';
import db from '../src/config/db.js';
import { ORDENES_CENSO, ORDENES_ENSERES, ORDENES_LIBRO, ORDENES_PRENDAS, ORDENES_RECIBOS, ordenDe } from '../src/domain/ordenacion.js';
import { searchHermanoSchema } from '../src/schemas/hermano.schema.js';
import { queryEnserSchema, queryPrendaSchema } from '../src/schemas/inventario.schema.js';
import { adminRecibosQuerySchema, adminResumenQuerySchema } from '../src/schemas/recibo.schema.js';
import { libroMayorQuerySchema, resumenQuerySchema } from '../src/schemas/transaccion.schema.js';
import { InventarioService } from '../src/services/inventario.service.js';
import { ReciboService } from '../src/services/recibo.service.js';
import { TransaccionService } from '../src/services/transaccion.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { diaMadrid, inicioDiaMadrid } from '../src/domain/contabilidad.js';
import { CensoService } from '../src/services/censo.service.js';
import { SIN_DB } from './fixtures/sin-db.js';


const valida = (esquema: { onDeepUndeclaredKey: (m: 'delete') => (d: unknown) => unknown }, query: Record<string, string>) =>
  !(esquema.onDeepUndeclaredKey('delete')({ query, body: {}, params: {} }) as { summary?: string }).summary;

describe('ordenDe', () => {
  test('sin orden, o con uno desconocido, usa el primero de la tabla', () => {
    assert.equal(ordenDe(ORDENES_CENSO, undefined), ORDENES_CENSO.apellidos);
    assert.equal(ordenDe(ORDENES_CENSO, 'iban'), ORDENES_CENSO.apellidos);
    assert.equal(ordenDe(ORDENES_CENSO, 'numero'), ORDENES_CENSO.numero);
  });

  test('todos los órdenes acaban en el id: sin eso, skip/take repite o pierde filas', () => {
    for (const tabla of [ORDENES_CENSO, ORDENES_ENSERES, ORDENES_PRENDAS, ORDENES_RECIBOS, ORDENES_LIBRO]) {
      for (const [nombre, orden] of Object.entries(tabla)) {
        assert.ok('id' in (orden.at(-1) as object), `${nombre} no acaba en el id`);
      }
    }
  });
});

describe('los esquemas aceptan los órdenes de su tabla y nada más', () => {
  test('censo', () => {
    assert.ok(valida(searchHermanoSchema, { orden: 'numero', estado: 'baja', numero: 'sin' }));
    assert.ok(!valida(searchHermanoSchema, { orden: 'iban' }));
    assert.ok(!valida(searchHermanoSchema, { estado: 'borrado' }));
  });

  test('inventario', () => {
    assert.ok(valida(queryEnserSchema, { orden: 'reparar', ubicacion: 'Sacristía' }));
    assert.ok(!valida(queryEnserSchema, { orden: 'numero' }));
    assert.ok(valida(queryPrendaSchema, { orden: 'talla', q: 'pérez' }));
    assert.ok(!valida(queryPrendaSchema, { orden: 'reparar' }));
  });

  test('recibos', () => {
    assert.ok(valida(adminRecibosQuerySchema, { orden: 'importeDesc', tipo: 'DONATIVO', q: 'ana' }));
    assert.ok(!valida(adminRecibosQuerySchema, { orden: 'fecha' }));
    assert.ok(!valida(adminRecibosQuerySchema, { tipo: 'MULTA' }));
    assert.ok(valida(adminResumenQuerySchema, { year: '2026', tipo: 'DONATIVO', q: 'ana' }));
    assert.ok(!valida(adminResumenQuerySchema, { year: '26' }));
  });

  test('libro mayor, y el resumen no tiene orden (lo descarta, no lo rechaza)', () => {
    assert.ok(valida(libroMayorQuerySchema, { orden: 'concepto' }));
    assert.ok(!valida(libroMayorQuerySchema, { orden: 'categoria' }));
    const resumen = resumenQuerySchema.onDeepUndeclaredKey('delete')({ query: { orden: 'concepto' }, body: {}, params: {} }) as { query: Record<string, string> };
    assert.equal(resumen.query.orden, undefined);
  });
});

describe('consultas contra la base de datos', () => {
  let dbDisponible = false;
  // Una marca que no exista en la base de desarrollo, para buscar solo lo nuestro.
  const marca = `Zlst${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`;
  const numero = 900_000_000 + randomInt(0, 99_999_999);
  let userId = 0;
  const ids = { hermanos: [] as number[], enseres: [] as number[], prendas: [] as number[], recibos: [] as number[] };

  before(async () => {
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
    if (!dbDisponible) return;
    userId = (await crearUsuarioPrueba()).id;
    const hermano = (apellidos: string, datos: object) => db.hermano.create({
      data: { nombre: 'Prueba', apellidos: `${marca} ${apellidos}`, fechaNacimiento: new Date('1990-01-01'), userId, ...datos },
    });
    const conNumero = await hermano('Alfa', { activo: true, numeroHermano: numero, fechaAlta: new Date('2001-01-01') });
    const sinNumero = await hermano('Beta', { activo: true, fechaAlta: new Date('2010-01-01') });
    const deBaja = await hermano('Gamma', { activo: false, fechaBaja: new Date('2020-01-01'), fechaAlta: new Date('2005-01-01') });
    const pendiente = await hermano('Delta', { activo: false, fechaAlta: new Date('2024-01-01') });
    ids.hermanos.push(conNumero.id, sinNumero.id, deBaja.id, pendiente.id);

    ids.recibos.push(
      (await db.recibo.create({ data: { hermanoId: conNumero.id, year: 2026, concepto: `Donativo ${marca}`, importe: 10, tipo: 'DONATIVO' } })).id,
      (await db.recibo.create({ data: { hermanoId: conNumero.id, year: 2026, concepto: `Cuota ${marca}`, importe: 30, tipo: 'CUOTA_HERMANO' } })).id,
      (await db.recibo.create({ data: { hermanoId: sinNumero.id, year: 2026, concepto: `Cuota ${marca}`, importe: 20, tipo: 'CUOTA_HERMANO' } })).id,
    );

    ids.enseres.push(
      (await db.enser.create({ data: { nombre: `Ciriales ${marca}`, ubicacion: `Sacristía ${marca}`, cantidadTotal: 4, cantidadReparar: 1 } })).id,
      (await db.enser.create({ data: { nombre: `Varales ${marca}`, ubicacion: `Almacén ${marca}`, categoria: `Trono ${marca}`, cantidadTotal: 12 } })).id,
    );

    ids.prendas.push(
      (await db.prenda.create({ data: { numero: `TUN-${marca}`, tipo: 'TUNICA', estado: 'PRESTADA', hermanoId: conNumero.id } })).id,
      (await db.prenda.create({ data: { numero: `CAP-${marca}`, tipo: 'CAPIROTE', observaciones: `Guardada por ${marca}` } })).id,
    );
  });

  after(async () => {
    if (dbDisponible) {
      await db.prenda.deleteMany({ where: { id: { in: ids.prendas } } });
      await db.enser.deleteMany({ where: { id: { in: ids.enseres } } });
      await db.recibo.deleteMany({ where: { id: { in: ids.recibos } } });
      await db.hermano.deleteMany({ where: { id: { in: ids.hermanos } } });
      if (userId) await borrarUsuarioPrueba(userId);
    }
    await db.$disconnect();
  });

  const apellidos = (lista: { apellidos: string }[]) => lista.map((h) => h.apellidos.replace(`${marca} `, ''));

  test('censo: la situación separa activos, bajas y solicitudes pendientes', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const de = async (estado: 'activo' | 'baja' | 'pendiente') => apellidos((await CensoService.searchHermanos({ q: marca, estado })).data)
    assert.deepEqual(await de('activo'), ['Alfa', 'Beta']);
    assert.deepEqual(await de('baja'), ['Gamma']);
    assert.deepEqual(await de('pendiente'), ['Delta']);
  });

  test('censo: con o sin número, y el número suelto encuentra al hermano', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.deepEqual(apellidos((await CensoService.searchHermanos({ q: marca, numero: 'con' })).data), ['Alfa']);
    assert.equal((await CensoService.searchHermanos({ q: marca, numero: 'sin' })).meta.total, 3);
    assert.deepEqual(apellidos((await CensoService.searchHermanos({ q: String(numero) })).data), ['Alfa']);
  });

  test('censo: por número deja a los que no lo tienen al final; por antigüedad, el más antiguo arriba', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal(apellidos((await CensoService.searchHermanos({ q: marca, orden: 'numero' })).data)[0], 'Alfa');
    assert.deepEqual(apellidos((await CensoService.searchHermanos({ q: marca, orden: 'antiguedad' })).data), ['Alfa', 'Gamma', 'Beta', 'Delta']);
    assert.deepEqual(apellidos((await CensoService.searchHermanos({ q: marca, orden: 'recientes' })).data), ['Delta', 'Beta', 'Gamma', 'Alfa']);
  });

  test('recibos: busca por concepto, hermano o número; filtra por tipo y ordena por importe', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const importes = async (consulta: object) => (await ReciboService.getAdminRecibos(consulta)).data.map((r) => Number(r.importe));
    assert.deepEqual(await importes({ q: marca, orden: 'importeDesc' }), [30, 20, 10]);
    assert.deepEqual(await importes({ q: marca, orden: 'importeAsc' }), [10, 20, 30]);
    assert.deepEqual(await importes({ q: `cuota ${marca}`, orden: 'importeAsc' }), [20, 30]);
    assert.deepEqual(await importes({ q: marca, tipo: 'DONATIVO' }), [10]);
    assert.deepEqual(await importes({ q: String(numero), orden: 'importeAsc' }), [10, 30]);
    assert.deepEqual(await importes({ q: `${marca} beta` }), [20]);
  });

  test('recibos: el resumen cuenta y suma por estado con los mismos filtros, y trae los estados vacíos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { estados } = await ReciboService.getResumenAdmin({ q: marca });
    assert.deepEqual(estados.PENDIENTE, { cuenta: 3, total: 60 });
    assert.deepEqual(estados.DEVUELTO, { cuenta: 0, total: 0 });
    assert.equal(Object.keys(estados).length, 6);
    const soloDonativos = await ReciboService.getResumenAdmin({ q: marca, tipo: 'DONATIVO' }, 2026);
    assert.deepEqual(soloDonativos.estados.PENDIENTE, { cuenta: 1, total: 10 });
  });

  test('enseres: la búsqueda entra en la ubicación, se filtra por ubicación y se ordena por unidades', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const nombres = async (consulta: object) => (await InventarioService.getAllEnseres(consulta)).data.map((e) => e.nombre.split(' ')[0]);
    assert.deepEqual(await nombres({ search: `sacristía ${marca}` }), ['Ciriales']);
    assert.deepEqual(await nombres({ ubicacion: `Almacén ${marca}` }), ['Varales']);
    assert.deepEqual(await nombres({ search: marca, orden: 'unidades' }), ['Varales', 'Ciriales']);
    assert.deepEqual(await nombres({ search: marca, orden: 'reparar' }), ['Ciriales', 'Varales']);
    // Sin categoría al final aunque el orden sea ascendente.
    assert.deepEqual(await nombres({ search: marca, orden: 'categoria' }), ['Varales', 'Ciriales']);
  });

  test('enseres: las opciones del filtro traen las categorías y ubicaciones en uso', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const opciones = await InventarioService.opcionesEnseres();
    assert.ok(opciones.categorias.includes(`Trono ${marca}`));
    assert.ok(opciones.ubicaciones.includes(`Sacristía ${marca}`));
    assert.ok(opciones.ubicaciones.includes(`Almacén ${marca}`));
  });

  test('ropero: busca en la prenda y en quien la tiene prestada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const numeros = async (consulta: object) => (await InventarioService.getAllPrendas(consulta)).data.map((p) => p.numero.split('-')[0]);
    assert.deepEqual(await numeros({ q: `${marca} alfa` }), ['TUN']);
    assert.deepEqual(await numeros({ q: `guardada ${marca}` }), ['CAP']);
    assert.deepEqual(await numeros({ q: marca, orden: 'tipo' }), ['TUN', 'CAP']);
    assert.deepEqual(await numeros({ q: marca, tipo: 'CAPIROTE' }), ['CAP']);
  });

  test('todos los órdenes de todas las tablas se pueden pedir a MariaDB', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    for (const orden of Object.keys(ORDENES_CENSO)) await CensoService.searchHermanos({ orden, limit: '5' });
    for (const orden of Object.keys(ORDENES_ENSERES)) await InventarioService.getAllEnseres({ orden, limit: '5' });
    for (const orden of Object.keys(ORDENES_PRENDAS)) await InventarioService.getAllPrendas({ orden, limit: '5' });
    for (const orden of Object.keys(ORDENES_RECIBOS)) await ReciboService.getAdminRecibos({ orden, limit: '5' });
    for (const orden of Object.keys(ORDENES_LIBRO)) await TransaccionService.getAll({ orden, limit: '5' });
  });

  test('categorías: cada una trae sus apuntes e importe del año, y juntas suman los del año', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const categorias = await TransaccionService.getCategorias(undefined, true);
    assert.ok(categorias.every((c) => Number.isInteger(c.usoAnio.apuntes) && typeof c.usoAnio.importe === 'number'));
    const inicioAnio = inicioDiaMadrid(`${diaMadrid(new Date()).slice(0, 4)}-01-01`);
    const delAnio = await db.transaccion.count({ where: { fecha: { gte: inicioAnio } } });
    assert.equal(categorias.reduce((s, c) => s + c.usoAnio.apuntes, 0), delAnio);
  });

  test('libro mayor: por importe, el mayor arriba', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { data } = await TransaccionService.getAll({ orden: 'importeDesc', limit: '20' });
    const importes = data.map((a) => Number(a.importe));
    assert.deepEqual(importes, [...importes].sort((a, b) => b - a));
  });
});
