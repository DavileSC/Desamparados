import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TIPOS_BLOQUE, esTipoBloque } from '../src/domain/bloques.js';
import catalogo from '../../shared/tipos-de-bloque.json' with { type: 'json' };
import { esClaveDeModulo } from '../src/domain/modulos.js';
import { FUENTES_LISTADO } from '../src/schemas/bloques.schema.js';

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

  test('cada tipo dice de qué módulo es, con claves del catálogo; el listado, por cada fuente', () => {
    const modulo = catalogo.modulo as Record<string, string | { porFuente: Record<string, string> }>;
    assert.deepEqual(Object.keys(modulo).sort(), [...TIPOS_BLOQUE].sort());
    for (const [tipo, m] of Object.entries(modulo)) {
      if (typeof m === 'string') assert.ok(m === 'nucleo' || esClaveDeModulo(m), `${tipo}: «${m}»`);
      else {
        assert.deepEqual(Object.keys(m.porFuente).sort(), [...FUENTES_LISTADO].sort(), `${tipo}: una entrada por fuente`);
        for (const [fuente, clave] of Object.entries(m.porFuente)) assert.ok(esClaveDeModulo(clave), `${tipo}/${fuente}: «${clave}»`);
      }
    }
  });
});
