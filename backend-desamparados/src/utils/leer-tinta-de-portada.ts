import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { publicStorageDir } from '../middleware/upload.middleware.js';
import { ALTO_MUESTRA, ANCHO_MUESTRA, tintaDePortada, type TintaDePortada } from '../domain/tinta-de-portada.js';

// Solo lo que sube el CMS, con o sin subcarpeta; los segmentos no admiten
// puntos, así que nada de esto sale de storage/public. Las de `/images/` las
// sirve nginx desde la instalación y la API no las tiene a mano: para ellas,
// la tapa usa la letra de siempre.
const RUTA = /^\/storage\/public\/((?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpe?g|png|webp))$/i;

/**
 * Lee la portada subida y calcula su letra (`domain/tinta-de-portada`). Null
 * si no hay foto, no es nuestra o sharp no puede abrirla: la web cae entonces
 * en letra clara con velo, que se lee sobre casi todo.
 */
export async function leerTintaDePortada(imagenUrl: string | null | undefined): Promise<TintaDePortada | null> {
  const ruta = imagenUrl ? RUTA.exec(imagenUrl) : null;
  if (!ruta) return null;
  try {
    // Leída entera antes: con la ruta, sharp deja el fichero abierto en su
    // caché y en Windows la limpieza de huérfanas no puede borrarlo (EBUSY).
    const foto = await fs.readFile(path.join(publicStorageDir, ruta[1]));
    const crudo = await sharp(foto)
      // Recorte igual que `object-fit: cover` en la tapa 3:4; lo transparente,
      // sobre el fondo oscuro de la tapa, que es lo que se ve detrás.
      .resize(ANCHO_MUESTRA, ALTO_MUESTRA, { fit: 'cover' })
      .flatten({ background: '#0c0b0d' })
      .removeAlpha()
      .raw()
      .toBuffer();
    return tintaDePortada(crudo);
  } catch {
    return null;
  }
}
