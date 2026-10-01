import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  aArticulo, aLaCorporacion, conArticulo, deArticulo, deLaCorporacion, laCorporacion, mayuscula, nuestraCorporacion, nuestro, type Articulo,
} from '../src/domain/articulos.js';

const casos = JSON.parse(readFileSync(fileURLToPath(new URL('../../shared/casos-articulos.json', import.meta.url)), 'utf8'));

describe('artículos', () => {
  test('con, de y a, con sus contracciones', () => {
    for (const [art, nombre, esperado] of casos.con) assert.equal(conArticulo(art as Articulo, nombre), esperado);
    for (const [art, nombre, esperado] of casos.de) assert.equal(deArticulo(art as Articulo, nombre), esperado);
    for (const [art, nombre, esperado] of casos.a) assert.equal(aArticulo(art as Articulo, nombre), esperado);
  });
  test('el posesivo concuerda con el artículo', () => {
    for (const [art, esperado] of casos.nuestro) assert.equal(nuestro(art as Articulo), esperado);
  });
  test('la mayúscula de comienzo de frase', () => {
    for (const [texto, esperado] of casos.mayuscula) assert.equal(mayuscula(texto), esperado);
  });
});

describe('la corporación', () => {
  const hermandad = { articulo: 'la' as const, tipo: 'Hermandad', tipoCorto: 'Hermandad' };
  test('la de esta instalación', () => {
    assert.equal(laCorporacion(), 'el Grupo Parroquial');
    assert.equal(deLaCorporacion(), 'del Grupo Parroquial');
    assert.equal(deLaCorporacion({ corto: true }), 'del Grupo');
    assert.equal(aLaCorporacion(), 'al Grupo Parroquial');
    assert.equal(nuestraCorporacion(), 'nuestro Grupo Parroquial');
  });
  test('otra instalación', () => {
    assert.equal(deLaCorporacion({ identidad: hermandad }), 'de la Hermandad');
    assert.equal(nuestraCorporacion({ identidad: hermandad }), 'nuestra Hermandad');
    assert.equal(mayuscula(laCorporacion({ identidad: hermandad })), 'La Hermandad');
  });
});
