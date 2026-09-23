// test/panel-servicio.test.ts
// Estos casos consultan la base de datos: sin MariaDB levantada se omiten con
// el motivo a la vista, igual que en integration.test.ts. El skip va DENTRO del
// cuerpo con t.skip(): en las opciones del runner de Node quedaría omitido
// para siempre.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Role, TipoTransaccion } from '@prisma/client';
import db from '../src/config/db.js';
import { PanelService } from '../src/services/panel.service.js';
import { claveMes } from '../src/domain/panel-censo.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { HttpError } from '../src/utils/error.handle.js';
import { rangoDelCurso } from '../src/domain/curso.js';
import { diaMadrid } from '../src/domain/contabilidad.js';

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
let categoriaPruebaId: number | undefined;
const transaccionesPruebaId: number[] = [];
const recibosPruebaId: number[] = [];

/**
 * Dos importes de dos decimales que, sumados tal cual en JS (sin pasar por
 * euros2), dan arrastre binario de verdad: 10.10 + 10.20 = 20.299999999999997.
 * Se insertan en dos fechas distintas del mes en curso para que panel.service
 * los agregue en groupBy(['tipo','fecha']) separados y los sume él mismo en
 * JS al construir la serie mensual, que es justo donde se cuela el arrastre.
 */
const IMPORTES_ARRASTRE = [10.1, 10.2] as const;

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

  // Dos recibos del mismo hermano en ejercicios distintos: sin esto, si la
  // base de pruebas solo tuviera recibos de un año, el test de la tarea 5
  // («los recibos se cuentan del ejercicio elegido, no de todos los años»)
  // pasaría por casualidad sin comprobar nada. Conceptos ZZTest... porque
  // Recibo tiene @@unique([hermanoId, year, concepto]).
  const anioActual = new Date().getFullYear();
  const reciboEjercicioActual = await db.recibo.create({
    data: { hermanoId: hermano.id, year: anioActual, concepto: 'ZZTestReciboEjercicioActual', importe: 10 },
  });
  const reciboEjercicioAnterior = await db.recibo.create({
    data: { hermanoId: hermano.id, year: anioActual - 1, concepto: 'ZZTestReciboEjercicioAnterior', importe: 10 },
  });
  recibosPruebaId.push(reciboEjercicioActual.id, reciboEjercicioAnterior.id);

  const categoria = await db.categoriaTransaccion.create({
    data: { nombre: 'ZZTestCategoriaArrastre', tipo: TipoTransaccion.INGRESO },
  });
  categoriaPruebaId = categoria.id;

  const hoy = new Date();
  for (const [i, importe] of IMPORTES_ARRASTRE.entries()) {
    // Un día distinto por importe, dentro del mes en curso: cada uno cae en
    // su propia fila de groupBy(['tipo','fecha']).
    const fecha = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1 + i));
    const transaccion = await db.transaccion.create({
      data: {
        tipo: TipoTransaccion.INGRESO,
        categoriaId: categoria.id,
        concepto: 'ZZTestArrastreBinario',
        importe,
        fecha,
      },
    });
    transaccionesPruebaId.push(transaccion.id);
  }
});

// Sin este cierre el proceso se queda colgado para siempre: el pool de
// conexiones de Prisma mantiene el bucle de eventos vivo aunque los tests ya
// hayan terminado. Mismo patrón que integration.test.ts.
after(async () => {
  if (transaccionesPruebaId.length > 0) {
    await db.transaccion.deleteMany({ where: { id: { in: transaccionesPruebaId } } });
  }
  if (categoriaPruebaId) await db.categoriaTransaccion.deleteMany({ where: { id: categoriaPruebaId } });
  if (recibosPruebaId.length > 0) {
    // Antes que el hermano: Recibo.hermanoId es una relación obligatoria sin
    // cascada, así que borrar el hermano primero dejaría recibos huérfanos y
    // Prisma rechazaría el borrado.
    await db.recibo.deleteMany({ where: { id: { in: recibosPruebaId } } });
  }
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
    // El servicio redondea el saldo a dos decimales, asi que comparar contra la
    // resta en crudo falla en cuanto hay centimos: 20.3 - 10.1 da
    // 10.200000000000001 en coma flotante, no 10.2. Se compara contra el mismo
    // redondeo, que es lo que de verdad promete el contrato.
    assert.equal(saldo, Math.round((ingresos - gastos) * 100) / 100);
  });

  test('el dinero sale redondeado a dos decimales, sin arrastre binario', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const panel = await PanelService.getPanel();

    const mesActual = claveMes(new Date());
    const filaMesActual = panel.dinero.serieMensual.find((m) => m.mes === mesActual);
    assert.ok(filaMesActual, 'no se encontró el mes en curso en la serie mensual');

    // Control positivo: sin esto, si por lo que sea las transacciones de
    // prueba no entraron en el mes en curso, el resto de esta prueba no
    // comprobaría nada. El umbral es 20.29 y no 20.3: sin redondear,
    // 10.10 + 10.20 da 20.299999999999997 en JS, que es MENOR que 20.3.
    assert.ok(
      filaMesActual!.ingresos >= 20.29,
      'el test necesita que los importes de prueba (10.10 + 10.20) entren en el mes en curso',
    );

    // Sin euros2, 10.10 + 10.20 sale como 20.299999999999997 al sumarlos en
    // JS (panel.service.ts, serieDinero): si el helper deja de aplicarse,
    // esta expresión regular deja de casar y el test falla.
    const dosDecimalesComoMucho = /^-?\d+(\.\d{1,2})?$/;
    for (const valor of [
      filaMesActual!.ingresos,
      filaMesActual!.gastos,
      panel.dinero.ejercicio.ingresos,
      panel.dinero.ejercicio.gastos,
      panel.dinero.ejercicio.saldo,
      ...panel.dinero.porEstado.map((f) => f.importe),
    ]) {
      assert.match(String(valor), dosDecimalesComoMucho, `${valor} tiene más de dos decimales`);
    }
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

  test('las altas y bajas de cada mes viajan con la serie del censo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const panel = await PanelService.getPanel();

    // Los mismos meses y en el mismo orden que la serie: las dos gráficas se
    // leen una encima de otra y un desfase las haría mentir.
    assert.deepEqual(
      panel.censo.movimientosMensuales.map((m) => m.mes),
      panel.censo.serieMensual.map((p) => p.mes),
    );
    for (const mes of panel.censo.movimientosMensuales) {
      assert.equal(typeof mes.altas, 'number');
      assert.equal(typeof mes.bajas, 'number');
      assert.ok(mes.altas >= 0 && mes.bajas >= 0, `${mes.mes} trae movimientos negativos`);
    }
  });

  test('cada categoría trae su importe además del número de apuntes', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const panel = await PanelService.getPanel();

    // Control positivo: el before() siembra una categoría de ingreso con dos
    // apuntes de 10,10 y 10,20 en el mes en curso.
    const prueba = panel.dinero.porCategoria.find((c) => c.categoria === 'ZZTestCategoriaArrastre');
    assert.ok(prueba, 'no se encontró la categoría de prueba; ¿se sembró?');
    assert.equal(prueba!.total, 2);
    assert.equal(prueba!.importe, 20.3); // sin arrastre binario: 20.299999999999997 fallaría

    for (const fila of panel.dinero.porCategoria) {
      assert.equal(typeof fila.importe, 'number');
      assert.ok(!Number.isNaN(fila.importe));
    }
  });

  test('el panel no devuelve el registro de auditoría', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const panel = await PanelService.getPanel();
    // La auditoría es privada y vive en su sección. Servirla en el Inicio la
    // repartía entre los seis cargos del CMS.
    assert.equal('registro' in panel.actividad, false);
  });
});

describe('el calendario del Inicio', () => {
  test('trae los actos y los días de reparto del mes en curso, y nada de otros meses', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // El día 15 del mes en curso a mediodía: cae dentro del mes en Madrid sea
    // cual sea el día de hoy.
    const ahora = new Date();
    const mediados = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 15, 12));
    const otroMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 2, 15, 12));
    const acto = await db.evento.create({ data: { title: 'ZZ acto del mes', startDate: mediados, type: 'CULTO' } });
    const lejano = await db.evento.create({ data: { title: 'ZZ acto lejano', startDate: otroMes, type: 'CULTO' } });
    const turno = await db.turno.create({ data: { fecha: mediados, horaInicio: mediados, horaFin: mediados } });
    try {
      const { calendario } = await PanelService.getPanel();
      assert.equal(calendario.mes, mediados.toISOString().slice(0, 7));
      assert.ok(calendario.eventos.some((e) => e.id === acto.id && e.type === 'CULTO'));
      assert.ok(!calendario.eventos.some((e) => e.id === lejano.id), 'un acto de otro mes no va en el calendario');
      assert.ok(calendario.diasDeReparto.includes(mediados.toISOString().slice(0, 10)));
    } finally {
      await db.turno.delete({ where: { id: turno.id } });
      await db.evento.deleteMany({ where: { id: { in: [acto.id, lejano.id] } } });
    }
  });
});

describe('el curso del Inicio', () => {
  test('trae los actos del curso, pasados y por venir, y ninguno de fuera', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { desde, hasta } = rangoDelCurso(diaMadrid(new Date()));
    const dentro = await db.evento.create({ data: { title: 'ZZ acto del curso', startDate: new Date(desde.getTime() + 3600000), type: 'REUNION' } });
    const fuera = await db.evento.create({ data: { title: 'ZZ acto de otro curso', startDate: new Date(hasta.getTime() + 3600000), type: 'CULTO' } });
    try {
      const { curso } = await PanelService.getPanel();
      assert.ok(curso.eventos.some((e) => e.id === dentro.id && e.type === 'REUNION'), 'el primer día del curso cuenta aunque ya haya pasado');
      assert.ok(!curso.eventos.some((e) => e.id === fuera.id), 'un acto del curso siguiente no va en el camino');
    } finally {
      await db.evento.deleteMany({ where: { id: { in: [dentro.id, fuera.id] } } });
    }
  });
});

describe('el ejercicio del panel', () => {
  test('sin parámetro, el año en curso y sin cerrar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const panel = await PanelService.getPanel();
    const anioActual = new Date().getFullYear();
    assert.equal(panel.ejercicio.anio, anioActual);
    assert.equal(panel.ejercicio.cerrado, false);
    // La cifra del ejercicio y el ejercicio elegido no pueden discrepar.
    assert.equal(panel.dinero.ejercicio.anio, panel.ejercicio.anio);
    assert.equal(panel.procesion.anio, panel.ejercicio.anio);
  });

  test('con un año anterior, la sección entera pasa a ese año', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const anterior = new Date().getFullYear() - 1;
    const panel = await PanelService.getPanel(String(anterior));
    assert.deepEqual(panel.ejercicio, { anio: anterior, cerrado: true });
    assert.equal(panel.dinero.ejercicio.anio, anterior);
    assert.equal(panel.procesion.anio, anterior);
    // Doce meses naturales de ese año, de enero a diciembre.
    assert.equal(panel.censo.serieMensual.length, 12);
    assert.equal(panel.censo.serieMensual[0].mes, `${anterior}-01`);
    assert.equal(panel.censo.serieMensual[11].mes, `${anterior}-12`);
    assert.deepEqual(
      panel.dinero.serieMensual.map((m) => m.mes),
      panel.censo.serieMensual.map((p) => p.mes),
    );
  });

  test('lo que es de hoy no lo toca el selector', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const anterior = new Date().getFullYear() - 1;
    const [hoy, cerrado] = await Promise.all([
      PanelService.getPanel(),
      PanelService.getPanel(String(anterior)),
    ]);
    assert.equal(cerrado.censo.activos, hoy.censo.activos);
    assert.equal(cerrado.censo.sinNumeroHermano, hoy.censo.sinNumeroHermano);
    assert.deepEqual(cerrado.censo.porEdad, hoy.censo.porEdad);
    assert.deepEqual(cerrado.actividad.proximosEventos, hoy.actividad.proximosEventos);
    assert.deepEqual(cerrado.actividad.noticias, hoy.actividad.noticias);
    assert.deepEqual(cerrado.actividad.reparto, hoy.actividad.reparto);
  });

  test('un año inválido no llega ni a consultar: es un error de la petición', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(
      () => PanelService.getPanel('1492'),
      (e: unknown) => e instanceof HttpError && e.status === 400,
    );
  });

  test('los recibos se cuentan del ejercicio elegido, no de todos los años', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const anterior = new Date().getFullYear() - 1;
    const [hoy, cerrado] = await Promise.all([
      PanelService.getPanel(),
      PanelService.getPanel(String(anterior)),
    ]);

    const suma = (panel: Awaited<ReturnType<typeof PanelService.getPanel>>) =>
      panel.dinero.porEstado.reduce((s, e) => s + e.total, 0);
    const total = await db.recibo.count();

    // Cada ejercicio por separado no puede sumar más que todos los recibos que
    // hay; antes de este cambio los dos devolvían exactamente ese total.
    assert.ok(suma(hoy) <= total, 'el ejercicio en curso trae recibos de más');
    assert.ok(suma(cerrado) <= total, 'el ejercicio cerrado trae recibos de más');
    assert.equal(suma(hoy), await db.recibo.count({ where: { year: hoy.ejercicio.anio } }));
    assert.equal(suma(cerrado), await db.recibo.count({ where: { year: anterior } }));
  });
});
