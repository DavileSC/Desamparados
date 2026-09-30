// Los campos de las cartas (octubre de 2026).

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { camposDesconocidos, rellenar, tratamientoDe } from '../src/domain/cartas.js';

const ANA = { nombre: 'Ana', apellidos: 'Ruiz Gil', sexo: 'MUJER' as const, tratamiento: null, numeroHermano: 57 };

describe('los campos de una carta', () => {
  test('se rellenan con los datos de cada hermano', () => {
    assert.equal(rellenar('{{saludo}} {{tratamiento}} {{nombre}} {{apellidos}}, hermana n.º {{numero}}:', ANA), 'Estimada Dña. Ana Ruiz Gil, hermana n.º 57:');
    assert.equal(rellenar('{{ Nombre }}', ANA), 'Ana', 'con espacios y mayúsculas');
  });

  test('el tratamiento de la ficha manda; sin sexo ni tratamiento, no se inventa', () => {
    assert.equal(tratamientoDe({ ...ANA, tratamiento: 'Rvda. M.' }), 'Rvda. M.');
    assert.equal(rellenar('{{tratamiento}} {{nombre}}', { ...ANA, sexo: null }), ' Ana', 'sin doble espacio');
  });

  test('un campo mal escrito se queda a la vista y se avisa', () => {
    assert.equal(rellenar('Hola {{nobre}}', ANA), 'Hola {{nobre}}');
    assert.deepEqual(camposDesconocidos('{{nombre}} {{nobre}} {{ dni }} {{nobre}}'), ['nobre', 'dni']);
  });
});
