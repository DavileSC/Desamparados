// Los topes de la cola de correos: OVH corta en unos 200 por hora y cuenta,
// así que lo que no cabe en la hora o en el día espera sin que nadie haga nada,
// y la pantalla de envíos dice por qué espera.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, afterEach, before, test } from 'node:test';
import db from '../src/config/db.js';
import { colaTerminada, despertarCola, enviadosEnLaUltimaHora, enviadosHoy, resumenDeEnvios } from '../src/services/correos/cola.js';
import { ponerTransporte } from '../src/services/correos/envio.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;

before(async () => {
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  ponerTransporte({ sendMail: async () => ({}) });
});

afterEach(() => {
  delete process.env.CORREOS_MASIVOS_POR_DIA;
  delete process.env.CORREOS_MASIVOS_POR_HORA;
});

after(async () => {
  ponerTransporte(undefined);
  await db.$disconnect();
});

test('con el tope de la hora alcanzado, lo que falta espera sin darlo por mañana', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const lote = `prueba:${crypto.randomUUID()}`.slice(0, 60);
  // Muy antiguos: salen antes que cualquier otra cosa que espere en la base de pruebas.
  const viejo = new Date(Date.UTC(2000, 0, 1));
  await db.correoEnCola.createMany({
    data: [1, 2, 3].map((n) => ({ lote, titulo: 'Prueba de la hora', para: `hora-${n}-${crypto.randomUUID()}@ejemplo.test`, asunto: 'Hora', html: '<p>Hora</p>', uso: 'prueba', creadoEn: viejo })),
  });
  try {
    await colaTerminada();
    process.env.CORREOS_MASIVOS_POR_HORA = String((await enviadosEnLaUltimaHora()) + 2);
    await despertarCola();
    await colaTerminada();

    const filas = await db.correoEnCola.findMany({ where: { lote }, orderBy: { id: 'asc' } });
    assert.deepEqual(filas.map((f) => f.estado), ['ENVIADO', 'ENVIADO', 'PENDIENTE']);
    assert.equal((await resumenDeEnvios()).envios.find((e) => e.clave === lote)?.estado, 'ENVIANDO');
  } finally {
    await db.correoEnCola.deleteMany({ where: { lote } });
  }
});

test('con el tope del día alcanzado, lo que falta espera y la lista lo dice', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const lote = `prueba:${crypto.randomUUID()}`.slice(0, 60);
  const viejo = new Date(Date.UTC(2000, 0, 1));
  await db.correoEnCola.createMany({
    data: [1, 2, 3].map((n) => ({ lote, titulo: 'Prueba del tope', para: `tope-${n}-${crypto.randomUUID()}@ejemplo.test`, asunto: 'Tope', html: '<p>Tope</p>', uso: 'prueba', creadoEn: viejo })),
  });
  try {
    await colaTerminada();
    process.env.CORREOS_MASIVOS_POR_DIA = String((await enviadosHoy()) + 1);
    await despertarCola();
    await colaTerminada();

    const filas = await db.correoEnCola.findMany({ where: { lote }, orderBy: { id: 'asc' } });
    assert.deepEqual(filas.map((f) => f.estado), ['ENVIADO', 'PENDIENTE', 'PENDIENTE']);
    const envio = (await resumenDeEnvios()).envios.find((e) => e.clave === lote);
    assert.equal(envio?.estado, 'SIGUE_MANANA');
    assert.equal(envio?.enviados, 1);
    assert.equal(envio?.pendientes, 2);
  } finally {
    await db.correoEnCola.deleteMany({ where: { lote } });
  }
});
