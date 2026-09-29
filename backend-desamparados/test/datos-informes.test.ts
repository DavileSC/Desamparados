// «Datos e informes» y la Memoria del curso: los periodos, las cifras dichas en
// palabras, quién escribe qué, los PDF y la API contra MariaDB. Sin base de
// datos, los casos que la necesitan se omiten con el motivo a la vista.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { cursoDeHoy, leerPeriodo, periodoDe, periodosDisponibles } from '../src/domain/periodo-datos.js';
import { areasDe, etiquetasDeMeses, valorEscrito, vistazo, type DatosCrudos } from '../src/domain/datos-areas.js';
import { puedeEscribir } from '../src/services/memoria.service.js';
import { informeDeArea, memoriaDelCurso } from '../src/services/informes/informes.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
/** Un curso sin datos reales: la prueba escribe su Memoria y la borra al acabar. */
const CURSO_DE_PRUEBA = 2001;
let dbDisponible = false;
let server: Server;
let baseUrl: string;
const usuarios: number[] = [];

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  if (dbDisponible) {
    await db.memoriaCurso.deleteMany({ where: { curso: CURSO_DE_PRUEBA } });
    for (const id of usuarios) await borrarUsuarioPrueba(id);
  }
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

async function cargo(role: Role) {
  const u = await crearUsuarioPrueba(role);
  usuarios.push(u.id);
  return `${COOKIE_CMS}=${generateToken(u.id, role, false, 'cms')}`;
}

const pedir = (ruta: string, cookie: string, method = 'GET', cuerpo?: unknown) =>
  fetch(`${baseUrl}/api/datos${ruta}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
  });

// Un día cualquiera del curso 2026–2027 (el Sábado de Pasión de 2026 fue el 28 de marzo).
const HOY = new Date('2026-09-29T12:00:00Z');

describe('los periodos', () => {
  test('un curso empieza el día después de un Sábado de Pasión y acaba con el siguiente', () => {
    const p = periodoDe('curso', 2025, HOY);
    assert.equal(p.desde, '2025-04-13');
    assert.equal(p.hasta, '2026-03-28');
    assert.equal(p.etiqueta, 'Curso 2025–2026');
    assert.equal(p.anioPasion, 2026, 'la estación que lo cierra');
    assert.equal(p.anioRosario, 2025);
    assert.equal(p.enCurso, false);
    assert.equal(p.meses[0], '2025-04');
    assert.equal(p.meses.at(-1), '2026-03');
  });

  test('sin periodo, el curso en marcha; un ejercicio va de enero a diciembre', () => {
    assert.equal(cursoDeHoy(HOY), 2026);
    assert.equal(leerPeriodo(undefined, HOY).clave, 'curso-2026');
    const e = leerPeriodo('ejercicio-2026', HOY);
    assert.deepEqual([e.desde, e.hasta, e.enCurso, e.meses.length], ['2026-01-01', '2026-12-31', true, 12]);
  });

  test('un periodo que no ha empezado o mal escrito es un 400', () => {
    for (const malo of ['curso-2027', 'ejercicio-2027', 'curso-1999', '2025', 'curso-25', 'trimestre-2026']) {
      assert.throws(() => leerPeriodo(malo, HOY), (e: { status?: number }) => e.status === 400, malo);
    }
  });

  test('el desplegable ofrece seis cursos y seis ejercicios, el más reciente primero', () => {
    const lista = periodosDisponibles(HOY);
    assert.equal(lista.length, 12);
    assert.deepEqual(lista[0], { clave: 'curso-2026', etiqueta: 'Curso 2026–2027' });
    assert.equal(lista[6].clave, 'ejercicio-2026');
  });

  test('los meses llevan el año en los extremos cuando el periodo cruza de año', () => {
    assert.deepEqual(etiquetasDeMeses(['2025-12', '2026-01', '2026-02']), ['dic 25', 'ene', 'feb 26']);
    assert.deepEqual(etiquetasDeMeses(['2026-01', '2026-02']), ['ene', 'feb']);
  });
});

/** Unas cifras de conjunto inventadas, para probar las palabras sin base de datos. */
function crudos(parcial: { papeletas?: number } = {}): DatosCrudos {
  const meses = periodoDe('curso', 2025, HOY).meses;
  return {
    hermanos: {
      activos: 228, activosAlEmpezar: 133, altas: 99, bajas: 4, anterior: { altas: 59, bajas: 3 },
      bajasPorMotivo: [{ motivo: 'IMPAGO', total: 3 }, { motivo: null, total: 1 }],
      porMes: meses.map((mes) => ({ mes, altas: 8, bajas: 0 })),
      cierres: [{ etiqueta: '21–22', activos: 12 }, { etiqueta: '25–26', activos: 228 }],
      edadMedia: 42.2, menores: 22, porEdad: [{ tramo: 'Menos de 18', total: 22 }],
    },
    dinero: {
      ingresos: 13806, gastos: 9492, anterior: { ingresos: 14186, gastos: 10736 },
      porMes: meses.map((mes) => ({ mes, ingresos: 1000, gastos: 700 })),
      porCategoria: [{ categoria: 'Cuotas de hermanos', tipo: 'INGRESO', importe: 5490 }, { categoria: 'Caridad', tipo: 'GASTO', importe: 2764 }],
      porCobrar: [{ estado: 'PENDIENTE', total: 10, importe: 350 }, { estado: 'DEVUELTO', total: 2, importe: 70 }],
    },
    procesion: {
      anio: 2026, papeletas: parcial.papeletas ?? 183, porPuesto: [{ etiqueta: 'Nazareno de cirio', total: 90 }],
      porAnio: [{ anio: 2025, total: 131 }, { anio: 2026, total: parcial.papeletas ?? 183 }],
      rosario: { anio: 2025, papeletas: 0, anterior: 0, porPuesto: [] }, porCobrar: [],
    },
    inventario: {
      enseres: [{ nombre: 'Candelería del paso', optimo: 24, bueno: 6, reparar: 4, total: 34 }],
      prendas: [{ tipo: 'TUNICA', estado: 'DISPONIBLE', total: 72 }, { tipo: 'TUNICA', estado: 'TALLER', total: 3 }],
    },
    web: {
      noticias: 8, publicaciones: 3, cambios: 97, paginasTocadas: 7, anterior: { noticias: 0, publicaciones: 3 },
      noticiasPorMes: meses.map((mes) => ({ mes, total: 1 })), publicacionesPorMes: [], cambiosPorMes: [], boletin: 0, activos: 276,
    },
    agenda: {
      actos: [{ id: 1, title: 'Solemne triduo', startDate: '2025-11-05T18:00:00.000Z', type: 'CULTO', location: 'Parroquia' }],
      anterior: 12,
    },
  };
}

describe('las cifras, en palabras', () => {
  const p = periodoDe('curso', 2025, HOY);

  test('seis áreas de cuatro cifras, cada una con su gráfica', () => {
    const areas = areasDe(crudos(), p, HOY);
    assert.deepEqual(areas.map((a) => a.clave), ['hermanos', 'dinero', 'procesion', 'inventario', 'web', 'agenda']);
    for (const a of areas) {
      assert.equal(a.cifras.length, 4, a.nombre);
      for (const c of a.cifras) assert.ok(c.grafica.titulo, `${a.nombre} · ${c.etiqueta}`);
    }
  });

  test('las cifras se escriben en español, con su signo cuando es una diferencia', () => {
    const [, dinero, procesion] = areasDe(crudos(), p, HOY);
    assert.equal(valorEscrito(dinero.cifras[0]), '+4.314 €');
    assert.equal(dinero.cifras[0].tono, 'bueno');
    assert.equal(valorEscrito(dinero.cifras[1]), '13.806 €');
    assert.equal(valorEscrito(procesion.cifras[1]), '+52');
    assert.equal(valorEscrito({ valor: 42.2, formato: 'decimal' }), '42,2');
  });

  test('sin reparto todavía, «año a año» enseña las papeletas del año anterior y no un −131', () => {
    const procesion = areasDe(crudos({ papeletas: 0 }), p, HOY)[2];
    assert.equal(procesion.cifras[1].etiqueta, 'Papeletas 2025');
    assert.equal(procesion.cifras[1].valor, 131);
    assert.equal(procesion.cifras[0].grafica.vacio, 'Todavía no hay papeletas para la salida de 2026.');
  });

  test('las bajas se explican por su motivo, y el que no lo tiene lo dice', () => {
    const bajas = areasDe(crudos(), p, HOY)[0].cifras[2];
    assert.equal(bajas.nota, '3 por impago');
    const cuerpo = bajas.grafica.cuerpo;
    assert.ok(cuerpo.tipo === 'barras');
    assert.deepEqual(cuerpo.filas.map((f) => f.etiqueta), ['Por impago', 'Sin motivo anotado']);
  });

  test('el vistazo de la Memoria compara cada cifra con la del curso anterior', () => {
    const v = vistazo(crudos(), HOY);
    assert.equal(v.length, 8);
    assert.deepEqual(v[0], { etiqueta: 'Hermanos al cierre', valor: '228', antes: '133', cambio: '+95', tono: 'bueno' });
    assert.equal(v.find((c) => c.etiqueta === 'Bajas')?.tono, 'malo', 'más bajas es peor');
  });
});

describe('quién escribe la Memoria', () => {
  test('el Hermano Mayor y Administración, todo; Secretaría, su epílogo y su firma', () => {
    assert.equal(puedeEscribir('HERMANO_MAYOR', 'presentacion'), true);
    assert.equal(puedeEscribir('ADMIN', 'notaPatrimonio'), true);
    assert.equal(puedeEscribir('SECRETARIA', 'epilogo'), true);
    assert.equal(puedeEscribir('SECRETARIA', 'firmaEpilogo'), true);
    assert.equal(puedeEscribir('SECRETARIA', 'presentacion'), false);
    assert.equal(puedeEscribir('TESORERIA', 'epilogo'), false);
  });
});

describe('los PDF', () => {
  const p = periodoDe('curso', 2025, HOY);

  test('el informe de un área es un PDF', async () => {
    const pdf = await informeDeArea(areasDe(crudos(), p, HOY)[0], p, HOY);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  });

  test('la Memoria sale entera aunque falten textos, como borrador', async () => {
    const textos = { presentacion: null, firmaPresentacion: null, lugarFecha: null, epilogo: null, firmaEpilogo: null, notaPatrimonio: 'Estreno de la candelería.', fechaCabildo: null };
    const pdf = await memoriaDelCurso(p, areasDe(crudos(), p, HOY), crudos(), textos, { borrador: true, hoy: HOY });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const paginas = pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
    assert.ok(paginas >= 11, `portada, índice y nueve capítulos: ${paginas} páginas`);
  });
});

describe('la API', () => {
  test('Datos e informes: el Hermano Mayor sí, Secretaría no', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const hm = await cargo(Role.HERMANO_MAYOR);
    const secretaria = await cargo(Role.SECRETARIA);

    assert.equal((await pedir('', secretaria)).status, 403);
    const r = await pedir('?periodo=ejercicio-2025', hm);
    assert.equal(r.status, 200);
    const datos = await r.json();
    assert.equal(datos.periodo.clave, 'ejercicio-2025');
    assert.equal(datos.areas.length, 6);
    assert.equal((await pedir('?periodo=curso-2999', hm)).status, 400);
  });

  test('el informe de un área se descarga en PDF', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const hm = await cargo(Role.HERMANO_MAYOR);
    const r = await pedir('/informe/dinero?periodo=ejercicio-2025', hm);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.match(r.headers.get('content-disposition') ?? '', /informe-de-cuentas-ejercicio-2025\.pdf/);
    assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    assert.equal((await pedir('/informe/secretos', hm)).status, 400);
  });

  test('la Memoria: cada cargo escribe lo suyo y la definitiva espera a los dos textos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const hm = await cargo(Role.HERMANO_MAYOR);
    const secretaria = await cargo(Role.SECRETARIA);
    const tesoreria = await cargo(Role.TESORERIA);
    await db.memoriaCurso.deleteMany({ where: { curso: CURSO_DE_PRUEBA } });

    assert.equal((await pedir(`/memoria/${CURSO_DE_PRUEBA}`, tesoreria)).status, 403);
    const vacia = await (await pedir(`/memoria/${CURSO_DE_PRUEBA}`, secretaria)).json();
    assert.deepEqual(vacia.faltan, ['presentacion', 'epilogo']);

    assert.equal((await pedir(`/memoria/${CURSO_DE_PRUEBA}`, secretaria, 'PUT', { presentacion: 'No es suya' })).status, 403);
    assert.equal((await pedir(`/memoria/${CURSO_DE_PRUEBA}`, secretaria, 'PUT', { epilogo: '  Doy fe.  ', firmaEpilogo: 'El Secretario' })).status, 200);
    assert.equal((await pedir(`/memoria/${CURSO_DE_PRUEBA}/pdf`, hm)).status, 409, 'sin presentación, solo borrador');
    const borrador = await pedir(`/memoria/${CURSO_DE_PRUEBA}/pdf?borrador=1`, hm);
    assert.equal(borrador.status, 200);
    assert.equal(borrador.headers.get('content-type'), 'application/pdf');

    const guardada = await (await pedir(`/memoria/${CURSO_DE_PRUEBA}`, hm, 'PUT', { presentacion: 'Queridos hermanos:\n\n\n\nGracias.', fechaCabildo: '14 de junio de 2002' })).json();
    assert.equal(guardada.textos.presentacion, 'Queridos hermanos:\n\nGracias.', 'los párrafos se respetan, sin líneas de más');
    assert.equal(guardada.textos.epilogo, 'Doy fe.');
    assert.deepEqual(guardada.faltan, []);
    const definitiva = await pedir(`/memoria/${CURSO_DE_PRUEBA}/pdf`, hm);
    assert.equal(definitiva.status, 200);
    assert.match(definitiva.headers.get('content-disposition') ?? '', /attachment; filename="memoria-del-curso-2001-2002\.pdf"/);

    assert.equal((await pedir(`/memoria/${CURSO_DE_PRUEBA}`, hm, 'PUT', { epilogo: '<script>' })).status, 400);
    assert.equal((await pedir('/memoria/2999', hm)).status, 400, 'un curso que no ha empezado');
  });
});
