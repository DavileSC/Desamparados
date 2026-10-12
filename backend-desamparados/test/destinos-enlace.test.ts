// Un enlace escrito en el CMS (tarjetas, botón de una llamada) tiene que llevar
// a una página que exista. Antes bastaba con empezar por «/», y una tarjeta con
// «/hola» se guardaba y llevaba a «página no encontrada».

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
    assert.equal(esDestinoValido('/hola'), false);
    assert.equal(esDestinoValido('/historia/'), false);
    assert.equal(esDestinoValido('/noticias'), true);
  });

  test('una noticia vale por su slug, con el formato que genera el servidor', () => {
    assert.ok(esDestinoValido('/noticias/apertura-del-curso-2026'));
    assert.equal(esDestinoValido('/noticias/Apertura'), false);
    assert.equal(esDestinoValido('/noticias/a/b'), false);
    assert.equal(esDestinoValido('/noticias/-a'), false);
  });

  test('una dirección antigua que redirige se acepta, pero no es un destino que ofrecer', () => {
    // /parroquia-pasionistas pasó a /parroquia (12-10-2026): las páginas que
    // la llevan guardada tienen que poder volver a guardarse.
    assert.ok(esDestinoValido('/parroquia-pasionistas'));
    assert.ok(esDestinoValido('/parroquia-pasionistas#como-llegar'));
    assert.ok(!RUTAS_DESTINO.has('/parroquia-pasionistas'));
    assert.ok(RUTAS_DESTINO.has('/parroquia'));
  });

  test('nada de fuera del sitio', () => {
    for (const enlace of ['https://otro.test', '//otro.test', 'javascript:alert(1)', 'corporacion']) {
      assert.equal(esDestinoValido(enlace), false, enlace);
    }
  });

  test('la tarjeta y la llamada lo aplican; la tarjeta sigue pudiendo ir sin enlace', () => {
    assert.ok(valida(tarjetas('/historia')));
    assert.ok(valida(tarjetas('')));
    assert.ok(!valida(tarjetas('/hola')));
    assert.ok(valida(llamada('/hazte-hermano')));
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
