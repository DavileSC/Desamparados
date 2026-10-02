// El catálogo de módulos (shared/modulos.json) y el dominio que lo lee: que las
// claves escritas en domain/modulos.ts sean las del JSON, que los requisitos
// apunten a módulos que existen y no formen ciclos, y que las dos preguntas
// de la pantalla (qué falta para encender, qué impide apagar) salgan bien.
// Sin base de datos.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CATALOGO_MODULOS, CLAVES_MODULO, LOTE_INICIAL, dependientesActivos, esClaveDeModulo, fichaDe, requisitosQueFaltan,
} from '../src/domain/modulos.js';

const RAIZ = new URL('../../', import.meta.url);
const json = (ruta: string) => JSON.parse(readFileSync(fileURLToPath(new URL(ruta, RAIZ)), 'utf8'));
const GRUPOS_DEL_MENU = ['Web', 'Censo y procesión', 'Cuentas', 'Junta', 'Sistema'];

describe('el catálogo', () => {
  test('las claves escritas en domain/modulos.ts son las del JSON, en el mismo orden', () => {
    const delJson = (json('shared/modulos.json').modulos as { clave: string }[]).map((m) => m.clave);
    assert.deepEqual([...CLAVES_MODULO], delJson);
  });

  test('claves únicas, en minúsculas y con guiones; cada ficha con su nombre, grupo y descripción', () => {
    assert.equal(new Set(CLAVES_MODULO).size, CLAVES_MODULO.length);
    for (const m of CATALOGO_MODULOS) {
      assert.match(m.clave, /^[a-z0-9]+(-[a-z0-9]+)*$/, m.clave);
      assert.ok(m.nombre.trim() && m.descripcion.trim(), `${m.clave} sin nombre o descripción`);
      assert.ok(GRUPOS_DEL_MENU.includes(m.grupo), `${m.clave}: grupo «${m.grupo}» no es del menú del CMS`);
    }
  });

  test('los requisitos son módulos del catálogo, nadie se requiere a sí mismo y no hay ciclos', () => {
    for (const m of CATALOGO_MODULOS) {
      for (const r of m.requiere) {
        assert.ok(esClaveDeModulo(r), `${m.clave} requiere «${r}», que no existe`);
        assert.notEqual(r, m.clave);
      }
    }
    // Sin ciclos: encender cualquiera con todo apagado termina.
    for (const m of CATALOGO_MODULOS) requisitosQueFaltan(m.clave, new Set());
  });

  test('el lote inicial de esta instalación solo tiene claves del catálogo', () => {
    const activos = json('shared/datos-entidad.json').modulos.activos as string[];
    for (const c of activos) assert.ok(esClaveDeModulo(c), `datos-entidad.json enciende «${c}», que no existe`);
    assert.deepEqual([...LOTE_INICIAL], activos);
  });

  test('las dependencias que fija el spec', () => {
    assert.deepEqual(fichaDe('procesion').requiere, ['agenda']);
    assert.deepEqual(fichaDe('puerta').requiere, ['procesion']);
    assert.deepEqual(fichaDe('tienda-web').requiere, ['tienda', 'pago-en-linea']);
    assert.deepEqual(fichaDe('cuotas-en-linea').requiere, ['pago-en-linea', 'area-hermanos']);
    assert.deepEqual(fichaDe('donativos').requiere, ['pago-en-linea']);
    assert.deepEqual(fichaDe('apadrinamientos').requiere, ['pago-en-linea']);
  });
});

describe('qué falta para encender', () => {
  test('nada, si sus requisitos ya están', () => {
    assert.deepEqual(requisitosQueFaltan('puerta', new Set(['agenda', 'procesion'])), []);
  });

  test('los requisitos transitivos, los más básicos primero', () => {
    assert.deepEqual(requisitosQueFaltan('puerta', new Set()), ['agenda', 'procesion']);
    assert.deepEqual(requisitosQueFaltan('tienda-web', new Set(['tienda'])), ['pago-en-linea']);
    assert.deepEqual(requisitosQueFaltan('cuotas-en-linea', new Set()), ['pago-en-linea', 'area-hermanos']);
  });
});

describe('qué impide apagar', () => {
  test('nada, si nadie encendido lo requiere', () => {
    assert.deepEqual(dependientesActivos('pago-en-linea', new Set(['pago-en-linea', 'tienda'])), []);
    assert.deepEqual(dependientesActivos('tienda', new Set(['tienda', 'pago-en-linea'])), []);
  });

  test('los dependientes encendidos, también los transitivos', () => {
    const todos = new Set<string>(CLAVES_MODULO);
    assert.deepEqual(dependientesActivos('pago-en-linea', todos).sort(), ['apadrinamientos', 'cuotas-en-linea', 'donativos', 'tienda-web']);
    assert.deepEqual(dependientesActivos('agenda', todos).sort(), ['procesion', 'puerta']);
    assert.deepEqual(dependientesActivos('area-hermanos', new Set(['area-hermanos', 'pago-en-linea'])), []);
  });
});
