import { HttpError } from './error.handle.js';

/**
 * Las rutas de ficheros del propio sitio que el CMS guarda en la base de datos
 * (fotos, PDF) y dentro del HTML de noticias y páginas. Una sola definición para
 * los esquemas, el saneado de HTML y los servicios.
 */

/**
 * Una imagen del propio sitio: lo que devuelve la subida del CMS
 * (`/storage/public/…`, con o sin subcarpeta) o una imagen estática de la web
 * (`/images/…`). La extensión puede venir en mayúsculas («FOTO.JPG» subida antes
 * de que la subida la pasara a minúsculas).
 */
export const IMAGEN_PROPIA = /^\/(?:storage\/public|images)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i;

/**
 * El PDF de relleno con el que el seed crea las publicaciones de ejemplo
 * (`ARCHIVO_PUBLICACION_PENDIENTE` en prisma/seed-contenido.ts).
 * `test/contenido-cms.test.ts` comprueba que las dos constantes no se separan.
 */
export const PDF_DE_RELLENO = '/storage/public/documentos/pendiente.pdf';

export const esImagenPropia = (ruta: string) => IMAGEN_PROPIA.test(ruta);

/**
 * Un vídeo subido desde el CMS: solo MP4 y solo en la raíz de /storage/public,
 * que es donde lo deja la subida (`POST /api/upload/video/:uso`). Nada de
 * vídeos estáticos ni de otras carpetas: no los hay.
 */
export const VIDEO_PROPIO = /^\/storage\/public\/[a-f0-9]{32}\.mp4$/i;

export const esVideoPropio = (ruta: string) => VIDEO_PROPIO.test(ruta);

/** Un PDF subido desde el CMS (32 hex en la raíz de /storage/public) o el de relleno del seed. */
export const esPdfPropio = (ruta: string) => ruta === PDF_DE_RELLENO || /^\/storage\/public\/[a-f0-9]{32}\.pdf$/i.test(ruta);

/**
 * Convierte en ruta relativa una URL absoluta que apunta a un fichero nuestro:
 * `https://www.dominio/storage/public/<hex>.jpg` o
 * `http://localhost:3001/storage/public/<hex>.jpg` pasan a `/storage/public/<hex>.jpg`.
 *
 * Es lo que da «Copiar dirección de imagen» en el navegador, lo que guardaban
 * versiones antiguas del CMS y lo que el saneado anterior admitía. Sin esto, el
 * saneado quitaba esa <img> al guardar y el fichero, ya sin referencias, se
 * borraba del disco.
 *
 * Vale cualquier host: el fichero es nuestro si la ruta encaja con las nuestras
 * (una imagen ajena con una ruta así acabaría apuntando a nuestro sitio y, como
 * mucho, se vería rota: ya no avisa a nadie de la visita). La consulta y el
 * fragmento se descartan, y `URL` resuelve los `..` antes de comprobar, así que
 * nada escapa de las carpetas públicas. Lo que no encaja se devuelve tal cual
 * para que lo rechace quien valide.
 */
export function aRutaPropia(valor: string, esPropia: (ruta: string) => boolean): string {
  const limpio = valor.trim();
  if (!/^(?:https?:)?\/\//i.test(limpio)) return valor;
  try {
    const { pathname } = new URL(limpio, 'http://relativo.invalid');
    return esPropia(pathname) ? pathname : valor;
  } catch {
    return valor;
  }
}

/**
 * Qué guardar en un campo de ruta al EDITAR un registro.
 *
 * - `undefined`: el campo no venía; no se toca.
 * - `''` o `null`: se quita (si el campo lo permite).
 * - Igual que lo guardado: no se toca. El formulario reenvía la ficha entera,
 *   y una publicación con un `archivoUrl` de antes de la validación (una URL
 *   tecleada en el antiguo campo de texto) no podía volver a guardarse por un
 *   campo que nadie había cambiado.
 * - Distinto: tiene que ser una ruta propia válida, o un 400 que dice qué
 *   campo volver a subir.
 */
export function rutaAlEditar(
  nueva: string | null | undefined,
  guardada: string | null,
  { esValida, mensaje, siFalta }: { esValida: (ruta: string) => boolean; mensaje: string; /** Si el campo es obligatorio: el 400 al quitarlo. */ siFalta?: string },
): string | null | undefined {
  if (nueva === undefined || nueva === guardada) return undefined;
  if (nueva === null || nueva === '') {
    if (siFalta) throw new HttpError(siFalta);
    return null;
  }
  if (!esValida(nueva)) throw new HttpError(mensaje);
  return nueva;
}
