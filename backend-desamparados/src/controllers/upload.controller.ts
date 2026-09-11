import { Request, Response } from 'express';
import { handleHttp } from '../utils/error.handle.js';
import { fileTypeFromFile } from 'file-type';
import path from 'path';
import fs from 'fs/promises';
import sharp, { type Sharp } from 'sharp';
import { scanBufferClamav } from '../utils/clamd.js';
import { MAX_BYTES_IMAGEN, privateStorageDir } from '../middleware/upload.middleware.js';

/** Una forma de codificar la foto ya leída (orientada y sin metadatos). */
type Codificacion = (imagen: Sharp) => Sharp;

/**
 * Vuelve a codificar una foto sin sus metadatos. Una foto del móvil lleva en el
 * EXIF las coordenadas GPS de donde se hizo (la casa de un hermano, el colegio
 * de un menor) y se publicaba tal cual en /storage/public.
 *
 * Los metadatos se quitan SIEMPRE, aunque el resultado pese algo más que el
 * original: la privacidad no se negocia por unos KB. Lo que se cuida es no
 * estropear ni engordar la foto sin necesidad:
 *  - `rotate()` sin argumentos aplica a los píxeles la orientación del EXIF; al
 *    quitar los metadatos se perdería y la foto hecha en vertical saldría tumbada.
 *  - `animated: true`: una WebP animada conserva todos sus fotogramas (sin él
 *    se quedaba en el primero).
 *  - PNG de paleta sale con paleta (sin ella crecía unas seis veces) y el de 16
 *    bits por canal sigue en 16 (se reducía a 8).
 *  - JPEG a calidad 85 con mozjpeg (a 90, uno de calidad 70 salía un tercio más
 *    pesado).
 *  - Si la primera codificación pesa más que el original, se prueba otra más
 *    ajustada y se queda la más ligera. El tope de 5 MB lo vuelve a comprobar
 *    el controlador sobre el resultado.
 *
 * Se conserva el formato para no romper la extensión del nombre. Exportado para
 * probarlo sin pasar por HTTP.
 */
export async function recodificarSinMetadatos(original: Buffer, mime: string): Promise<Buffer> {
  // 'error' y no el 'warning' por defecto: una foto con un aviso menor de
  // libvips se puede publicar; una que no se puede decodificar, no.
  const leer = () => sharp(original, { failOn: 'error', animated: true }).rotate();
  const datos = await sharp(original, { failOn: 'error', animated: true }).metadata();

  let codificaciones: Codificacion[];
  switch (mime) {
    case 'image/jpeg':
      codificaciones = [
        (imagen) => imagen.jpeg({ quality: 85, mozjpeg: true }),
        (imagen) => imagen.jpeg({ quality: 75, mozjpeg: true }),
      ];
      break;
    case 'image/png': {
      if (datos.isPalette) {
        codificaciones = [(imagen) => imagen.png({ palette: true, compressionLevel: 9 })];
        break;
      }
      const profundidad: Codificacion = datos.depth === 'ushort'
        ? (imagen) => imagen.toColourspace(datos.space === 'grey16' ? 'grey16' : 'rgb16')
        : (imagen) => imagen;
      codificaciones = [
        (imagen) => profundidad(imagen).png(),
        (imagen) => profundidad(imagen).png({ compressionLevel: 9, adaptiveFiltering: true }),
      ];
      break;
    }
    case 'image/webp':
      codificaciones = [
        (imagen) => imagen.webp({ quality: 85 }),
        (imagen) => imagen.webp({ quality: 75 }),
      ];
      break;
    default:
      throw new Error(`Tipo de imagen no admitido para recodificar: ${mime}`);
  }

  let mejor: Buffer | null = null;
  for (const codificar of codificaciones) {
    const salida = await codificar(leer()).toBuffer();
    if (!mejor || salida.length < mejor.length) mejor = salida;
    if (salida.length <= original.length) break;
  }
  return mejor!;
}

export class UploadController {

  static async uploadFile(req: Request, res: Response) {
    try {
      const { file } = req;

      // Validación doble: Multer puede rechazar por tipo o tamaño antes de llegar aquí
      if (!file) {
        return res.status(400).json({
            error: 'No has subido ningún archivo o el formato no es válido (fotos JPG, PNG o WebP de hasta 5 MB, o PDF de hasta 20 MB).'
        });
      }

      // ================== VALIDACIÓN DE SEGURIDAD POST-SUBIDA ==================
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      const filePath = file.path;

      // 1. Verificamos el tipo real del archivo leyendo sus "magic numbers"
      const fileTypeResult = await fileTypeFromFile(filePath);

      // 2. Si el tipo no es reconocido o no está en nuestra lista, lo borramos y rechazamos.
      if (!fileTypeResult || !allowedMimeTypes.includes(fileTypeResult.mime)) {
        await fs.unlink(filePath); // Borramos el archivo malicioso/inválido
        return res.status(400).json({
            error: 'El tipo de archivo real no es válido. Solo se permiten imágenes (jpg, png, webp) y PDF.'
        });
      }

      // 2b. ANTI-SPOOFING: la extensión guardada debe corresponderse con el tipo REAL
      // detectado por magic numbers. Un JPEG renombrado a ".html" muere aquí:
      // nunca se servirá HTML desde nuestro dominio.
      const extOk: Record<string, string[]> = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/webp': ['.webp'],
        'application/pdf': ['.pdf']
      };
      const realExt = path.extname(file.filename).toLowerCase();
      if (!extOk[fileTypeResult.mime].includes(realExt)) {
        await fs.unlink(filePath);
        return res.status(400).json({
            error: 'La extensión del archivo no coincide con su contenido real.'
        });
      }

      // 2c. Multer corta en el tope del PDF (el mayor); el de las fotos se aplica
      // aquí, ya con el tipo real en la mano y no el que declara el navegador.
      const esImagen = fileTypeResult.mime !== 'application/pdf';
      if (esImagen && file.size > MAX_BYTES_IMAGEN) {
        await fs.unlink(filePath);
        return res.status(413).json({
            error: 'La foto pesa más de 5 MB. Redúcela antes de subirla.'
        });
      }

      // 3. Advertimos si el mimetype del header no coincide con el real (señal de spoofing)
      if (file.mimetype !== fileTypeResult.mime) {
        console.warn(`[Security] Mismatch de Mime-Type detectado para ${file.originalname}. Header: ${file.mimetype}, Real: ${fileTypeResult.mime}`);
      }

      // ================== ANTIVIRUS OPCIONAL (ClamAV) ==================
      // Se analiza lo que ha subido el usuario, antes de que libvips lo decodifique.
      // El comportamiento según el entorno está descrito en utils/clamd.ts.
      const original = await fs.readFile(filePath);
      const avResult = await scanBufferClamav(original);
      if (avResult.veredicto === 'infectado') {
        await fs.unlink(filePath);
        console.error(`[Security] Archivo RECHAZADO por el antivirus: ${file.originalname} (${avResult.reason})`);
        return res.status(400).json({
            error: 'El archivo ha sido rechazado por el análisis antivirus.'
        });
      }
      if (avResult.veredicto === 'no-disponible') {
        // No es culpa del archivo: decirle al usuario que tiene un virus le haría
        // desconfiar de un documento sano. Se rechaza igual (fail-closed).
        await fs.unlink(filePath);
        console.error(`[Security] Subida rechazada: el antivirus no está disponible (${avResult.reason})`);
        return res.status(503).json({
            error: 'El análisis antivirus no está disponible, inténtalo más tarde.'
        });
      }

      // ================== FOTOS SIN METADATOS ==================
      // Los PDF se guardan byte a byte: recodificarlos cambiaría el documento.
      let size = file.size;
      if (esImagen) {
        let limpia: Buffer;
        try {
          limpia = await recodificarSinMetadatos(original, fileTypeResult.mime);
        } catch (error) {
          await fs.unlink(filePath);
          console.warn(`[Upload] No se ha podido recodificar ${file.originalname}:`, error instanceof Error ? error.message : error);
          return res.status(400).json({
              error: 'No se ha podido procesar la foto. Comprueba que no está dañada y vuelve a subirla.'
          });
        }
        // Una foto de casi 5 MB que al recodificarla pasa del tope no se sirve:
        // el tope es por lo que se publica, no por lo que se sube.
        if (limpia.length > MAX_BYTES_IMAGEN) {
          await fs.unlink(filePath);
          return res.status(413).json({
              error: 'La foto, una vez preparada para la web, pasa de 5 MB. Redúcela antes de subirla.'
          });
        }
        await fs.writeFile(filePath, limpia);
        size = limpia.length;
      }

      // Generamos la URL pública usando una fuente confiable (Variable de entorno).
      // Evitamos usar req.get('host') para prevenir ataques de Host Header Injection.
      // Fallback a localhost para entornos de desarrollo locales.
      const baseUrl = process.env.API_URL || 'http://localhost:3001';

      // Construimos la URL que guardaremos en la DB
      const isPrivate = req.path.startsWith('/private');
      const fileUrl = isPrivate
        ? `${baseUrl}/api/upload/private/${encodeURIComponent(file.filename)}`
        : `${baseUrl}/storage/public/${encodeURIComponent(file.filename)}`;

      res.status(201).json({
        message: 'Archivo subido correctamente',
        data: {
            url: fileUrl,
            filename: file.filename,
            type: fileTypeResult.mime,
            size: `${(size / 1024).toFixed(2)} KB`
        }
      });

    } catch (e) {
      // Un fallo a mitad no debe dejar publicado un archivo que no ha pasado
      // todas las comprobaciones.
      if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
      handleHttp(res, e, 'Error subiendo archivo');
    }
  }

  static async downloadPrivate(req: Request, res: Response) {
    const filename = req.params.filename as string;
    // El middleware de ruta limita el nombre a un identificador generado por Multer.
    res.sendFile(filename, { root: privateStorageDir, dotfiles: 'deny' }, (error) => {
      if (error && !res.headersSent) handleHttp(res, error, 'Documento privado no encontrado', 404);
    });
  }
}
