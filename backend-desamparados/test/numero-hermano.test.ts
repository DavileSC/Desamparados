// test/numero-hermano.test.ts
// El cierre de huecos reparte número de hermano a las fichas activas que no
// lo tienen (el censo real llega así), sin tocar a quien ya lo tiene. Sondeo
// de base de datos copiado de test/permisos-hermano-mayor.test.ts: sin
// MariaDB levantada estos tests se omiten con motivo, el CI no la levanta.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import { HermanoService } from '../src/services/hermano.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

let dbDisponible = false;
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let motivoSinDb = '';

async function sondearDb(): Promise<boolean> {
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`
    .then(() => 'ok' as const)
    .catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));

  const resultado = await Promise.race([consulta, timeout]);
  if (resultado === 'ok') return true;

  motivoSinDb = resultado === 'timeout'
    ? `la conexión no respondió en 3 s (DATABASE_HOST=${process.env.DATABASE_HOST ?? 'sin definir'})`
    : resultado.message;
  return false;
}

before(async () => {
  dbDisponible = await sondearDb();
  if (!dbDisponible) {
    console.log(`
ℹ  Sin conexión a la base de datos: se omiten los tests que la necesitan.`);
    console.log(`   Motivo: ${motivoSinDb}`);
  }
});

after(async () => {
  await db.$disconnect();
});

const usuariosCreados: number[] = [];

async function fichaActivaSinNumero() {
  const user = await crearUsuarioPrueba();
  usuariosCreados.push(user.id);
  return db.hermano.create({
    data: {
      userId: user.id,
      nombre: 'Sin',
      apellidos: 'Numero',
      fechaNacimiento: new Date('1980-01-01'),
      fechaAlta: new Date('1995-03-10'),
      activo: true,
      numeroHermano: null,
    },
  });
}

after(async () => {
  await db.hermano.deleteMany({ where: { userId: { in: usuariosCreados } } });
  for (const id of usuariosCreados) await borrarUsuarioPrueba(id);
});

test('el cierre de huecos da número a las activas que no lo tienen', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const antigua = await fichaActivaSinNumero();
  const reciente = await db.hermano.update({
    where: { id: (await fichaActivaSinNumero()).id },
    data: { fechaAlta: new Date('2020-06-01') },
  });

  const { asignados } = await HermanoService.cerrarHuecosDeNumero();

  const idsAsignados = asignados.map((a) => a.id);
  assert.ok(idsAsignados.includes(antigua.id), 'la ficha antigua debe recibir número');
  assert.ok(idsAsignados.includes(reciente.id), 'la ficha reciente debe recibir número');

  // Por antigüedad: quien lleva desde 1995 va antes que quien entró en 2020.
  const numAntigua = asignados.find((a) => a.id === antigua.id)!.numeroHermano;
  const numReciente = asignados.find((a) => a.id === reciente.id)!.numeroHermano;
  assert.ok(numAntigua < numReciente, `${numAntigua} debería ir antes que ${numReciente}`);
});

test('el cierre de huecos no renumera a quien ya tiene número', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const conNumero = await db.hermano.findFirst({
    where: { activo: true, numeroHermano: { not: null } },
    select: { id: true, numeroHermano: true },
  });
  if (!conNumero) return t.skip('no hay ninguna ficha con número en la base');

  await fichaActivaSinNumero();
  await HermanoService.cerrarHuecosDeNumero();

  const despues = await db.hermano.findUnique({ where: { id: conNumero.id }, select: { numeroHermano: true } });
  assert.equal(despues?.numeroHermano, conNumero.numeroHermano, 'no se renumera a nadie');
});

test('sin huecos, el cierre no hace nada', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  await HermanoService.cerrarHuecosDeNumero();
  const segunda = await HermanoService.cerrarHuecosDeNumero();
  assert.deepEqual(segunda.asignados, [], 'la segunda pasada no debe tocar nada');
});
