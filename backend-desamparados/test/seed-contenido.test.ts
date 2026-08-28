// Valida el contenido de ejemplo sin tocar la base de datos: las restricciones
// que el esquema impone (slugs y números de prenda únicos, campos requeridos)
// solo saltarían al ejecutar el seed contra MariaDB, y para entonces ya habría
// dejado la siembra a medias.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  NOTICIAS,
  EVENTOS,
  PUBLICACIONES,
  PAGINAS,
  ENSERES,
  PRENDAS,
  CATEGORIAS,
} from '../prisma/seed-contenido.js';

const FORMATO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function duplicados(valores: string[]): string[] {
  const vistos = new Set<string>();
  return valores.filter((v) => (vistos.has(v) ? true : (vistos.add(v), false)));
}

describe('contenido del seed', () => {
  test('los slugs son únicos y con formato válido', () => {
    const slugs = [...NOTICIAS.map((n) => n.slug), ...PAGINAS.map((p) => p.slug)];
    assert.deepEqual(duplicados(slugs), [], 'hay slugs repetidos: el upsert los pisaría');
    for (const slug of slugs) {
      assert.match(slug, FORMATO_SLUG, `slug inválido: "${slug}"`);
    }
  });

  test('los números de prenda son únicos', () => {
    assert.deepEqual(duplicados(PRENDAS.map((p) => p.numero)), []);
  });

  test('los títulos usados para detectar duplicados son únicos', () => {
    // `sembrarEventos` y `sembrarPublicaciones` comprueban por título porque el
    // esquema no les da clave única: dos títulos iguales romperían la idempotencia.
    assert.deepEqual(duplicados(EVENTOS.map((e) => e.title)), []);
    assert.deepEqual(duplicados(PUBLICACIONES.map((p) => p.titulo)), []);
    assert.deepEqual(duplicados(ENSERES.map((e) => e.nombre)), []);
  });

  test('ningún texto visible queda vacío', () => {
    for (const noticia of NOTICIAS) {
      assert.ok(noticia.titulo.trim().length > 0, `noticia sin título: ${noticia.slug}`);
      assert.ok(noticia.extracto.trim().length > 0, `noticia sin extracto: ${noticia.slug}`);
      assert.ok(noticia.contenido.includes('<p>'), `noticia sin cuerpo HTML: ${noticia.slug}`);
    }
    for (const pagina of PAGINAS) {
      assert.ok(pagina.titulo.trim().length > 0, `página sin título: ${pagina.slug}`);
      assert.ok(pagina.contenido.includes('<p>'), `página sin cuerpo HTML: ${pagina.slug}`);
    }
    for (const evento of EVENTOS) {
      assert.ok(evento.title.trim().length > 0);
      assert.ok(evento.location.trim().length > 0, `evento sin lugar: ${evento.title}`);
    }
  });

  test('los eventos con fecha de fin acaban después de empezar', () => {
    for (const evento of EVENTOS) {
      if ('diasFin' in evento && typeof evento.diasFin === 'number') {
        assert.ok(
          evento.diasFin > evento.diasDesdeHoy,
          `"${evento.title}" termina antes de empezar`
        );
      }
    }
  });

  test('las horas de los eventos son horas del día válidas', () => {
    for (const evento of EVENTOS) {
      // `sembrarEventos` calcula el fin como hora + 2: debe seguir cabiendo en el día.
      assert.ok(evento.hora >= 0 && evento.hora <= 21, `hora fuera de rango en "${evento.title}"`);
    }
  });

  test('el inventario cuadra: ninguna cantidad es negativa', () => {
    for (const enser of ENSERES) {
      assert.ok(enser.cantidadOptimo >= 0 && enser.cantidadBueno >= 0 && enser.cantidadReparar >= 0,
        `cantidades negativas en "${enser.nombre}"`);
    }
  });

  test('están las categorías contables que crea recibo.service', () => {
    // Si estos nombres dejan de coincidir, cada cobro crearía una categoría
    // duplicada dentro de su propia transacción.
    const nombres = CATEGORIAS.map((c) => c.nombre);
    assert.ok(nombres.includes('Cuotas y papeletas'));
    assert.ok(nombres.includes('Devoluciones de recibos'));
  });

  test('el contenido ya no habla de "Hermandad"', () => {
    const todo = JSON.stringify([NOTICIAS, EVENTOS, PUBLICACIONES, PAGINAS, ENSERES]);
    assert.ok(!/hermandad/i.test(todo), 'queda alguna referencia a "Hermandad" en el contenido');
  });
});
