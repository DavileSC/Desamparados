// «Datos e informes» y el Informe anual: los años, las cifras dichas en
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
import { anioDeHoy, leerPeriodo, periodoAnterior, periodoDe, periodosDisponibles } from '../src/domain/periodo-datos.js';
import { areasDe, etiquetasDeMeses, valorEscrito, vistazo, type DatosCrudos } from '../src/domain/datos-areas.js';
import type { Articulo } from '../src/domain/articulos.js';
import { puedeEscribir } from '../src/services/informe-anual.service.js';
import { informeAnual, informeDeArea } from '../src/services/informes/informes.js';
import { entradilla, enTexto } from '../src/domain/entradillas.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
/** Un año sin datos reales: la prueba escribe su Informe anual y lo borra al acabar. */
const ANIO_DE_PRUEBA = 2001;
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
    await db.informeAnual.deleteMany({ where: { anio: ANIO_DE_PRUEBA } });
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

// Un día cualquiera de 2026, con el año en marcha.
const HOY = new Date('2026-09-29T12:00:00Z');

describe('los años', () => {
  test('el año va del 1 de enero al 31 de diciembre, en doce meses', () => {
    const p = periodoDe(2025, HOY);
    assert.deepEqual([p.clave, p.etiqueta, p.desde, p.hasta, p.enMarcha], ['2025', '2025', '2025-01-01', '2025-12-31', false]);
    assert.deepEqual([p.meses[0], p.meses.at(-1), p.meses.length], ['2025-01', '2025-12', 12]);
  });

  test('sin año, el de hoy; con el año en marcha se compara con el anterior hasta el mismo día', () => {
    assert.equal(anioDeHoy(HOY), 2026);
    const p = leerPeriodo(undefined, HOY);
    assert.deepEqual([p.clave, p.enMarcha, p.comparaHasta], ['2026', true, '2025-09-29']);
    // El 29 de septiembre de 2025 entra entero: el corte es el comienzo del 30, en Madrid.
    assert.equal(periodoAnterior(p, HOY).fin.toISOString(), '2025-09-29T22:00:00.000Z');
    // Un año cerrado se compara con el anterior entero.
    assert.equal(periodoDe(2025, HOY).comparaHasta, null);
    assert.equal(periodoAnterior(periodoDe(2025, HOY), HOY).fin.toISOString(), '2024-12-31T23:00:00.000Z');
  });

  test('el 29 de febrero se compara con el 28 del año anterior', () => {
    assert.equal(periodoDe(2028, new Date('2028-02-29T12:00:00Z')).comparaHasta, '2027-02-28');
  });

  test('un año por venir o mal escrito es un 400', () => {
    for (const malo of ['2027', '1999', 'curso-2025', 'ejercicio-2026', '26', 'año']) {
      assert.throws(() => leerPeriodo(malo, HOY), (e: { status?: number }) => e.status === 400, malo);
    }
  });

  test('el desplegable ofrece el año en marcha y los cinco anteriores', () => {
    const lista = periodosDisponibles(HOY);
    assert.equal(lista.length, 6);
    assert.deepEqual(lista[0], { clave: '2026', etiqueta: '2026 (en marcha)' });
    assert.deepEqual(lista[5], { clave: '2021', etiqueta: '2021' });
  });

  test('los meses llevan el año en los extremos cuando la serie cruza de año', () => {
    assert.deepEqual(etiquetasDeMeses(['2025-12', '2026-01', '2026-02']), ['dic 25', 'ene', 'feb 26']);
    assert.deepEqual(etiquetasDeMeses(['2026-01', '2026-02']), ['ene', 'feb']);
  });
});

/** Unas cifras de conjunto inventadas, para probar las palabras sin base de datos. */
function crudos(parcial: {
  papeletas?: number;
  /** La segunda salida (la que siempre cae en «otras salidas», nunca es la principal): para probar que concuerda con su propio artículo. */
  otraSalida?: { nombre?: string; articulo?: Articulo; papeletas?: number };
} = {}): DatosCrudos {
  const meses = periodoDe(2025, HOY).meses;
  return {
    hermanos: {
      activos: 228, activosAlEmpezar: 133, altas: 99, bajas: 4, anterior: { altas: 59, bajas: 3 },
      bajasPorMotivo: [{ motivo: 'IMPAGO', total: 3 }, { motivo: null, total: 1 }],
      porMes: meses.map((mes) => ({ mes, altas: 8, bajas: 0 })),
      cierres: [{ etiqueta: '2021', activos: 12 }, { etiqueta: '2025', activos: 228 }],
      edadMedia: 42.2, menores: 22, porEdad: [{ tramo: 'Menos de 18', total: 22 }],
    },
    dinero: {
      ingresos: 13806, gastos: 9492, anterior: { ingresos: 14186, gastos: 10736 },
      porMes: meses.map((mes) => ({ mes, ingresos: 1000, gastos: 700 })),
      porCategoria: [{ categoria: 'Cuotas de hermanos', tipo: 'INGRESO', importe: 5490 }, { categoria: 'Caridad', tipo: 'GASTO', importe: 2764 }],
      porCobrar: [{ estado: 'PENDIENTE', total: 10, importe: 350 }, { estado: 'DEVUELTO', total: 2, importe: 70 }],
    },
    procesion: {
      anio: 2026,
      porSalida: [
        {
          slug: 'sabado-de-pasion', nombre: 'Sábado de Pasión', articulo: 'el', conRopa: true,
          papeletas: parcial.papeletas ?? 183, papeletasAnioAnterior: 131, porPuesto: [{ etiqueta: 'Nazareno de cirio', total: 90 }],
          serie: [{ anio: 2025, total: 131 }, { anio: 2026, total: parcial.papeletas ?? 183 }],
        },
        {
          slug: 'rosario-vespertino', nombre: parcial.otraSalida?.nombre ?? 'Rosario vespertino', articulo: parcial.otraSalida?.articulo ?? 'el',
          conRopa: false, papeletas: parcial.otraSalida?.papeletas ?? 0, papeletasAnioAnterior: 0, porPuesto: [],
        },
      ],
      porCobrar: [],
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
  const p = periodoDe(2025, HOY);

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

  test('el vistazo del Informe anual compara cada cifra con la del año anterior', () => {
    const v = vistazo(crudos(), HOY);
    assert.equal(v.length, 8);
    assert.deepEqual(v[0], { etiqueta: 'Hermanos al cierre', valor: '228', antes: '133', cambio: '+95', tono: 'bueno' });
    assert.equal(v.find((c) => c.etiqueta === 'Bajas')?.tono, 'malo', 'más bajas es peor');
  });
});

describe('las entradillas del Informe anual y los informes', () => {
  const cerrado = periodoDe(2025, HOY);
  const enMarcha = periodoDe(2026, HOY);

  test('cuentan las cifras en una o dos frases, con la que las sostiene en negrita', () => {
    const trozos = entradilla('hermanos', crudos(), cerrado, HOY);
    assert.equal(enTexto(trozos), 'Al cierre de 2025, el Grupo cuenta con 228 hermanos, 95 más que al empezar. Se han dado 99 altas y 4 bajas. La edad media es de 42,2 años y 22 hermanos son menores de edad.');
    assert.deepEqual(trozos.filter((t) => t.fuerte).map((t) => t.texto), ['228 hermanos']);
  });

  test('un año en marcha dice «hasta hoy» y «aún no»; uno cerrado, «al cierre» y «no tuvo»', () => {
    assert.match(enTexto(entradilla('dinero', crudos(), enMarcha, HOY)), /^Hasta hoy, las cuentas dejan un superávit de 4\.314 €/);
    assert.match(enTexto(entradilla('procesion', crudos({ papeletas: 0 }), enMarcha, HOY)), /de 2026 aún no tiene papeletas\. La de 2025 reunió 131 papeletas de sitio\./);
    assert.match(enTexto(entradilla('procesion', crudos({ papeletas: 0 }), cerrado, HOY)), /de 2026 no tuvo papeletas/);
  });

  test('los singulares concuerdan', () => {
    const agenda = enTexto(entradilla('agenda', crudos(), enMarcha, HOY));
    assert.equal(agenda, 'La Agenda de 2026 tiene 1 acto: 1 culto. Se ha celebrado 1.');
    assert.match(enTexto(entradilla('web', crudos(), cerrado, HOY)), /El boletín aún no tiene suscritos\.$/);
  });

  test('en «otras salidas», una con artículo femenino o plural no lleva un «El» fijo', () => {
    const texto = enTexto(entradilla('procesion', crudos({ otraSalida: { nombre: 'Procesión Magna', articulo: 'la', papeletas: 5 } }), cerrado, HOY));
    assert.match(texto, /La Procesión Magna de 2026 reunió 5 papeletas\./);
    assert.doesNotMatch(texto, /El Procesión/);
  });

  test('las túnicas son femeninas y los capirotes masculinos', () => {
    const [, , tunicas, capirotes] = areasDe(crudos(), cerrado, HOY)[3].cifras;
    assert.equal(tunicas.grafica.titulo, 'Las túnicas, por estado');
    assert.equal(capirotes.grafica.titulo, 'Los capirotes, por estado');
    const estados = (c: typeof tunicas) => (c.grafica.cuerpo.tipo === 'barras' ? c.grafica.cuerpo.filas.map((f) => f.etiqueta) : []);
    assert.ok(estados(tunicas).includes('Prestadas'));
    assert.ok(estados(capirotes).includes('Prestados'));
  });
});

describe('las notas dicen con qué se comparan', () => {
  test('con el año en marcha, «a estas alturas» del anterior; con el año cerrado, el anterior', () => {
    assert.equal(areasDe(crudos(), periodoDe(2026, HOY), HOY)[0].cifras[1].nota, '59 a estas alturas de 2025');
    assert.equal(areasDe(crudos(), periodoDe(2025, HOY), HOY)[0].cifras[1].nota, '59 en 2024');
  });
});

describe('quién escribe el Informe anual', () => {
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
  const p = periodoDe(2025, HOY);

  test('el informe de un área es un PDF', async () => {
    const pdf = await informeDeArea(areasDe(crudos(), p, HOY)[0], p, crudos(), HOY);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  });

  test('el Informe anual sale entero aunque falten textos, como borrador', async () => {
    const textos = { presentacion: null, firmaPresentacion: null, lugarFecha: null, epilogo: null, firmaEpilogo: null, notaPatrimonio: 'Estreno de la candelería.', fechaCabildo: null };
    const pdf = await informeAnual(p, areasDe(crudos(), p, HOY), crudos(), textos, { borrador: true, hoy: HOY });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const paginas = pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
    assert.ok(paginas >= 11, `portada, índice y nueve capítulos: ${paginas} páginas`);
  });

  test('una carta larga sigue en otra página en vez de cortarse', async () => {
    const textos = { presentacion: null, firmaPresentacion: null, lugarFecha: null, epilogo: null, firmaEpilogo: null, notaPatrimonio: null, fechaCabildo: null };
    const paginasDe = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
    const corta = await informeAnual(p, areasDe(crudos(), p, HOY), crudos(), textos, { borrador: false, hoy: HOY });
    const carta = Array.from({ length: 12 }, () => 'Queridos hermanos, gracias por este año. '.repeat(20)).join('\n\n');
    const larga = await informeAnual(p, areasDe(crudos(), p, HOY), crudos(), { ...textos, presentacion: carta }, { borrador: false, hoy: HOY });
    assert.ok(paginasDe(larga) > paginasDe(corta), `${paginasDe(larga)} páginas con la carta larga, ${paginasDe(corta)} sin ella`);
  });
});

describe('la API', () => {
  test('Datos e informes: el Hermano Mayor sí, Secretaría no', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const hm = await cargo(Role.HERMANO_MAYOR);
    const secretaria = await cargo(Role.SECRETARIA);

    assert.equal((await pedir('', secretaria)).status, 403);
    const r = await pedir('?anio=2025', hm);
    assert.equal(r.status, 200);
    const datos = await r.json();
    assert.equal(datos.periodo.clave, '2025');
    assert.equal(datos.areas.length, 6);
    assert.equal((await pedir('?anio=2999', hm)).status, 400);
  });

  test('el informe de un área se descarga en PDF', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const hm = await cargo(Role.HERMANO_MAYOR);
    const r = await pedir('/informe/dinero?anio=2025', hm);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.match(r.headers.get('content-disposition') ?? '', /informe-de-cuentas-2025\.pdf/);
    assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    assert.equal((await pedir('/informe/secretos', hm)).status, 400);
  });

  test('el Informe anual: cada cargo escribe lo suyo y el definitivo espera a los dos textos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const hm = await cargo(Role.HERMANO_MAYOR);
    const secretaria = await cargo(Role.SECRETARIA);
    const tesoreria = await cargo(Role.TESORERIA);
    await db.informeAnual.deleteMany({ where: { anio: ANIO_DE_PRUEBA } });

    assert.equal((await pedir(`/informe-anual/${ANIO_DE_PRUEBA}`, tesoreria)).status, 403);
    const vacio = await (await pedir(`/informe-anual/${ANIO_DE_PRUEBA}`, secretaria)).json();
    assert.deepEqual(vacio.faltan, ['presentacion', 'epilogo']);

    assert.equal((await pedir(`/informe-anual/${ANIO_DE_PRUEBA}`, secretaria, 'PUT', { presentacion: 'No es suya' })).status, 403);
    assert.equal((await pedir(`/informe-anual/${ANIO_DE_PRUEBA}`, secretaria, 'PUT', { epilogo: '  Doy fe.  ', firmaEpilogo: 'El Secretario' })).status, 200);
    assert.equal((await pedir(`/informe-anual/${ANIO_DE_PRUEBA}/pdf`, hm)).status, 409, 'sin presentación, solo borrador');
    const borrador = await pedir(`/informe-anual/${ANIO_DE_PRUEBA}/pdf?borrador=1`, hm);
    assert.equal(borrador.status, 200);
    assert.equal(borrador.headers.get('content-type'), 'application/pdf');

    const guardada = await (await pedir(`/informe-anual/${ANIO_DE_PRUEBA}`, hm, 'PUT', { presentacion: 'Queridos hermanos:\n\n\n\nGracias.', fechaCabildo: '14 de junio de 2002' })).json();
    assert.equal(guardada.textos.presentacion, 'Queridos hermanos:\n\nGracias.', 'los párrafos se respetan, sin líneas de más');
    assert.equal(guardada.textos.epilogo, 'Doy fe.');
    assert.deepEqual(guardada.faltan, []);
    const definitiva = await pedir(`/informe-anual/${ANIO_DE_PRUEBA}/pdf`, hm);
    assert.equal(definitiva.status, 200);
    assert.match(definitiva.headers.get('content-disposition') ?? '', /attachment; filename="informe-anual-2001\.pdf"/);

    assert.equal((await pedir(`/informe-anual/${ANIO_DE_PRUEBA}`, hm, 'PUT', { epilogo: '<script>' })).status, 400);
    assert.equal((await pedir('/informe-anual/2999', hm)).status, 400, 'un año que no ha empezado');
  });
});
