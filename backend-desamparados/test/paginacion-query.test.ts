// Regresión: arktype borra las claves no declaradas. Un esquema de consulta sin
// `page` no rechaza `?page=2`, se lo come, y el extremo sirve siempre la
// primera página sin que nadie vea un error.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { type } from 'arktype';
import { paginacionQuery } from '../src/config/common.js';

const esquema = type({ query: { ...paginacionQuery, 'search?': 'string' } }).onDeepUndeclaredKey('delete');

describe('parámetros de paginación en los esquemas de consulta', () => {
  test('page y limit sobreviven a la validación', () => {
    const resultado = esquema({ query: { page: '2', limit: '50' } }) as { query: Record<string, string> };
    assert.equal(resultado.query.page, '2');
    assert.equal(resultado.query.limit, '50');
  });

  test('sin ellos, la consulta sigue siendo válida', () => {
    const resultado = esquema({ query: { search: 'rocío' } }) as { query: Record<string, string> };
    assert.equal(resultado.query.search, 'rocío');
  });

  test('un esquema que no los declara los pierde: por eso hace falta esto', () => {
    const sinPaginacion = type({ query: { 'search?': 'string' } }).onDeepUndeclaredKey('delete');
    const resultado = sinPaginacion({ query: { search: 'x', page: '2' } }) as { query: Record<string, string> };
    assert.equal(resultado.query.page, undefined);
  });
});
