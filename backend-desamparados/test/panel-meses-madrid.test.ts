// test/panel-meses-madrid.test.ts
// El panel y la contabilidad tienen que contar igual: los mismos días, meses y
// años de Madrid, y las mismas altas. Antes el panel partía los meses en UTC
// (lo cobrado en la primera hora del día 1 caía en el mes anterior, y el
// ejercicio perdía la primera hora del 1 de enero) y contaba como altas las
// solicitudes pendientes. Consulta la base de datos: sin MariaDB se omite con
// motivo. Lo que crea lleva «ZZTest» y se borra al final.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Role, TipoTransaccion } from '@prisma/client';
import db from '../src/config/db.js';
import { PanelService } from '../src/services/panel.service.js';
import { TransaccionService } from '../src/services/transaccion.service.js';
import { diaMadrid, inicioDiaMadrid, unAnioAntes } from '../src/domain/contabilidad.js';
import { claveMes, whereAltasAprobadas } from '../src/domain/panel-censo.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;

let usuarioId: number | undefined;
const hermanos: Record<'pendiente' | 'aprobado' | 'deBaja', number> = { pendiente: 0, aprobado: 0, deBaja: 0 };
let categoriaId: number | undefined;
const transacciones: number[] = [];

const hoy = new Date();
const anio = Number(diaMadrid(hoy).slice(0, 4));
const mes = Number(diaMadrid(hoy).slice(5, 7));
const haceUnAnio = inicioDiaMadrid(unAnioAntes(diaMadrid(hoy)));

before(async () => {
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const);
  dbDisponible = (await Promise.race([consulta, timeout])) === 'ok';
  if (!dbDisponible) return;

  usuarioId = (await crearUsuarioPrueba(Role.USER)).id;
  const ficha = { apellidos: 'ZZTestPanel', fechaNacimiento: new Date(Date.UTC(1990, 5, 15)), userId: usuarioId };
  // Solicitud pendiente: activo:false y sin fecha de baja; su fechaAlta es la del registro.
  hermanos.pendiente = (await db.hermano.create({ data: { ...ficha, nombre: 'ZZTestPendiente', activo: false } })).id;
  hermanos.aprobado = (await db.hermano.create({ data: { ...ficha, nombre: 'ZZTestAprobado', activo: true } })).id;
  hermanos.deBaja = (await db.hermano.create({ data: { ...ficha, nombre: 'ZZTestDeBaja', activo: false, fechaBaja: new Date() } })).id;

  categoriaId = (await db.categoriaTransaccion.create({ data: { nombre: 'ZZTestPanelMadrid', tipo: TipoTransaccion.INGRESO } })).id;
  // 00:30 del 1 de enero en Madrid = 23:30 UTC del 31 de diciembre anterior.
  // Y la primera hora del día 1 del mes en curso (la víspera, 23:30 UTC).
  for (const fecha of [new Date(Date.UTC(anio - 1, 11, 31, 23, 30)), new Date(Date.UTC(anio, mes - 1, 0, 23, 30))]) {
    const t = await db.transaccion.create({
      data: { tipo: TipoTransaccion.INGRESO, categoriaId, concepto: 'ZZTestPanelMadrid', importe: 0.37, fecha, metodoPago: 'EFECTIVO' },
    });
    transacciones.push(t.id);
  }
});

after(async () => {
  if (dbDisponible) {
    await db.transaccion.deleteMany({ where: { id: { in: transacciones } } });
    if (categoriaId) await db.categoriaTransaccion.deleteMany({ where: { id: categoriaId } });
    await db.hermano.deleteMany({ where: { id: { in: Object.values(hermanos).filter(Boolean) } } });
    if (usuarioId) await borrarUsuarioPrueba(usuarioId);
  }
  await db.$disconnect();
});

const centimos = (n: number) => Math.round(n * 100) / 100;

/**
 * Compara dos lecturas de totales GLOBALES de la base de desarrollo. Los demás
 * ficheros de test corren a la vez y crean apuntes: si uno cae entre la lectura
 * del panel y la de contabilidad, las cifras difieren sin que haya fallo (así
 * salió una diferencia de 18 € exactos). Se repite unas veces: un desfase real
 * entre los dos cálculos se ve en todos los intentos; una carrera, en uno.
 */
async function cuadranAlgunaVez<T>(leer: () => Promise<[T, T]>, intentos = 4): Promise<[T, T]> {
  let ultima = await leer();
  for (let i = 1; i < intentos && JSON.stringify(ultima[0]) !== JSON.stringify(ultima[1]); i += 1) {
    await new Promise((r) => setTimeout(r, 150));
    ultima = await leer();
  }
  return ultima;
}

describe('el panel cuenta en días de Madrid, como la contabilidad (D13)', () => {
  test('los apuntes de prueba caen en el mes en curso y en el ejercicio, en Madrid', (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Control: si esto falla, el resto de este bloque no demuestra nada.
    assert.equal(claveMes(new Date(Date.UTC(anio, mes - 1, 0, 23, 30))), `${anio}-${String(mes).padStart(2, '0')}`);
    assert.equal(diaMadrid(new Date(Date.UTC(anio - 1, 11, 31, 23, 30))), `${anio}-01-01`);
  });

  test('el ejercicio del panel cuadra con la contabilidad del año, primera hora del 1 de enero incluida', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    let anioDelPanel = 0;
    const [delPanel, deContabilidad] = await cuadranAlgunaVez(async () => {
      const [panel, resumen] = await Promise.all([
        PanelService.getPanel(),
        TransaccionService.getResumen({ desde: `${anio}-01-01` }),
      ]);
      anioDelPanel = panel.dinero.ejercicio.anio;
      return [
        { ingresos: panel.dinero.ejercicio.ingresos, gastos: panel.dinero.ejercicio.gastos },
        { ingresos: centimos(resumen.totales.ingresos), gastos: centimos(resumen.totales.gastos) },
      ];
    });
    assert.equal(anioDelPanel, anio);
    assert.deepEqual(delPanel, deContabilidad);
  });

  test('el mes en curso del panel cuadra con el mismo mes de la contabilidad', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const clave = `${anio}-${String(mes).padStart(2, '0')}`;
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const [delPanel, deContabilidad] = await cuadranAlgunaVez(async () => {
      const [panel, resumen] = await Promise.all([
        PanelService.getPanel(),
        TransaccionService.getResumen({ desde: `${clave}-01`, hasta: `${clave}-${String(ultimoDia).padStart(2, '0')}` }),
      ]);
      const mesPanel = panel.dinero.serieMensual.find((p) => p.mes === clave);
      const mesContabilidad = resumen.serie.puntos.find((p) => p.clave === clave);
      assert.ok(mesPanel && mesContabilidad, 'falta el mes en curso en alguna de las dos series');
      return [
        { ingresos: mesPanel.ingresos, gastos: mesPanel.gastos },
        { ingresos: mesContabilidad.ingresos, gastos: mesContabilidad.gastos },
      ];
    });
    assert.deepEqual(delPanel, deContabilidad);
  });
});

describe('las altas del panel son hermanos aprobados (D13)', () => {
  test('una solicitud pendiente no es un alta; un aprobado, y uno que ya se dio de baja, sí', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const cuenta = (id: number) => db.hermano.count({ where: { AND: [whereAltasAprobadas(haceUnAnio), { id }] } });
    assert.equal(await cuenta(hermanos.pendiente), 0);
    assert.equal(await cuenta(hermanos.aprobado), 1);
    assert.equal(await cuenta(hermanos.deBaja), 1);
  });

  test('altas12m deja fuera las solicitudes pendientes', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const [panel, conPendientes] = await Promise.all([
      PanelService.getPanel(),
      db.hermano.count({ where: { fechaAlta: { gte: haceUnAnio } } }),
    ]);
    // Hay al menos una pendiente con fecha de alta reciente (la de prueba):
    // contándolas, saldría como mínimo una más.
    assert.ok(panel.censo.altas12m <= conPendientes - 1, `altas12m=${panel.censo.altas12m}, con pendientes=${conPendientes}`);
    assert.ok(panel.censo.altas12m >= 2, 'el aprobado y el de baja de prueba cuentan como altas');
  });
});
