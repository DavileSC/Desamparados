// Un enlace escrito en el CMS (tarjetas, botón de una llamada) tiene que llevar
// a una página que exista. Antes bastaba con empezar por «/», y una tarjeta con
// «/corporacion/hola» se guardaba y llevaba a «página no encontrada».

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import defectos from '../../shared/contenido-por-defecto.json' with { type: 'json' };
import { RUTAS_DESTINO, esDestinoValido } from '../src/domain/destinos.js';
import { esquemaDeBloque } from '../src/schemas/bloques.schema.js';

const tarjetas = (enlace: string) => ({ tipo: 'tarjetas', titulo: '', tarjetas: [{ titulo: 'Una', descripcion: '', enlace }] });
const llamada = (enlace: string) => ({ tipo: 'llamada', titulo: '', texto: '', boton: 'Ir', enlace });
const valida = (bloque: { tipo: string }) => !(esquemaDeBloque(bloque.tipo as never)(bloque) instanceof ArkErrors);

describe('destinos de los enlaces', () => {
  test('todas las páginas del catálogo y las demás rutas declaradas valen', () => {
    assert.ok(RUTAS_DESTINO.size >= 25);
    for (const ruta of RUTAS_DESTINO) assert.ok(esDestinoValido(ruta), ruta);
  });

  test('una ruta que no existe no vale, aunque parezca del sitio', () => {
    assert.equal(esDestinoValido('/corporacion/hola'), false);
    assert.equal(esDestinoValido('/corporacion/historia/'), false);
    assert.equal(esDestinoValido('/actualidad/noticias'), true);
  });

  test('una noticia vale por su slug, con el formato que genera el servidor', () => {
    assert.ok(esDestinoValido('/actualidad/noticias/apertura-del-curso-2026'));
    assert.equal(esDestinoValido('/actualidad/noticias/Apertura'), false);
    assert.equal(esDestinoValido('/actualidad/noticias/a/b'), false);
    assert.equal(esDestinoValido('/actualidad/noticias/-a'), false);
  });

  test('nada de fuera del sitio', () => {
    for (const enlace of ['https://otro.test', '//otro.test', 'javascript:alert(1)', 'corporacion']) {
      assert.equal(esDestinoValido(enlace), false, enlace);
    }
  });

  test('la tarjeta y la llamada lo aplican; la tarjeta sigue pudiendo ir sin enlace', () => {
    assert.ok(valida(tarjetas('/corporacion/historia')));
    assert.ok(valida(tarjetas('')));
    assert.ok(!valida(tarjetas('/corporacion/hola')));
    assert.ok(valida(llamada('/hermanos/hazte-hermano')));
    assert.ok(!valida(llamada('/hermanos/hazteme')));
    assert.ok(!valida(llamada('')));
  });

  test('los enlaces del contenido de partida llevan todos a páginas que existen', () => {
    const enlaces: string[] = [];
    const recorrer = (valor: unknown, dentroDeBloques: boolean) => {
      if (Array.isArray(valor)) valor.forEach((v) => recorrer(v, dentroDeBloques));
      else if (valor && typeof valor === 'object') {
        for (const [clave, v] of Object.entries(valor)) {
          if (dentroDeBloques && clave === 'enlace' && typeof v === 'string' && v !== '') enlaces.push(v);
          recorrer(v, dentroDeBloques || clave === 'bloques');
        }
      }
    };
    recorrer(defectos, false);
    assert.ok(enlaces.length >= 7);
    for (const enlace of enlaces) assert.ok(esDestinoValido(enlace), enlace);
  });
});
