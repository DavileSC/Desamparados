// test/panel-servicio.test.ts
// Estos casos consultan la base de datos: sin MariaDB levantada se omiten con
// el motivo a la vista, igual que en integration.test.ts. El skip va DENTRO del
// cuerpo con t.skip(): en las opciones del runner de Node quedaría omitido
// para siempre.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import db from '../src/config/db.js';
import { PanelService } from '../src/services/panel.service.js';

let dbDisponible = false;
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

before(async () => {
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const);
  dbDisponible = (await Promise.race([consulta, timeout])) === 'ok';
});

// Sin este cierre el proceso se queda colgado para siempre: el pool de
// conexiones de Prisma mantiene el bucle de eventos vivo aunque los tests ya
// hayan terminado. Mismo patrón que integration.test.ts.
after(async () => {
  await db.$disconnect();
});

describe('servicio del panel', () => {
  test('devuelve las cuatro secciones', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const panel = await PanelService.getPanel();
    assert.ok(panel.censo);
    assert.ok(panel.dinero);
    assert.ok(panel.procesion);
    assert.ok(panel.actividad);
    assert.match(panel.generadoEn, /^\d{4}-\d{2}-\d{2}T/);
  });

  test('el dinero llega como número, no como Decimal de Prisma', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const panel = await PanelService.getPanel();
    assert.equal(typeof panel.dinero.ejercicio.ingresos, 'number');
    assert.equal(typeof panel.dinero.ejercicio.gastos, 'number');
    assert.equal(typeof panel.dinero.ejercicio.saldo, 'number');
    for (const fila of panel.dinero.porEstado) {
      assert.equal(typeof fila.importe, 'number');
    }
    // Un Decimal serializado se cuela como objeto y llega roto al navegador.
    assert.ok(!Number.isNaN(panel.dinero.ejercicio.saldo));
  });

  test('la serie del censo trae doce meses en orden', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const panel = await PanelService.getPanel();
    assert.equal(panel.censo.serieMensual.length, 12);
    const meses = panel.censo.serieMensual.map((p) => p.mes);
    assert.deepEqual(meses, [...meses].sort());
  });

  test('el saldo es la resta de ingresos y gastos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ingresos, gastos, saldo } = (await PanelService.getPanel()).dinero.ejercicio;
    assert.equal(saldo, ingresos - gastos);
  });

  test('no devuelve ningún dato personal', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Red de seguridad de la regla de oro: si alguien añade un findMany sobre
    // Hermano, lo más probable es que asome un DNI, un IBAN o un email.
    const json = JSON.stringify(await PanelService.getPanel());
    for (const prohibido of ['dni', 'iban', 'telefono', 'direccion', 'apellidos', 'email']) {
      assert.ok(!json.toLowerCase().includes(prohibido), `el panel no debe exponer ${prohibido}`);
    }
  });
});
