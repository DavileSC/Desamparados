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
import type { CreateHermanoDto } from '../src/dtos/hermano.dto.js';

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
  // Un solo after() y el disconnect al final (como permisos-hermano-mayor.test.ts):
  // con el disconnect en un after() aparte y declarado ANTES de este, Node ejecuta
  // los after() en el orden en que se registran, así que la limpieza de aquí
  // llegaba a un cliente ya desconectado. Prisma reconecta solo para la consulta,
  // pero nada volvía a cerrar esa conexión y el proceso se quedaba colgado sin
  // salir nunca (confirmado a mano: sin este cambio, `tsx --test` no termina).
  await db.$disconnect();
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

// Red de la regla completa: toda ficha activa tiene número. Una pendiente de
// aprobación no lo tiene, y una de baja lo libera. Estos tres tests recorren
// las cuatro vías de alta (alta familiar, aprobación, baja y reactivación) y
// fallan si alguna se la salta.

test('una ficha recién creada por su tutor nace sin número, y lo recibe al aprobarla', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const tutor = await crearUsuarioPrueba();
  usuariosCreados.push(tutor.id);

  const datosFicha: CreateHermanoDto = { nombre: 'Hija', apellidos: 'De Prueba', fechaNacimiento: '2015-05-20' };
  const ficha = await HermanoService.createDependentProfile(tutor.id, datosFicha);

  // Pendiente de aprobación: activo false y sin número. Lo contrario sería
  // colar a alguien en el censo sin que Secretaría lo admita.
  assert.equal(ficha.activo, false);
  assert.equal(ficha.numeroHermano, null);

  await HermanoService.aprobarSolicitud(tutor.id);

  const aprobada = await db.hermano.findUnique({ where: { id: ficha.id } });
  assert.equal(aprobada?.activo, true);
  assert.ok(aprobada?.numeroHermano, 'al aprobar debe llevarse número');
});

test('dar de baja libera el número y reactivar da uno nuevo', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const tutor = await crearUsuarioPrueba();
  usuariosCreados.push(tutor.id);
  const datosFicha: CreateHermanoDto = { nombre: 'Alta', apellidos: 'Y Baja', fechaNacimiento: '1990-01-01' };
  const ficha = await HermanoService.createDependentProfile(tutor.id, datosFicha);
  await HermanoService.aprobarSolicitud(tutor.id);

  await HermanoService.darDeBajaHermano(ficha.id);
  const deBaja = await db.hermano.findUnique({ where: { id: ficha.id } });
  assert.equal(deBaja?.activo, false);
  assert.equal(deBaja?.numeroHermano, null, 'la baja libera el número');

  await HermanoService.reactivarHermano(ficha.id);
  const reactivada = await db.hermano.findUnique({ where: { id: ficha.id } });
  assert.equal(reactivada?.activo, true);
  assert.ok(reactivada?.numeroHermano, 'al reactivar debe llevarse número nuevo');
});

test('no queda ningún hermano activo sin número tras cerrar huecos', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  await HermanoService.cerrarHuecosDeNumero();
  const huerfanos = await db.hermano.count({ where: { activo: true, numeroHermano: null } });
  assert.equal(huerfanos, 0, 'la regla es que toda ficha activa tiene número');
});
