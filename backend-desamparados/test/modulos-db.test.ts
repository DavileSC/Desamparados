// El estado de los módulos contra MariaDB: la siembra crea lo que falta y no
// pisa lo que Administración cambió; cambiar respeta las dependencias y deja
// auditoría; el recuento dice cuántos datos tiene cada módulo.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import db from '../src/config/db.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { ModulosService, siModulo } from '../src/services/modulos.service.js';
import { CLAVES_MODULO } from '../src/domain/modulos.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;
/** Lo que había antes, para dejarlo igual. */
let estadoInicial: { clave: string; activo: boolean }[] = [];
const META = { userId: undefined, ip: '127.0.0.1', userAgent: 'prueba' };

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (!dbDisponible) return;
  await ModulosService.sembrar();
  estadoInicial = await db.modulo.findMany({ select: { clave: true, activo: true } });
});

after(async () => {
  if (dbDisponible) {
    for (const fila of estadoInicial) await db.modulo.update({ where: { clave: fila.clave }, data: { activo: fila.activo } });
    await db.auditLog.deleteMany({ where: { action: { in: [ACCIONES_AUDITORIA.MODULO_ENCENDER, ACCIONES_AUDITORIA.MODULO_APAGAR] }, userAgent: 'prueba' } });
    ModulosService.olvidar();
  }
  await db.$disconnect();
});

const activosEnBase = async () => new Set((await db.modulo.findMany({ where: { activo: true }, select: { clave: true } })).map((f) => f.clave));

describe('la siembra', () => {
  test('crea una fila por módulo del catálogo y no toca las que existen', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.modulo.update({ where: { clave: 'loteria' }, data: { activo: false } });
    await db.modulo.delete({ where: { clave: 'cartas' } });
    const creadas = await ModulosService.sembrar();
    assert.equal(creadas, 1, 'solo la que faltaba');
    const filas = await db.modulo.findMany({ select: { clave: true, activo: true } });
    assert.equal(filas.length, CLAVES_MODULO.length);
    assert.equal(filas.find((f) => f.clave === 'loteria')?.activo, false, 'lo apagado sigue apagado');
    assert.equal(filas.find((f) => f.clave === 'cartas')?.activo, true, 'la nueva arranca con el lote');
    await db.modulo.update({ where: { clave: 'loteria' }, data: { activo: true } });
  });

  test('un módulo del catálogo que el lote no nombra arranca apagado', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.modulo.delete({ where: { clave: 'cabildos' } });
    await ModulosService.sembrar(['noticias']);
    assert.equal((await db.modulo.findUnique({ where: { clave: 'cabildos' } }))?.activo, false);
    await db.modulo.update({ where: { clave: 'cabildos' }, data: { activo: true } });
  });
});

describe('en memoria', () => {
  test('cargar lee la base y activo() responde sin volver a leerla', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    ModulosService.olvidar();
    const activos = await ModulosService.activos();
    assert.deepEqual([...activos].sort(), [...(await activosEnBase())].sort());
    await db.modulo.update({ where: { clave: 'loteria' }, data: { activo: false } });
    assert.equal(await ModulosService.activo('loteria'), true, 'la memoria no cambia hasta recargar');
    await ModulosService.cargar();
    assert.equal(await ModulosService.activo('loteria'), false);
    await db.modulo.update({ where: { clave: 'loteria' }, data: { activo: true } });
    await ModulosService.cargar();
  });

  test('siModulo hace la acción solo con el módulo encendido', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal(await siModulo('loteria', async () => 'hecho'), 'hecho');
    await ModulosService.cambiar('loteria', false, {}, undefined, META);
    assert.equal(await siModulo('loteria', async () => 'hecho'), undefined);
    await ModulosService.cambiar('loteria', true, {}, undefined, META);
  });
});

describe('cambiar', () => {
  test('encender con requisitos apagados: no lo hace y dice cuáles faltan', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await ModulosService.cambiar('tienda-web', false, {}, undefined, META);
    await ModulosService.cambiar('tienda', false, {}, undefined, META);
    const r = await ModulosService.cambiar('tienda-web', true, {}, undefined, META);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.deepEqual(r.faltan, ['tienda']);
      assert.match(r.message, /«Tienda»/);
    }
    assert.equal(await ModulosService.activo('tienda-web'), false);
  });

  test('con conRequisitos enciende primero lo que falta y lo audita todo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const r = await ModulosService.cambiar('tienda-web', true, { conRequisitos: true }, undefined, META);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.cambiados, ['tienda', 'tienda-web']);
    assert.equal(await ModulosService.activo('tienda'), true);
    assert.equal(await ModulosService.activo('tienda-web'), true);
    // entityId acotado a lo que toca esta llamada: «en memoria» ya encendió
    // «loteria» antes (con su propio MODULO_ENCENDER, mismo userAgent), y ese
    // apunte no es de este cambio.
    const auditados = await db.auditLog.findMany({
      where: { action: ACCIONES_AUDITORIA.MODULO_ENCENDER, userAgent: 'prueba', entityId: { in: ['tienda', 'tienda-web'] } },
      orderBy: { id: 'asc' },
    });
    assert.deepEqual(auditados.map((a) => a.entityId), ['tienda', 'tienda-web']);
    assert.deepEqual(auditados[0].detalles, { porRequisitoDe: 'tienda-web' });
  });

  test('apagar con dependientes encendidos: no lo hace y dice cuáles', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const r = await ModulosService.cambiar('pago-en-linea', false, {}, undefined, META);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.deepEqual(r.dependientes.sort(), ['apadrinamientos', 'cuotas-en-linea', 'donativos', 'tienda-web']);
      assert.match(r.message, /No se puede apagar «Pago en línea»/);
    }
    assert.equal(await ModulosService.activo('pago-en-linea'), true);
  });

  test('apagar uno sin dependientes: apaga, queda en la base y en la auditoría, con quién', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const admin = await db.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, email: true } });
    const r = await ModulosService.cambiar('loteria', false, {}, admin?.id, META);
    assert.equal(r.ok, true);
    assert.equal(await ModulosService.activo('loteria'), false);
    const fila = await db.modulo.findUnique({ where: { clave: 'loteria' } });
    assert.equal(fila?.activo, false);
    assert.equal(fila?.cambiadoPor, admin?.email ?? null);
    const auditado = await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.MODULO_APAGAR, entityId: 'loteria', userAgent: 'prueba' } });
    assert.ok(auditado);
    await ModulosService.cambiar('loteria', true, {}, undefined, META);
  });

  test('una clave que no es del catálogo es un 404', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(ModulosService.cambiar('tiendaa', true, {}, undefined, META), (e: Error & { status?: number }) => e.status === 404);
  });
});

describe('la lista del CMS', () => {
  test('una ficha por módulo, con su estado y cuántos datos tiene', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const lista = await ModulosService.listarCms();
    assert.deepEqual(lista.map((m) => m.clave), [...CLAVES_MODULO]);
    const tienda = lista.find((m) => m.clave === 'tienda')!;
    assert.equal(typeof tienda.activo, 'boolean');
    assert.deepEqual(tienda.datos.map((d) => d.que), ['productos', 'ventas de caja']);
    assert.ok(tienda.datos.every((d) => Number.isInteger(d.total) && d.total >= 0));
    assert.deepEqual(lista.find((m) => m.clave === 'contabilidad')!.datos, [], 'el libro es del núcleo: la pantalla no tiene datos propios');
  });
});
