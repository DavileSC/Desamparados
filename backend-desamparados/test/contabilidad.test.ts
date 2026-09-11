// La contabilidad del CMS se filtra por tipo, fechas, categoría, método y
// búsqueda, y se resume en totales, serie por mes (o por año) y reparto por
// categoría. Lo que se prueba aquí es la parte sin base de datos: cómo se lee
// la consulta, qué `where` sale de ella y cómo se agrupan los apuntes.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { type } from 'arktype';
import {
  IMPORTE_MAXIMO,
  agruparEnSerie,
  claveNombreCategoria,
  diaMadrid,
  esCategoriaDeRecibos,
  esDiaValido,
  fechasInvertidas,
  granularidad,
  inicioDiaMadrid,
  instanteDelApunte,
  leerFiltros,
  limpiarNombreCategoria,
  motivoFechaApunte,
  motivoImporteInvalido,
  periodoAnterior,
  whereContable,
} from '../src/domain/contabilidad.js';
import {
  categoriasQuerySchema,
  createCategoriaSchema,
  createTransaccionSchema,
  libroMayorQuerySchema,
  resumenQuerySchema,
  updateTransaccionSchema,
} from '../src/schemas/transaccion.schema.js';

describe('leer los filtros de la consulta', () => {
  test('recoge cada filtro con su tipo', () => {
    const filtros = leerFiltros({ tipo: 'GASTO', desde: '2026-01-01', hasta: '2026-04-30', categorias: '3,5', metodo: 'BIZUM', q: '  flores  ' });
    assert.deepEqual(filtros, { tipo: 'GASTO', desde: '2026-01-01', hasta: '2026-04-30', categorias: [3, 5], metodo: 'BIZUM', q: 'flores' });
  });

  test('ignora lo que no es un filtro válido en vez de filtrar por basura', () => {
    const filtros = leerFiltros({ tipo: 'OTRO', desde: 'ayer', categorias: 'a,b', metodo: 'CHEQUE', q: '   ' });
    assert.deepEqual(filtros, {});
  });
});

describe('where de Prisma a partir de los filtros', () => {
  test('sin filtros no restringe nada', () => {
    assert.deepEqual(whereContable({}), {});
  });

  test('las fechas son días enteros de Madrid, con el hasta incluido', () => {
    const where = whereContable({ desde: '2026-01-01', hasta: '2026-01-31' });
    // En invierno Madrid va una hora por delante de UTC.
    assert.deepEqual(where.fecha, { gte: new Date('2025-12-31T23:00:00.000Z'), lt: new Date('2026-01-31T23:00:00.000Z') });
  });

  test('tipo, categorías y método van tal cual', () => {
    const where = whereContable({ tipo: 'INGRESO', categorias: [1, 2], metodo: 'EFECTIVO' });
    assert.equal(where.tipo, 'INGRESO');
    assert.deepEqual(where.categoriaId, { in: [1, 2] });
    assert.equal(where.metodoPago, 'EFECTIVO');
  });

  test('buscar «juan pérez» exige cada palabra en el concepto o en el hermano', () => {
    const where = whereContable({ q: 'juan pérez' });
    assert.equal(where.AND?.length, 2);
    const primera = (where.AND as { OR: unknown[] }[])[0];
    assert.deepEqual(primera.OR, [
      { concepto: { contains: 'juan' } },
      { hermano: { is: { nombre: { contains: 'juan' } } } },
      { hermano: { is: { apellidos: { contains: 'juan' } } } },
    ]);
  });
});

describe('periodo del año anterior', () => {
  test('desplaza el mismo tramo un año atrás', () => {
    assert.deepEqual(periodoAnterior({ desde: '2026-01-01', hasta: '2026-09-11' }), { desde: '2025-01-01', hasta: '2025-09-11' });
  });

  test('el 29 de febrero cae en el 28 del año anterior', () => {
    assert.deepEqual(periodoAnterior({ desde: '2024-02-29', hasta: '2024-03-31' }), { desde: '2023-02-28', hasta: '2023-03-31' });
  });

  test('sin fechas de principio y fin no hay con qué comparar', () => {
    assert.equal(periodoAnterior({}), null);
    assert.equal(periodoAnterior({ desde: '2026-01-01' }), null);
  });
});

describe('agrupar los apuntes en la serie', () => {
  test('hasta 13 meses va por meses; más, por años', () => {
    assert.equal(granularidad(new Date('2025-09-01'), new Date('2026-09-30')), 'mes');
    assert.equal(granularidad(new Date('2022-01-01'), new Date('2026-09-11')), 'anio');
  });

  test('suma ingresos y gastos por mes y rellena los meses vacíos', () => {
    const serie = agruparEnSerie(
      [
        { fecha: new Date('2026-01-10T10:00:00Z'), tipo: 'INGRESO', importe: 36 },
        { fecha: new Date('2026-01-12T10:00:00Z'), tipo: 'GASTO', importe: 120.5 },
        { fecha: new Date('2026-03-02T10:00:00Z'), tipo: 'INGRESO', importe: 30 },
      ],
      'mes',
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-31T00:00:00Z'),
    );
    assert.deepEqual(serie, [
      { clave: '2026-01', ingresos: 36, gastos: 120.5 },
      { clave: '2026-02', ingresos: 0, gastos: 0 },
      { clave: '2026-03', ingresos: 30, gastos: 0 },
    ]);
  });

  test('un apunte de la noche del 31 en Madrid cuenta en el mes siguiente', () => {
    // 31-01 a las 23:30 UTC ya es 1 de febrero en Madrid.
    const serie = agruparEnSerie([{ fecha: new Date('2026-01-31T23:30:00Z'), tipo: 'GASTO', importe: 10 }], 'mes', new Date('2026-02-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'));
    assert.deepEqual(serie, [{ clave: '2026-02', ingresos: 0, gastos: 10 }]);
  });

  test('por años agrupa y rellena igual', () => {
    const serie = agruparEnSerie(
      [{ fecha: new Date('2022-05-01T10:00:00Z'), tipo: 'INGRESO', importe: 5 }, { fecha: new Date('2024-05-01T10:00:00Z'), tipo: 'GASTO', importe: 7 }],
      'anio',
      new Date('2022-01-01T00:00:00Z'),
      new Date('2024-12-31T00:00:00Z'),
    );
    assert.deepEqual(serie.map((p) => p.clave), ['2022', '2023', '2024']);
    assert.equal(serie[2].gastos, 7);
  });
});

describe('inicio de un día en Madrid', () => {
  test('en verano, dos horas antes en UTC', () => {
    assert.equal(inicioDiaMadrid('2026-07-01').toISOString(), '2026-06-30T22:00:00.000Z');
  });

  test('en invierno, una hora antes en UTC', () => {
    assert.equal(inicioDiaMadrid('2026-01-15').toISOString(), '2026-01-14T23:00:00.000Z');
  });

  // Los días de cambio de hora, la medianoche aún va con el horario de la víspera:
  // Madrid cambia a las 02:00 (marzo) y a las 03:00 (octubre) de su hora local,
  // la 01:00 UTC en los dos casos. Con el desfase de mediodía salían una hora corridos.
  test('el día que se adelanta la hora (29-03-2026) empieza a las 23:00 UTC del 28', () => {
    assert.equal(inicioDiaMadrid('2026-03-29').toISOString(), '2026-03-28T23:00:00.000Z');
    // Y el día siguiente ya va con horario de verano.
    assert.equal(inicioDiaMadrid('2026-03-30').toISOString(), '2026-03-29T22:00:00.000Z');
  });

  test('el día que se retrasa la hora (25-10-2026) empieza a las 22:00 UTC del 24', () => {
    assert.equal(inicioDiaMadrid('2026-10-25').toISOString(), '2026-10-24T22:00:00.000Z');
    assert.equal(inicioDiaMadrid('2026-10-26').toISOString(), '2026-10-25T23:00:00.000Z');
  });

  test('los cambios de hora de otros años también (2024 y 2027)', () => {
    assert.equal(inicioDiaMadrid('2024-03-31').toISOString(), '2024-03-30T23:00:00.000Z');
    assert.equal(inicioDiaMadrid('2024-10-27').toISOString(), '2024-10-26T22:00:00.000Z');
    assert.equal(inicioDiaMadrid('2027-03-28').toISOString(), '2027-03-27T23:00:00.000Z');
    assert.equal(inicioDiaMadrid('2027-10-31').toISOString(), '2027-10-30T22:00:00.000Z');
  });

  test('el día de un instante se cuenta en Madrid', () => {
    assert.equal(diaMadrid(new Date('2026-03-28T23:30:00Z')), '2026-03-29');
    assert.equal(diaMadrid(new Date('2026-10-24T21:59:59Z')), '2026-10-24');
    assert.equal(diaMadrid(new Date('2026-10-24T22:00:00Z')), '2026-10-25');
  });

  test('un filtro del día del cambio no se come la última hora de la víspera', () => {
    const where = whereContable({ desde: '2026-03-29', hasta: '2026-03-29' });
    assert.deepEqual(where.fecha, { gte: new Date('2026-03-28T23:00:00.000Z'), lt: new Date('2026-03-29T22:00:00.000Z') });
  });
});

describe('fechas que existen', () => {
  test('acepta días reales, bisiestos incluidos', () => {
    assert.equal(esDiaValido('2026-09-11'), true);
    assert.equal(esDiaValido('2024-02-29'), true);
  });

  test('rechaza días que no existen o fuera de 1900-2100', () => {
    for (const dia of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '0026-01-01', '9999-12-31', '01/01/2026']) {
      assert.equal(esDiaValido(dia), false, dia);
    }
  });

  test('un día inexistente en la URL se ignora al leer los filtros', () => {
    assert.deepEqual(leerFiltros({ desde: '2026-02-30' }), {});
  });
});

describe('periodo al revés', () => {
  test('se detecta cuando «desde» va después de «hasta»', () => {
    assert.equal(fechasInvertidas({ desde: '2026-12-01', hasta: '2026-01-31' }), true);
    assert.equal(fechasInvertidas({ desde: '2026-01-01', hasta: '2026-01-01' }), false);
    assert.equal(fechasInvertidas({ desde: '2026-01-01' }), false);
  });

  test('la serie de un periodo al revés sale vacía, no con 1.201 meses', () => {
    const serie = agruparEnSerie([], 'mes', new Date('2026-12-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
    assert.deepEqual(serie, []);
  });

  test('el esquema lo rechaza en el libro mayor y en el resumen', () => {
    for (const esquema of [libroMayorQuerySchema, resumenQuerySchema]) {
      const resultado = esquema.onDeepUndeclaredKey('delete')({ query: { desde: '2026-12-01', hasta: '2026-01-31' } });
      assert.ok(resultado instanceof type.errors, 'debería devolver errores de validación');
      assert.equal([...resultado].map((p) => p.path.join('.'))[0], 'query.hasta');
    }
  });
});

describe('importes', () => {
  test('valen los positivos con hasta dos decimales, hasta el tope de Decimal(10,2)', () => {
    for (const importe of [0.01, 12.34, 18, 1234.5, IMPORTE_MAXIMO]) assert.equal(motivoImporteInvalido(importe), null, String(importe));
  });

  test('no valen cero, negativos, más de dos decimales ni pasarse del tope', () => {
    assert.match(motivoImporteInvalido(0)!, /mayor que cero/);
    assert.match(motivoImporteInvalido(-5)!, /mayor que cero/);
    assert.match(motivoImporteInvalido(12.345)!, /dos decimales/);
    assert.match(motivoImporteInvalido(1.005)!, /dos decimales/);
    assert.match(motivoImporteInvalido(100_000_000)!, /99\.999\.999,99/);
    assert.match(motivoImporteInvalido(Number.NaN)!, /mayor que cero/);
  });
});

describe('fecha de un apunte', () => {
  const AHORA = new Date('2026-09-11T10:30:00Z');

  test('no puede ser futura ni inexistente', () => {
    assert.equal(motivoFechaApunte('2026-09-11', AHORA), null);
    assert.equal(motivoFechaApunte('2025-12-31', AHORA), null);
    assert.match(motivoFechaApunte('2026-09-12', AHORA)!, /posterior a hoy/);
    assert.match(motivoFechaApunte('2026-02-30', AHORA)!, /no es un día válido/);
  });

  test('hoy se guarda con la hora de ahora; otro día, a su medianoche de Madrid', () => {
    assert.equal(instanteDelApunte('2026-09-11', AHORA), AHORA);
    assert.equal(instanteDelApunte('2026-03-29', AHORA).toISOString(), '2026-03-28T23:00:00.000Z');
  });

  test('«hoy» es el día de Madrid: a las 22:30 UTC del 11 ya es 12', () => {
    const noche = new Date('2026-09-11T22:30:00Z');
    assert.equal(motivoFechaApunte('2026-09-12', noche), null);
    assert.equal(instanteDelApunte('2026-09-12', noche), noche);
  });
});

describe('nombres de categoría', () => {
  test('se guardan sin espacios de sobra', () => {
    assert.equal(limpiarNombreCategoria('  Flores   y exorno '), 'Flores y exorno');
  });

  // Como el índice único de la base (utf8mb4_unicode_ci): ni mayúsculas, ni
  // tildes, ni la ñ, ni los espacios del final hacen otra categoría.
  test('mayúsculas, tildes, la ñ y los espacios finales no hacen otra categoría', () => {
    assert.equal(claveNombreCategoria('Lotería y rifas'), claveNombreCategoria('LOTERIA  Y RIFAS'));
    assert.equal(claveNombreCategoria('Limosnas'), claveNombreCategoria('limosnás'));
    assert.equal(claveNombreCategoria('Año'), claveNombreCategoria('Ano'));
    assert.equal(claveNombreCategoria('Limosnás'), claveNombreCategoria('limosnas'));
    assert.equal(claveNombreCategoria('Cera  '), claveNombreCategoria('cera'));
    assert.equal(claveNombreCategoria('Pingüinos y Ça'), claveNombreCategoria('pinguinos y ca'));
    assert.notEqual(claveNombreCategoria('Flores'), claveNombreCategoria('Flor'));
  });

  test('las que usan los recibos se reconocen por nombre y tipo', () => {
    assert.equal(esCategoriaDeRecibos({ nombre: 'cuotas y papeletas', tipo: 'INGRESO' }), true);
    assert.equal(esCategoriaDeRecibos({ nombre: 'Devoluciones de recibos', tipo: 'GASTO' }), true);
    assert.equal(esCategoriaDeRecibos({ nombre: 'Cuotas y papeletas', tipo: 'GASTO' }), false);
    assert.equal(esCategoriaDeRecibos({ nombre: 'Donativos', tipo: 'INGRESO' }), false);
  });
});

describe('esquemas de consulta de la contabilidad', () => {
  const libro = libroMayorQuerySchema.onDeepUndeclaredKey('delete');

  test('el libro mayor conserva la paginación y los filtros', () => {
    const resultado = libro({ query: { page: '2', limit: '20', tipo: 'GASTO', desde: '2026-01-01', q: 'flores' } }) as { query: Record<string, string> };
    assert.equal(resultado.query.page, '2');
    assert.equal(resultado.query.tipo, 'GASTO');
    assert.equal(resultado.query.q, 'flores');
  });

  test('una fecha mal escrita es un error, no un filtro que se pierde', () => {
    const resumen = resumenQuerySchema.onDeepUndeclaredKey('delete');
    const resultado = resumen({ query: { desde: '01/01/2026' } });
    assert.ok('summary' in (resultado as object), 'debería devolver errores de validación');
  });

  test('un día que no existe también es un error', () => {
    const resultado = resumenQuerySchema.onDeepUndeclaredKey('delete')({ query: { hasta: '2026-02-30' } });
    assert.ok(resultado instanceof type.errors);
  });

  test('las categorías declaran su consulta: un tipo repetido es un 400, no un 500', () => {
    const categorias = categoriasQuerySchema.onDeepUndeclaredKey('delete');
    // Así llega `?tipo=INGRESO&tipo=GASTO` a Express: como lista.
    assert.ok(categorias({ query: { tipo: ['INGRESO', 'GASTO'] } }) instanceof type.errors);
    assert.deepEqual(categorias({ query: { tipo: 'GASTO', todas: 'true', otra: 'x' } }), { query: { tipo: 'GASTO', todas: 'true' } });
  });
});

describe('esquema de un apunte manual', () => {
  const crear = createTransaccionSchema.onDeepUndeclaredKey('delete');
  const BUENO = { tipo: 'GASTO', categoriaId: 6, concepto: 'Exorno floral', importe: 342.5, metodoPago: 'TRANSFERENCIA', fecha: '2026-08-09' };
  const errores = (body: Record<string, unknown>) => {
    const r = crear({ body });
    return r instanceof type.errors ? [...r].map((p) => p.path.join('.')) : [];
  };

  test('un apunte completo pasa, y la fecha es opcional', () => {
    assert.deepEqual(errores(BUENO), []);
    const { fecha: _fecha, ...sinFecha } = BUENO;
    assert.deepEqual(errores(sinFecha), []);
  });

  test('importe: más de dos decimales, cero o por encima del tope se rechazan', () => {
    assert.deepEqual(errores({ ...BUENO, importe: 12.345 }), ['body.importe']);
    assert.deepEqual(errores({ ...BUENO, importe: 0 }), ['body.importe']);
    assert.deepEqual(errores({ ...BUENO, importe: 100_000_000 }), ['body.importe']);
  });

  test('una fecha libre o inexistente se rechaza (antes daba 500)', () => {
    assert.deepEqual(errores({ ...BUENO, fecha: 'mañana' }), ['body.fecha']);
    assert.deepEqual(errores({ ...BUENO, fecha: '2026-02-30' }), ['body.fecha']);
  });

  test('el método es obligatorio: sin él, el apunte desaparece al filtrar por método', () => {
    const { metodoPago: _metodo, ...sinMetodo } = BUENO;
    assert.deepEqual(errores(sinMetodo), ['body.metodoPago']);
  });

  test('el concepto cabe en su columna (191) y la categoría es un entero', () => {
    assert.deepEqual(errores({ ...BUENO, concepto: 'x'.repeat(192) }), ['body.concepto']);
    assert.deepEqual(errores({ ...BUENO, concepto: '   ab   ' }), ['body.concepto']);
    assert.deepEqual(errores({ ...BUENO, categoriaId: 1.5 }), ['body.categoriaId']);
  });

  test('al corregir, la fecha es obligatoria y el id va en la ruta', () => {
    const corregir = updateTransaccionSchema.onDeepUndeclaredKey('delete');
    const { fecha: _fecha, ...sinFecha } = BUENO;
    const r = corregir({ params: { id: '7' }, body: sinFecha });
    assert.ok(r instanceof type.errors);
    assert.deepEqual([...r].map((p) => p.path.join('.')), ['body.fecha']);
    assert.ok(corregir({ params: { id: 'x' }, body: BUENO }) instanceof type.errors);
  });

  test('el nombre de una categoría: de 3 a 60 caracteres útiles', () => {
    const categoria = createCategoriaSchema.onDeepUndeclaredKey('delete');
    assert.ok(categoria({ body: { nombre: '  ab  ', tipo: 'GASTO' } }) instanceof type.errors);
    assert.ok(categoria({ body: { nombre: 'x'.repeat(61), tipo: 'GASTO' } }) instanceof type.errors);
    assert.ok(!(categoria({ body: { nombre: 'Flores', tipo: 'GASTO' } }) instanceof type.errors));
  });
});
