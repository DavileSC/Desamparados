import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import catalogo from '../../shared/paginas-publicas.json' with { type: 'json' };
import { SLUGS_CONTENIDO, porDefecto, esSlugContenido } from '../src/domain/contenido.js';
import { esquemaDeSlug } from '../src/schemas/contenido.schema.js';

/**
 * El catálogo de páginas por bloques (`shared/paginas-publicas.json`) lo lee el
 * CMS para pintar su índice, y aquí se comprueba que el servidor sabe atender
 * todo lo que ese índice ofrece.
 *
 * Sin esto, convertir una página más y olvidarse del servidor daría un enlace
 * en el CMS que lleva a un 404 al cargar, o a un 400 al guardar, sin que nada
 * avisara antes. Es la misma guarda que `bloques-catalogo.test.ts` hace con los
 * tipos de bloque.
 */
describe('catálogo de páginas de la web pública', () => {
  const PAGINAS = catalogo.paginas;

  test('hay al menos una página declarada', () => {
    assert.ok(PAGINAS.length > 0);
  });

  test('cada página del catálogo es un slug de contenido conocido', () => {
    for (const { slug } of PAGINAS) {
      assert.ok(esSlugContenido(slug), `el slug «${slug}» no está en SLUGS_CONTENIDO`);
      assert.ok((SLUGS_CONTENIDO as readonly string[]).includes(slug));
    }
  });

  test('cada página trae valores de partida con cabecera y lista de bloques', () => {
    // Sin ellos, la web pública se queda en blanco mientras carga y si el
    // servidor no contesta: las páginas los usan como contenido de respaldo.
    for (const { slug } of PAGINAS) {
      const defectos = porDefecto(slug as never) as { cabecera?: unknown; bloques?: unknown };
      assert.ok(defectos, `faltan los valores de partida de «${slug}»`);
      assert.ok(defectos.cabecera, `«${slug}» no trae cabecera de partida`);
      assert.ok(Array.isArray(defectos.bloques), `«${slug}» no trae lista de bloques`);
    }
  });

  test('los valores de partida de cada página pasan su propio esquema', () => {
    // Un contenido de partida que el servidor rechazaría es una página que no
    // se puede volver a guardar tal y como viene.
    for (const { slug } of PAGINAS) {
      const salida = esquemaDeSlug(slug as never)(porDefecto(slug as never));
      assert.ok(!(salida instanceof ArkErrors), `«${slug}» no pasa su esquema: ${salida}`);
    }
  });

  test('no hay slugs ni rutas repetidos', () => {
    assert.equal(new Set(PAGINAS.map((p) => p.slug)).size, PAGINAS.length, 'slugs repetidos');
    assert.equal(new Set(PAGINAS.map((p) => p.ruta)).size, PAGINAS.length, 'rutas repetidas');
  });
});
