import { type } from 'arktype';
import topes from '../../../shared/topes-contenido.json' with { type: 'json' };
import { rutaImagenPublica } from './portada.schema.js';
import { normalizarVideo } from '../domain/video-galeria.js';
import { esImagenPropia, esVideoPropio } from '../utils/rutas-propias.js';

/**
 * Un medio de una galería: una foto nuestra o un vídeo, de YouTube o Vimeo o
 * subido desde el CMS (un MP4 corto, `domain/mp4.ts`).
 *
 * Vive aquí, y no dentro de `contenido.schema.ts`, porque lo usan dos sitios
 * con dos formas de validar distintas: la página de la Sagrada Titular, que
 * valida su documento entero de una vez, y el bloque `galeria` del constructor
 * de páginas (`bloques.schema.ts`), que se valida bloque a bloque. Con una
 * copia en cada lado, la regla de «todo medio lleva descripción» se podía
 * arreglar en uno y quedarse rota en el otro.
 */

const texto = (max: number) => type(`0 <= string <= ${max}`)
  .matching(/^[^<>]*$/)
  .describe(`un texto de hasta ${max} caracteres, sin < ni >`);

const sinFoto = type('string').matching(/^$/);

/**
 * Es un objeto plano con un campo `tipo` y no una unión discriminada a
 * propósito: arktype 2.1 revienta al describir el error de una unión cuyas
 * ramas llevan `narrow`, y eso sería un 500 en vez de un 400. La coherencia
 * entre `tipo` y `url` la comprueba `problemaDelMedio`.
 */
export const medioGaleriaSchema = type({
  tipo: "'foto' | 'video'",
  // Una ruta nuestra o una dirección de vídeo ya normalizada: lo estrecha
  // `problemaDelMedio`.
  url: 'string <= 300',
  // Solo para los vídeos: la miniatura que se enseña hasta que alguien pulsa el
  // play. Con ella la web no llama a YouTube mientras nadie se lo pida.
  portada: sinFoto.or(rutaImagenPublica),
  alt: texto(topes.descripcion),
  pie: texto(topes.etiqueta),
});

/** Qué falla en un medio, o `null` si está bien. Devuelve también el campo. */
export function problemaDelMedio(
  medio: { tipo: string; url: string; portada: string; alt: string },
): { campo: string; problema: string } | null {
  if (medio.alt.trim() === '') {
    // Sin descripción, la galería no existe para quien use un lector de pantalla.
    return { campo: 'alt', problema: 'es obligatoria: describe lo que se ve' };
  }
  if (medio.tipo === 'foto') {
    return esImagenPropia(medio.url)
      ? null
      : { campo: 'url', problema: 'tiene que ser una foto subida desde el CMS' };
  }
  if (!esVideoPropio(medio.url) && normalizarVideo(medio.url) === null) {
    return { campo: 'url', problema: 'tiene que ser un vídeo de YouTube o Vimeo, o uno subido desde el CMS' };
  }
  return medio.portada === ''
    // Sin portada propia habría que pedirle la miniatura a YouTube nada más
    // abrir la página, y eso ya avisa a un tercero de la visita. En un vídeo
    // nuestro es lo que evita descargarlo entero solo para enseñar la galería.
    ? { campo: 'portada', problema: 'es obligatoria en los vídeos' }
    : null;
}
