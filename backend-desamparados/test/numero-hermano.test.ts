// test/numero-hermano.test.ts
// El cierre de huecos reparte número de hermano a las fichas activas que no
// lo tienen (el censo real llega así), sin tocar a quien ya lo tiene. Sondeo
// de base de datos copiado de test/permisos-hermano-mayor.test.ts: sin
// MariaDB levantada estos tests se omiten con motivo, el CI no la levanta.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import { AuditoriaService } from '../src/services/auditoria.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import type { CreateHermanoDto } from '../src/dtos/hermano.dto.js';
import { SolicitudesService } from '../src/services/solicitudes.service.js';
import { MisFichasService } from '../src/services/mis-fichas.service.js';
import { CensoService } from '../src/services/censo.service.js';

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

  const { asignados } = await SolicitudesService.cerrarHuecosDeNumero();

  const idsAsignados = asignados.map((a) => a.id);
  assert.ok(idsAsignados.includes(antigua.id), 'la ficha antigua debe recibir número');
  assert.ok(idsAsignados.includes(reciente.id), 'la ficha reciente debe recibir número');

  // Por antigüedad: quien lleva desde 1995 va antes que quien entró en 2020.
  const numAntigua = asignados.find((a) => a.id === antigua.id)!.numeroHermano;
  const numReciente = asignados.find((a) => a.id === reciente.id)!.numeroHermano;
  assert.ok(numAntigua < numReciente, `${numAntigua} debería ir antes que ${numReciente}`);
});

test('con la misma fecha de alta, el desempate por id da un orden estable', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  // fichaActivaSinNumero() siempre pone la misma fechaAlta (1995-03-10): las
  // dos fichas empatan a propósito, para probar el `id asc` de desempate que
  // usa cerrarHuecosDeNumero (sin él, MariaDB decidiría el orden y el
  // resultado no sería repetible de una pasada a otra).
  const primera = await fichaActivaSinNumero();
  const segunda = await fichaActivaSinNumero();
  assert.equal(primera.fechaAlta.getTime(), segunda.fechaAlta.getTime(), 'la prueba exige la fecha empatada');

  const { asignados } = await SolicitudesService.cerrarHuecosDeNumero();

  const numPrimera = asignados.find((a) => a.id === primera.id)!.numeroHermano;
  const numSegunda = asignados.find((a) => a.id === segunda.id)!.numeroHermano;
  assert.ok(
    numPrimera < numSegunda,
    `con la fecha empatada, la ficha creada antes (id ${primera.id}) debería ir antes que la creada después (id ${segunda.id})`
  );
});

test('el cierre de huecos no renumera a quien ya tiene número', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const conNumero = await db.hermano.findFirst({
    where: { activo: true, numeroHermano: { not: null } },
    select: { id: true, numeroHermano: true },
  });
  if (!conNumero) return t.skip('no hay ninguna ficha con número en la base');

  await fichaActivaSinNumero();
  await SolicitudesService.cerrarHuecosDeNumero();

  const despues = await db.hermano.findUnique({ where: { id: conNumero.id }, select: { numeroHermano: true } });
  assert.equal(despues?.numeroHermano, conNumero.numeroHermano, 'no se renumera a nadie');
});

test('sin huecos, el cierre no hace nada', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  await SolicitudesService.cerrarHuecosDeNumero();
  const segunda = await SolicitudesService.cerrarHuecosDeNumero();
  assert.deepEqual(segunda.asignados, [], 'la segunda pasada no debe tocar nada');
});

// Red de la regla completa: toda ficha activa tiene número. Una pendiente de
// aprobación no lo tiene, y una de baja lo libera. Los dos primeros tests
// comprueban cada transición por separado (alta familiar + aprobación; baja
// + reactivación). El tercero ejercita las cuatro vías sobre sus propias
// fichas y mira el estado que dejaron, sin pasar por cerrarHuecosDeNumero
// (esa llamada repararía cualquier hueco justo antes de buscarlo, y dejaría
// el test incapaz de ponerse rojo pasara lo que pasara).

test('una ficha recién creada por su tutor nace sin número, y lo recibe al aprobarla', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const tutor = await crearUsuarioPrueba();
  usuariosCreados.push(tutor.id);

  const datosFicha: CreateHermanoDto = { nombre: 'Hija', apellidos: 'De Prueba', fechaNacimiento: '2015-05-20' };
  const ficha = await MisFichasService.createDependentProfile(tutor.id, datosFicha);

  // Pendiente de aprobación: activo false y sin número. Lo contrario sería
  // colar a alguien en el censo sin que Secretaría lo admita.
  assert.equal(ficha.activo, false);
  assert.equal(ficha.numeroHermano, null);

  await SolicitudesService.aprobarSolicitud(tutor.id);

  const aprobada = await db.hermano.findUnique({ where: { id: ficha.id } });
  assert.equal(aprobada?.activo, true);
  assert.ok(aprobada?.numeroHermano, 'al aprobar debe llevarse número');
});

test('dar de baja libera el número y reactivar da uno nuevo', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const tutor = await crearUsuarioPrueba();
  usuariosCreados.push(tutor.id);
  const datosFicha: CreateHermanoDto = { nombre: 'Alta', apellidos: 'Y Baja', fechaNacimiento: '2014-01-01' };
  const ficha = await MisFichasService.createDependentProfile(tutor.id, datosFicha);
  await SolicitudesService.aprobarSolicitud(tutor.id);

  // Sin este dato, "queda a null tras la baja" no demuestra que la baja
  // libere nada: podría no haber tenido número nunca. El test tiene que
  // sostenerse solo, sin fiarse de lo que comprobó el test anterior.
  const antesDeBaja = await db.hermano.findUnique({ where: { id: ficha.id }, select: { numeroHermano: true } });
  assert.ok(antesDeBaja?.numeroHermano, 'antes de la baja debe tener número: si no, la baja no libera nada');

  await CensoService.darDeBajaHermano(ficha.id);
  const deBaja = await db.hermano.findUnique({ where: { id: ficha.id } });
  assert.equal(deBaja?.activo, false);
  assert.equal(deBaja?.numeroHermano, null, 'la baja libera el número');

  await CensoService.reactivarHermano(ficha.id);
  const reactivada = await db.hermano.findUnique({ where: { id: ficha.id } });
  assert.equal(reactivada?.activo, true);
  assert.ok(reactivada?.numeroHermano, 'al reactivar debe llevarse número nuevo');
});

test('las fichas de este test no quedan activas sin número tras pasar por sus vías de alta', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const tutor = await crearUsuarioPrueba();
  usuariosCreados.push(tutor.id);

  // Dos fichas del mismo tutor. «Quieta» se queda tal cual la deja la
  // aprobación: es el canario de aprobarSolicitud, porque nada la vuelve a
  // tocar después. «Vaivén» sigue hasta baja y reactivación: es el canario
  // de reactivarHermano. Sin cerrarHuecosDeNumero de por medio, el recuento
  // de abajo mira el estado que dejaron las vías tal cual, no uno reparado.
  // Menores las dos: una ficha a cargo de otra cuenta es la de alguien que aún
  // no puede darse de alta por su cuenta (domain/fechas-hermano).
  const datosQuieta: CreateHermanoDto = { nombre: 'Quieta', apellidos: 'Tras Aprobar', fechaNacimiento: '2015-01-01' };
  const quieta = await MisFichasService.createDependentProfile(tutor.id, datosQuieta);

  const datosVaiven: CreateHermanoDto = { nombre: 'Va', apellidos: 'Y Viene', fechaNacimiento: '2016-01-01' };
  const vaiven = await MisFichasService.createDependentProfile(tutor.id, datosVaiven);

  await SolicitudesService.aprobarSolicitud(tutor.id); // aprueba las dos fichas pendientes del tutor de golpe

  await CensoService.darDeBajaHermano(vaiven.id);
  await CensoService.reactivarHermano(vaiven.id);

  // Acotado a las fichas de este test: un recuento sobre toda la tabla
  // Hermano podría ponerse rojo por datos de otra procedencia (otro censo
  // importado con huecos legítimos hasta que Secretaría pulse «Asignar
  // números», u otra suite) sin que hubiera ninguna regresión aquí.
  const huerfanos = await db.hermano.count({
    where: { id: { in: [quieta.id, vaiven.id] }, activo: true, numeroHermano: null }
  });
  assert.equal(huerfanos, 0, 'ninguna de las dos fichas de este test debe quedar activa sin número');
});

// --- La foto del censo que reordena se lee DENTRO de la transacción ---
//
// `reordenarCenso` corre dentro de `transaccionReintentable`, que repite el
// cuerpo entero ante un choque. Con las dos lecturas fuera, el reintento
// renumeraba sobre una foto vieja: quien entrase en el censo entre la lectura y
// el reintento se comía el `numeroHermano: null` del `updateMany`, no estaba en
// la lista que reparte 1..N, nadie le reasignaba y la transacción confirmaba una
// ficha activa sin número. Justo lo que esta suite defiende que no puede pasar.
//
// Estas dos pruebas sustituyen `db.$transaction` por uno de mentira para ver qué
// lee el cuerpo, así que no necesitan MariaDB. Si las lecturas volvieran a
// salirse de la transacción irían contra la base de verdad y ninguna pasaría.

type FichaLeida = { id: number; numeroHermano: number | null };

/** Cambia `db.$transaction` por uno que entrega `tx` y cuenta los intentos. */
function conTransaccionDeMentira(tx: unknown) {
  const original = db.$transaction;
  let intentos = 0;
  (db as unknown as Record<string, unknown>).$transaction = async (operacion: (tx: unknown) => Promise<unknown>) => {
    intentos += 1;
    return operacion(tx);
  };
  return {
    intentos: () => intentos,
    restaurar: () => { (db as unknown as Record<string, unknown>).$transaction = original; },
  };
}

/** Censo de mentira: responde a las dos lecturas y apunta lo que se escribe. */
function censoDeMentira(activos: FichaLeida[], inactivosConNumero: FichaLeida[] = []) {
  const asignados: { id: number; numeroHermano: number }[] = [];
  let liberaciones = 0;
  const tx = {
    hermano: {
      findMany: async ({ where }: { where: { activo: boolean } }) => (where.activo ? activos : inactivosConNumero),
      updateMany: async () => { liberaciones += 1; return { count: activos.length + inactivosConNumero.length }; },
      update: async ({ where, data }: { where: { id: number }; data: { numeroHermano: number } }) => {
        asignados.push({ id: where.id, numeroHermano: data.numeroHermano });
        return { id: where.id };
      },
    },
  };
  return { tx, asignados, liberaciones: () => liberaciones };
}

test('reordenar un censo sin activos sigue lanzando su HttpError, y a la primera', async () => {
  const { tx } = censoDeMentira([]);
  const transaccion = conTransaccionDeMentira(tx);
  try {
    await assert.rejects(
      () => SolicitudesService.reordenarCenso(),
      (e: unknown) => e instanceof HttpError && e.message === 'No hay hermanos activos en el censo para reordenar.'
    );
    // El error de negocio ahora se lanza dentro de la transacción. No es P2002
    // ni un conflicto transitorio, así que `esChoqueReintentable` no lo toma por
    // un choque: sale a la primera, sin repetir tres veces la misma negativa.
    assert.equal(transaccion.intentos(), 1, 'un error de negocio no se reintenta');
  } finally {
    transaccion.restaurar();
  }
});

test('la reordenación reparte 1..N sobre lo que lee dentro de la transacción', async (t) => {
  const { tx, asignados, liberaciones } = censoDeMentira(
    [{ id: 41, numeroHermano: 7 }, { id: 42, numeroHermano: null }],
    [{ id: 99, numeroHermano: 300 }]
  );
  const transaccion = conTransaccionDeMentira(tx);
  const auditados: unknown[] = [];
  t.mock.method(AuditoriaService, 'log', async (...args: unknown[]) => { auditados.push(args); });
  try {
    const resultado = await SolicitudesService.reordenarCenso();
    assert.equal(liberaciones(), 1, 'primero se liberan todos los números, que son únicos');
    assert.deepEqual(asignados, [{ id: 41, numeroHermano: 1 }, { id: 42, numeroHermano: 2 }]);
    // Las dos listas salen de la transacción para la auditoría y el recuento:
    // si se quedaran dentro, esto contaría el censo de verdad, no el leído.
    assert.equal(resultado.totalProcesados, 2, 'el recuento de vuelta es el de la lectura de dentro');
    assert.equal(auditados.length, 1, 'la reordenación se anota en la auditoría tras confirmar');
  } finally {
    transaccion.restaurar();
  }
});
