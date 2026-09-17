import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { condicionBusqueda, MAX_PALABRAS_BUSQUEDA, palabrasDeBusqueda } from '../src/domain/busqueda-texto.js';

/**
 * Buscar «nombre apellido» tiene que encontrar a la persona: el texto se parte
 * en palabras y cada una se busca en cualquiera de los campos.
 */
describe('condicionBusqueda', () => {
  test('sin texto no filtra', () => {
    assert.deepEqual(condicionBusqueda(undefined, ['nombre']), {});
    assert.deepEqual(condicionBusqueda('   ', ['nombre']), {});
  });

  test('cada palabra se busca en todos los campos', () => {
    assert.deepEqual(condicionBusqueda('  Juan   Pérez ', ['nombre', 'apellidos']), {
      AND: [
        { OR: [{ nombre: { contains: 'Juan' } }, { apellidos: { contains: 'Juan' } }] },
        { OR: [{ nombre: { contains: 'Pérez' } }, { apellidos: { contains: 'Pérez' } }] },
      ],
    });
  });

  test('las palabras de más se ignoran', () => {
    const texto = Array.from({ length: 20 }, (_, i) => `p${i}`).join(' ');
    assert.equal(palabrasDeBusqueda(texto).length, MAX_PALABRAS_BUSQUEDA);
  });
});
