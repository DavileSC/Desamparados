import { type } from 'arktype';

export const MAX_IMAGENES_PORTADA = 12;

// Solo rutas relativas del propio sitio: lo que devuelve la subida del CMS
// (`/storage/public/…`, con o sin subcarpeta) o una imagen estática de la web
// (`/images/…`). Nada de URLs externas ni de esquemas como `javascript:`: la
// ruta acaba en el `src` de una <img> de la portada.
export const rutaImagenPublica = type('string')
  .matching(/^\/(?:storage\/public|images)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i)
  .describe('una ruta de imagen del propio sitio (/storage/public/… o /images/…)');

// Es el texto alternativo de la foto: sin etiquetas.
const descripcionImagen = type('string <= 200')
  .matching(/^[^<>]*$/)
  .describe('una descripción sin caracteres especiales (<, >)');

export const guardarImagenesPortadaSchema = type({
  body: {
    imagenes: type({ url: rutaImagenPublica, 'descripcion?': descripcionImagen })
      .array()
      .atMostLength(MAX_IMAGENES_PORTADA),
  },
});
