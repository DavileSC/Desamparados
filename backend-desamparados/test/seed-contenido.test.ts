// Valida el contenido de ejemplo sin tocar la base de datos: las restricciones
// que el esquema impone (slugs y números de prenda únicos, campos requeridos)
// solo saltarían al ejecutar el seed contra MariaDB, y para entonces ya habría
// dejado la siembra a medias.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { existsSync } from 'node:fs';
import { CATEGORIAS_DE_RECIBOS } from '../src/domain/contabilidad.js';
import path from 'node:path';
import {
  NOTICIAS,
  EVENTOS,
  PUBLICACIONES,
  PAGINAS,
  ENSERES,
  PRENDAS,
  CATEGORIAS,
  ARCHIVO_PUBLICACION_PENDIENTE,
  ORIGEN_ARCHIVO_PENDIENTE,
  instalarArchivoPendiente,
  IMAGENES_PORTADA,
  ORIGEN_IMAGENES_PORTADA,
  instalarImagenesPortada,
  urlImagenPortada,
} from '../prisma/seed-contenido.js';
import { publicStorageDir } from '../src/middleware/upload.middleware.js';
import { rutaImagenPublica } from '../src/schemas/portada.schema.js';
import { ArkErrors } from 'arktype';

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
    for (const c of CATEGORIAS_DE_RECIBOS) assert.ok(nombres.includes(c.nombre), c.nombre);
  });

  test('el contenido ya no habla de "Hermandad"', () => {
    const todo = JSON.stringify([NOTICIAS, EVENTOS, PUBLICACIONES, PAGINAS, ENSERES]);
    assert.ok(!/hermandad/i.test(todo), 'queda alguna referencia a "Hermandad" en el contenido');
  });

  // Las publicaciones de ejemplo se siembran todas con el mismo PDF de relleno.
  // Si esa ruta no acaba existiendo donde Express sirve /storage/public, la web
  // pública ofrece una descarga que devuelve 404, que es peor que no ofrecerla.
  test('el PDF de relleno de las publicaciones existe y se instala donde lo sirve Express', () => {
    assert.ok(
      existsSync(ORIGEN_ARCHIVO_PENDIENTE),
      `falta el documento versionado en ${ORIGEN_ARCHIVO_PENDIENTE}`,
    );

    const prefijo = '/storage/public/';
    assert.ok(
      ARCHIVO_PUBLICACION_PENDIENTE.startsWith(prefijo),
      `el marcador debe colgar de ${prefijo} para que lo sirva express.static`,
    );

    // El seed calcula el destino por su cuenta para no importar el middleware de
    // subidas entero. Esta es la costura que avisa si las dos rutas divergen.
    const instalado = instalarArchivoPendiente();
    const queSirveExpress = path.join(publicStorageDir, ARCHIVO_PUBLICACION_PENDIENTE.slice(prefijo.length));

    assert.equal(instalado, queSirveExpress, 'el seed instala el PDF fuera de donde Express lo sirve');
    assert.ok(existsSync(queSirveExpress), `el seed no dejó el PDF en ${queSirveExpress}`);
  });

  // Las fotos de la cabecera se siembran como filas que apuntan a ficheros: si el
  // fichero no está donde Express lo sirve, la portada rota entre imágenes rotas.
  test('las fotos de la portada existen versionadas, pasan la validación del CMS y se instalan donde las sirve Express', () => {
    assert.ok(IMAGENES_PORTADA.length >= 2, 'con menos de dos fotos no hay rotación que probar');
    assert.deepEqual(duplicados(IMAGENES_PORTADA.map((i) => i.archivo)), []);

    for (const imagen of IMAGENES_PORTADA) {
      assert.ok(existsSync(path.join(ORIGEN_IMAGENES_PORTADA, imagen.archivo)), `falta ${imagen.archivo} en prisma/activos/portada`);
      assert.ok(imagen.descripcion.trim().length > 0 && !/[<>]/.test(imagen.descripcion), `descripción inválida en ${imagen.archivo}`);
      assert.ok(imagen.autor && imagen.licencia && imagen.fuente, `${imagen.archivo} sin atribución`);
      // Lo que guarda el seed tiene que poder guardarse también desde el CMS.
      assert.ok(!(rutaImagenPublica(urlImagenPortada(imagen.archivo)) instanceof ArkErrors), `la ruta de ${imagen.archivo} no pasa portada.schema`);
    }

    const instaladas = instalarImagenesPortada();
    IMAGENES_PORTADA.forEach((imagen, i) => {
      const queSirveExpress = path.join(publicStorageDir, 'portada', imagen.archivo);
      assert.equal(instaladas[i], queSirveExpress, 'el seed instala la foto fuera de donde Express la sirve');
      assert.ok(existsSync(queSirveExpress), `el seed no dejó ${imagen.archivo} en ${queSirveExpress}`);
    });
  });
});
