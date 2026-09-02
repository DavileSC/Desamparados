// Todo lo que decide qué página se sirve vive aquí, suelto y sin base de datos:
// antes estaba repetido en cuatro servicios con tres topes distintos.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sanearPaginacion, respuestaPaginada, LIMITE_POR_DEFECTO, LIMITE_MAXIMO } from '../src/domain/paginacion.js';

describe('sanear la paginación que llega por la consulta', () => {
  test('sin parámetros, primera página y el tamaño por defecto', () => {
    assert.deepEqual(sanearPaginacion({}), { page: 1, limit: 20, skip: 0, take: 20 });
    assert.equal(LIMITE_POR_DEFECTO, 20);
  });

  test('los parámetros llegan como texto, que es como los manda el navegador', () => {
    assert.deepEqual(sanearPaginacion({ page: '3', limit: '50' }), { page: 3, limit: 50, skip: 100, take: 50 });
  });

  test('una página que no es un número cae en la primera', () => {
    for (const page of ['0', '-4', 'dos', '', null, undefined, {}]) {
      assert.equal(sanearPaginacion({ page }).page, 1, `falla con ${JSON.stringify(page)}`);
    }
  });

  test('un tamaño por encima del tope se recorta al tope', () => {
    assert.equal(sanearPaginacion({ limit: '999999' }).limit, LIMITE_MAXIMO);
    assert.equal(LIMITE_MAXIMO, 100);
  });

  test('un tamaño por debajo de uno sube a uno', () => {
    assert.equal(sanearPaginacion({ limit: '0' }).limit, 1);
    assert.equal(sanearPaginacion({ limit: '-7' }).limit, 1);
  });

  test('un tamaño que no es número cae en el de por defecto', () => {
    assert.equal(sanearPaginacion({ limit: 'todos' }).limit, LIMITE_POR_DEFECTO);
  });
});

describe('construir la respuesta paginada', () => {
  test('meta trae siempre las cuatro claves', () => {
    const respuesta = respuestaPaginada(['a', 'b'], 308, { page: 2, limit: 20, skip: 20, take: 20 });
    assert.deepEqual(respuesta.meta, { total: 308, page: 2, limit: 20, totalPages: 16 });
    assert.deepEqual(respuesta.data, ['a', 'b']);
  });

  test('sin resultados, cero páginas y no una', () => {
    // Una lista vacía con totalPages: 1 haría que la interfaz pintara un
    // paginador de una página para nada.
    assert.equal(respuestaPaginada([], 0, { page: 1, limit: 20, skip: 0, take: 20 }).meta.totalPages, 0);
  });

  test('el último resto cuenta como página entera', () => {
    assert.equal(respuestaPaginada([], 41, { page: 1, limit: 20, skip: 0, take: 20 }).meta.totalPages, 3);
  });
});
