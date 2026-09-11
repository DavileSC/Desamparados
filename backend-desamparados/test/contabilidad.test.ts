// La contabilidad del CMS se filtra por tipo, fechas, categoría, método y
// búsqueda, y se resume en totales, serie por mes (o por año) y reparto por
// categoría. Lo que se prueba aquí es la parte sin base de datos: cómo se lee
// la consulta, qué `where` sale de ella y cómo se agrupan los apuntes.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  agruparEnSerie,
  granularidad,
  inicioDiaMadrid,
  leerFiltros,
  periodoAnterior,
  whereContable,
} from '../src/domain/contabilidad.js';
import { libroMayorQuerySchema, resumenQuerySchema } from '../src/schemas/transaccion.schema.js';

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
});
