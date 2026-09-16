// test/video-galeria.test.ts
//
// Los vídeos de la galería se guardan ya normalizados a su dirección de
// incrustación, y solo de YouTube y Vimeo. Dos motivos:
//
//  - Un `src` de iframe libre es una puerta abierta: quien edite el CMS podría
//    incrustar cualquier página en la web pública.
//  - YouTube normal (youtube.com) deja cookies de terceros en cuanto se carga
//    el marco. La forma -nocookie no las deja hasta que se le da al play, y es
//    la que se guarda.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizarVideo } from '../src/domain/video-galeria.js';

describe('direcciones de vídeo que se aceptan', () => {
  test('las formas habituales de YouTube acaban en la misma dirección sin cookies', () => {
    const esperada = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      assert.equal(normalizarVideo(url), esperada, `no reconoce ${url}`);
    }
  });

  test('Vimeo se guarda como su reproductor, con el rastreo apagado', () => {
    for (const url of ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871']) {
      assert.equal(normalizarVideo(url), 'https://player.vimeo.com/video/76979871?dnt=1', `no reconoce ${url}`);
    }
  });

  test('lo que no sea YouTube o Vimeo se rechaza', () => {
    for (const url of [
      '',
      'https://ejemplo.test/video.mp4',
      'https://www.youtube.com/watch?v=',
      'javascript:alert(1)',
      'https://evil.test/embed/dQw4w9WgXcQ',
      // El dominio tiene que ser el suyo, no uno que lo lleve dentro.
      'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
      'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
    ]) {
      assert.equal(normalizarVideo(url), null, `no debería aceptar ${url}`);
    }
  });

  test('el identificador tiene que tener la forma de uno de verdad', () => {
    assert.equal(normalizarVideo('https://youtu.be/../../etc/passwd'), null);
    assert.equal(normalizarVideo('https://youtu.be/con espacios'), null);
    assert.equal(normalizarVideo('https://vimeo.com/no-es-un-numero'), null);
  });
});
