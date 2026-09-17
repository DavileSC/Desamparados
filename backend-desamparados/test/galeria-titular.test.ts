// test/galeria-titular.test.ts
//
// La galería de la Sagrada Titular: un documento de contenido más (slug
// `titular`), con una lista de fotos y vídeos que el CMS ordena.
//
// Las reglas que se fijan aquí son las que no se pueden dejar al formulario:
//  - Una foto tiene que ser nuestra (/storage/public/…): una URL externa avisa
//    a un tercero de cada visita y el limpiador de huérfanos no la conoce.
//  - Un vídeo solo puede ser YouTube o Vimeo, ya normalizado.
//  - Todo medio lleva descripción: sin ella, la galería no existe para quien
//    use un lector de pantalla. Es la misma regla que ya tienen el plano del
//    recorrido y las fotos de los hitos de Historia.
//  - Un vídeo lleva además foto de portada propia, para no llamar a YouTube
//    hasta que el visitante pulse el play.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import { esquemaDeSlug } from '../src/schemas/contenido.schema.js';
import { SLUGS_CONTENIDO, porDefecto } from '../src/domain/contenido.js';

const esquema = () => esquemaDeSlug('titular');
const falla = (valor: unknown) => esquema()(valor) instanceof ArkErrors;

const FOTO = { tipo: 'foto', url: '/storage/public/abc123.webp', portada: '', alt: 'La Virgen en su camarín', pie: 'Camarín' };
const VIDEO = { tipo: 'video', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', portada: '/storage/public/def456.webp', alt: 'Salida procesional de 2026', pie: '' };

const documento = (galeria: unknown[]) => ({
  ceja: 'Sagrada Titular',
  titulo: 'Nuestra Señora de los Desamparados',
  subtitulo: 'Imágenes de nuestra Amantísima Titular.',
  galeria,
});

describe('la galería de la Titular es un documento de contenido', () => {
  test('el slug está declarado y trae textos de partida', () => {
    assert.ok((SLUGS_CONTENIDO as readonly string[]).includes('titular'), 'falta el slug titular');
    const defectos = porDefecto('titular') as { galeria?: unknown[] };
    assert.ok(Array.isArray(defectos.galeria), 'los valores por defecto deben traer la lista de la galería');
  });

  test('acepta fotos y vídeos juntos', () => {
    assert.ok(!falla(documento([FOTO, VIDEO])));
    assert.ok(!falla(documento([])), 'una galería vacía es válida: la sección se oculta');
  });

  /**
   * Lo que el CMS pide es «pega la dirección de YouTube o Vimeo», y eso es lo
   * que la gente va a pegar: la del navegador. El servidor la NORMALIZA al
   * guardar; exigirla ya normalizada dejaba la función inservible, porque nadie
   * escribe a mano una dirección `-nocookie/embed`.
   */
  test('la dirección se pega tal cual del navegador y se guarda normalizada', () => {
    for (const pegada of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      const salida = esquema()(documento([{ ...VIDEO, url: pegada }]));
      assert.ok(!(salida instanceof ArkErrors), `debería aceptar ${pegada}`);
      assert.equal(
        (salida as { galeria: { url: string }[] }).galeria[0].url,
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        `no ha normalizado ${pegada}`,
      );
    }
  });

  test('Vimeo también se pega tal cual', () => {
    const salida = esquema()(documento([{ ...VIDEO, url: 'https://vimeo.com/76979871' }]));
    assert.ok(!(salida instanceof ArkErrors));
    assert.equal((salida as { galeria: { url: string }[] }).galeria[0].url, 'https://player.vimeo.com/video/76979871?dnt=1');
  });
});

describe('lo que la galería no deja pasar', () => {
  test('una foto de fuera de nuestro servidor', () => {
    assert.ok(falla(documento([{ ...FOTO, url: 'https://ejemplo.test/foto.jpg' }])));
    assert.ok(falla(documento([{ ...FOTO, url: '' }])));
  });

  test('un vídeo que no sea de YouTube ni de Vimeo', () => {
    assert.ok(falla(documento([{ ...VIDEO, url: 'https://ejemplo.test/video.mp4' }])));
    assert.ok(falla(documento([{ ...VIDEO, url: 'https://youtube.com.sitio-malo.test/watch?v=dQw4w9WgXcQ' }])));
  });

  test('un medio sin descripción', () => {
    assert.ok(falla(documento([{ ...FOTO, alt: '' }])));
    assert.ok(falla(documento([{ ...FOTO, alt: '   ' }])), 'ni espacios en blanco');
    assert.ok(falla(documento([{ ...VIDEO, alt: '' }])));
  });

  test('un vídeo sin foto de portada: no se llama a YouTube hasta que lo pidan', () => {
    assert.ok(falla(documento([{ ...VIDEO, portada: '' }])));
    assert.ok(falla(documento([{ ...VIDEO, portada: 'https://i.ytimg.com/vi/x/hq.jpg' }])),
      'la portada también tiene que ser nuestra');
  });

  test('un tipo que no existe', () => {
    assert.ok(falla(documento([{ ...FOTO, tipo: 'audio' }])));
  });

  test('una galería desmedida', () => {
    assert.ok(falla(documento(Array.from({ length: 61 }, () => FOTO))));
  });
});
