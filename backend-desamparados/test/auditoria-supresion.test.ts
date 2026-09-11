import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suprimirDatosPersonales, VALOR_SUPRIMIDO } from '../src/domain/auditoria-supresion.js';

// El caso que la motiva: HERMANO_ACTUALIZAR guarda el antes y el después.
test('suprime los valores personales y conserva qué campos cambiaron', () => {
  const detalles = {
    antes: { email: 'viejo@ejemplo.test', dni: '12345678Z', direccion: 'Calle 1', activo: true, numeroHermano: 12 },
    despues: { email: 'nuevo@ejemplo.test', dni: '87654321X', direccion: 'Calle 2', activo: false, numeroHermano: null }
  };
  assert.deepEqual(suprimirDatosPersonales(detalles), {
    antes: { email: VALOR_SUPRIMIDO, dni: VALOR_SUPRIMIDO, direccion: VALOR_SUPRIMIDO, activo: true, numeroHermano: 12 },
    despues: { email: VALOR_SUPRIMIDO, dni: VALOR_SUPRIMIDO, direccion: VALOR_SUPRIMIDO, activo: false, numeroHermano: null }
  });
});

test('entra en listas y objetos anidados (fichas aprobadas, emancipación)', () => {
  const detalles = { origen: 'tutor', despues: { fichasAprobadas: [{ id: 3, nombre: 'Ana', numeroHermano: 7 }] } };
  assert.deepEqual(suprimirDatosPersonales(detalles), {
    origen: 'tutor', despues: { fichasAprobadas: [{ id: 3, nombre: VALOR_SUPRIMIDO, numeroHermano: 7 }] }
  });
});

test('un dato personal que no existía se queda en null', () => {
  assert.deepEqual(suprimirDatosPersonales({ antes: { email: null }, despues: { email: 'a@b.es' } }), {
    antes: { email: null }, despues: { email: VALOR_SUPRIMIDO }
  });
});

test('no cambia el original', () => {
  const original = { antes: { email: 'a@b.es' } };
  suprimirDatosPersonales(original);
  assert.equal(original.antes.email, 'a@b.es');
});
