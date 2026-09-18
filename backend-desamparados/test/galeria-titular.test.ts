// test/galeria-titular.test.ts
//
// La galería de fotos y vídeos, que desde el constructor de páginas es un
// bloque más (`galeria`) y ya no un documento con forma propia: la página de la
// Sagrada Titular la lleva como cualquier otra página puede llevarla.
//
// Las reglas que se fijan aquí son las que no se pueden dejar al formulario:
//  - Una foto tiene que ser nuestra (/storage/public/… o /images/…): una URL
//    externa avisa a un tercero de cada visita y el limpiador de huérfanos no
//    la conoce.
//  - Un vídeo solo puede ser de YouTube o Vimeo.
//  - Todo medio lleva descripción: sin ella, la galería no existe para quien
//    use un lector de pantalla.
//  - Un vídeo lleva además foto de portada propia, para no llamar a YouTube
//    hasta que el visitante pulse el play.
//
// Y una que es del camino y no del esquema: **la dirección se pega tal cual se
// copia del navegador**. El CMS pide «pega la dirección de YouTube o Vimeo», y
// eso es lo que la gente pega; nadie escribe a mano una `-nocookie/embed`.
// Quien normaliza es `sanearBloques`, antes de validar, así que estas pruebas
// recorren los dos pasos en el mismo orden que la ruta.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import { esquemaDeSlug } from '../src/schemas/contenido.schema.js';
import { esquemaDeBloque } from '../src/schemas/bloques.schema.js';
import { sanearBloques } from '../src/utils/sanear-html.js';
import { SLUGS_CONTENIDO, porDefecto } from '../src/domain/contenido.js';

const FOTO = {
  tipo: 'foto', url: '/storage/public/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.webp',
  portada: '', alt: 'La Virgen en su camarín', pie: 'Camarín',
};
const VIDEO = {
  tipo: 'video', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  portada: '/storage/public/b1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.webp',
  alt: 'Salida procesional de 2026', pie: '',
};

const bloque = (medios: unknown[]) => ({ tipo: 'galeria', titulo: 'Galería', medios });
const falla = (medios: unknown[]) => esquemaDeBloque('galeria' as never)(bloque(medios)) instanceof ArkErrors;

/** El camino de la ruta: primero se prepara el documento, después se valida. */
function guardar(medios: unknown[]) {
  const preparado = sanearBloques({
    cabecera: { titulo: 'Sagrada Titular', subtitulo: '', foto: '', fotoAlt: '' },
    bloques: [bloque(medios)],
  }) as { bloques: { medios: { url: string }[] }[] };

  const salida = esquemaDeSlug('titular')(preparado);
  return { rechazado: salida instanceof ArkErrors, medios: preparado.bloques[0].medios };
}

describe('la página de la Titular ya es una página de bloques', () => {
  test('el slug está declarado y sus textos de partida están en forma de bloques', () => {
    assert.ok((SLUGS_CONTENIDO as readonly string[]).includes('titular'), 'falta el slug titular');
    const defectos = porDefecto('titular') as { cabecera?: unknown; bloques?: unknown };
    assert.ok(defectos.cabecera, 'faltan los valores de partida de la cabecera');
    assert.ok(Array.isArray(defectos.bloques), 'los valores de partida deben traer la lista de bloques');
  });
});

describe('el bloque de galería', () => {
  test('acepta fotos y vídeos juntos', () => {
    assert.ok(!falla([FOTO, VIDEO]));
  });

  test('rechaza una galería vacía', () => {
    // A diferencia de la galería de antes, que podía quedarse vacía y ocultaba
    // su sección: aquí el bloque entero se quita, y un bloque que no pinta nada
    // es un hueco sin explicación para quien edita.
    assert.ok(falla([]));
  });

  test('una foto tiene que ser nuestra', () => {
    assert.ok(falla([{ ...FOTO, url: 'https://otro-sitio.example/foto.jpg' }]));
    assert.ok(!falla([{ ...FOTO, url: '/images/procesion.jpg' }]), 'las de la propia web también valen');
  });

  test('todo medio lleva descripción', () => {
    assert.ok(falla([{ ...FOTO, alt: '' }]));
    assert.ok(falla([{ ...VIDEO, alt: '   ' }]), 'solo espacios no describe nada');
  });

  test('un vídeo lleva foto de portada propia', () => {
    assert.ok(falla([{ ...VIDEO, portada: '' }]));
  });
});

describe('la dirección del vídeo se pega tal cual del navegador', () => {
  const PORTADA = VIDEO.portada;
  const conUrl = (url: string) => [{ tipo: 'video', url, portada: PORTADA, alt: 'Un vídeo', pie: '' }];

  test('las formas habituales de YouTube se aceptan y se guardan sin cookies', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      const { rechazado, medios } = guardar(conUrl(url));
      assert.ok(!rechazado, `debería aceptar ${url}`);
      assert.equal(medios[0].url, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    }
  });

  test('Vimeo también se pega tal cual', () => {
    const { rechazado, medios } = guardar(conUrl('https://vimeo.com/123456789'));
    assert.ok(!rechazado);
    assert.equal(medios[0].url, 'https://player.vimeo.com/video/123456789?dnt=1');
  });

  test('lo que no es YouTube ni Vimeo se rechaza', () => {
    // El valor acaba en el `src` de un iframe: con dirección libre, quien edite
    // el CMS podría incrustar cualquier página dentro del sitio.
    for (const url of [
      'https://ejemplo.test/video.mp4',
      'https://youtube.com.sitio-malo.test/embed/dQw4w9WgXcQ',
      'javascript:alert(1)',
    ]) {
      assert.ok(guardar(conUrl(url)).rechazado, `debería rechazar ${url}`);
    }
  });

  test('una foto no se toca al prepararla', () => {
    const { rechazado, medios } = guardar([FOTO]);
    assert.ok(!rechazado);
    assert.equal(medios[0].url, FOTO.url);
  });
});
