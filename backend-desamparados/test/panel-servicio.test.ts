// test/panel-servicio.test.ts
// Estos casos consultan la base de datos: sin MariaDB levantada se omiten con
// el motivo a la vista, igual que en integration.test.ts. El skip va DENTRO del
// cuerpo con t.skip(): en las opciones del runner de Node quedaría omitido
// para siempre.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Role } from '@prisma/client';
import db from '../src/config/db.js';
import { PanelService } from '../src/services/panel.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

let dbDisponible = false;
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

/**
 * Valores reconocibles del hermano de prueba. El panel es informativo y no
 * debe exponer ninguno: si alguno aparece en el JSON de la respuesta, se ha
 * colado un dato personal, se llame como se llame la clave que lo trajo.
 *
 * `tunica` usa una talla normal ('L'), no un valor "ZZTest...": porTalla la
 * agrega de verdad a partir de hermanos activos, así que una etiqueta
 * reconocible saldría en el panel de forma legítima (es un recuento
 * agregado, no un dato de esta persona) y rompería la comprobación de fugas
 * sin que hubiera ninguna fuga real. Con una talla normal no hace falta
 * excluir nada de la lista de valores prohibidos.
 */
const HERMANO_PRUEBA = {
  nombre: 'ZZTestNombre',
  apellidos: 'ZZTestApellidos',
  dni: '99999999Z',
  telefono: '600999999',
  email: 'zztest@ejemplo.invalido',
  direccion: 'Calle ZZTest 1',
  fechaNacimiento: new Date(Date.UTC(1990, 5, 15)),
  tunica: 'L',
  alturaHombro: 170,
};

let usuarioPruebaId: number | undefined;
let hermanoPruebaId: number | undefined;

before(async () => {
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const);
  dbDisponible = (await Promise.race([consulta, timeout])) === 'ok';
  if (!dbDisponible) return;

  // Sin esto, el panel se calcula sobre una base sin un solo Hermano, Recibo,
  // Transaccion, PapeletaSitio, Turno ni Cita (ni seed.ts ni seed-contenido.ts
  // crean ninguno): los tests pasarían en verde sin comprobar nada de verdad.
  const usuario = await crearUsuarioPrueba(Role.USER);
  usuarioPruebaId = usuario.id;
  const hermano = await db.hermano.create({
    data: {
      nombre: HERMANO_PRUEBA.nombre,
      apellidos: HERMANO_PRUEBA.apellidos,
      dni: HERMANO_PRUEBA.dni,
      telefono: HERMANO_PRUEBA.telefono,
      email: HERMANO_PRUEBA.email,
      direccion: HERMANO_PRUEBA.direccion,
      fechaNacimiento: HERMANO_PRUEBA.fechaNacimiento,
      tunica: HERMANO_PRUEBA.tunica,
      alturaHombro: HERMANO_PRUEBA.alturaHombro,
      activo: true,
      userId: usuario.id,
    },
  });
  hermanoPruebaId = hermano.id;
});

// Sin este cierre el proceso se queda colgado para siempre: el pool de
// conexiones de Prisma mantiene el bucle de eventos vivo aunque los tests ya
// hayan terminado. Mismo patrón que integration.test.ts.
after(async () => {
  if (hermanoPruebaId) await db.hermano.deleteMany({ where: { id: hermanoPruebaId } });
  if (usuarioPruebaId) await borrarUsuarioPrueba(usuarioPruebaId);
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
    const panel = await PanelService.getPanel();

    // Control positivo: si esto es 0, el hermano de prueba no se sembró (o no
    // cuenta como activo) y el resto de esta prueba no demuestra nada.
    assert.ok(
      panel.censo.activos > 0,
      'el test necesita al menos un hermano sembrado o no comprueba nada',
    );

    const json = JSON.stringify(panel);
    const jsonMinusculas = json.toLowerCase();

    // Red de seguridad por nombre de clave: si alguien añade un findMany
    // sobre Hermano, lo más probable es que asome alguno de estos campos.
    //
    // 'numeroHermano' se comprueba aparte (ver más abajo): en minúsculas
    // colisiona con el propio campo legítimo `sinNumeroHermano` del panel
    // ("sinnumerohermano".includes("numerohermano") es true), así que no
    // puede ir en esta lista sin generar un falso positivo permanente.
    for (const prohibido of [
      'dni',
      'iban',
      'telefono',
      'direccion',
      'apellidos',
      'email',
      'nombre',
      'fechanacimiento',
      'poblacion',
      'codigopostal',
      'titularcuenta',
      'hermanoid',
    ]) {
      assert.ok(!jsonMinusculas.includes(prohibido), `el panel no debe exponer ${prohibido}`);
    }

    // 'numeroHermano' propio (no el 'sinNumeroHermano' agregado y legítimo):
    // se busca la clave JSON exacta, con mayúsculas y comillas, que es como
    // saldría si alguien hiciera `select: { numeroHermano: true }` sobre un
    // Hermano y lo devolviera tal cual.
    assert.ok(!json.includes('"numeroHermano"'), 'el panel no debe exponer numeroHermano');

    // Red de seguridad por valor: aunque alguien renombrase las claves
    // (`{ correo: h.email }`, `{ nif: h.dni }`), los valores concretos del
    // hermano de prueba no deben aparecer en ningún sitio del panel.
    for (const valor of [
      HERMANO_PRUEBA.nombre,
      HERMANO_PRUEBA.apellidos,
      HERMANO_PRUEBA.dni,
      HERMANO_PRUEBA.telefono,
      HERMANO_PRUEBA.email,
      HERMANO_PRUEBA.direccion,
    ]) {
      assert.ok(!json.includes(valor), `el panel no debe exponer el valor de prueba ${valor}`);
    }
  });
});
