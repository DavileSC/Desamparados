import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TIPOS_BLOQUE, esTipoBloque } from '../src/domain/bloques.js';

describe('catálogo de tipos de bloque', () => {
  test('los bloques de las dos fases están declarados', () => {
    for (const tipo of ['texto', 'foto', 'galeria', 'tarjetas', 'llamada', 'datos', 'itinerario', 'cronologia', 'listado', 'contacto']) {
      assert.ok((TIPOS_BLOQUE as readonly string[]).includes(tipo), `falta el tipo ${tipo}`);
    }
  });

  test('reconoce los tipos declarados y rechaza el resto', () => {
    assert.equal(esTipoBloque('texto'), true);
    assert.equal(esTipoBloque('loQueSea'), false);
    assert.equal(esTipoBloque(''), false);
    assert.equal(esTipoBloque(null), false);
    assert.equal(esTipoBloque(42), false);
  });

  test('no hay tipos repetidos', () => {
    assert.equal(new Set(TIPOS_BLOQUE).size, TIPOS_BLOQUE.length);
  });
});
