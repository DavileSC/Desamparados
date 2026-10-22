import { Request, Response } from 'express';
import { handleHttp } from '../utils/error.handle.js';
import { fileTypeFromFile } from 'file-type';
import path from 'path';
import fs from 'fs/promises';
import sharp, { type Sharp } from 'sharp';
import { scanBufferClamav } from '../utils/clamd.js';
import { MAX_BYTES_IMAGEN, privateStorageDir, publicStorageDir } from '../middleware/upload.middleware.js';
import { esUsoDeVideo, leerMp4, problemaDelVideo, topesDeVideo } from '../domain/mp4.js';
import { enFilaDeFotos } from '../utils/fila-de-fotos.js';
import { ANCHOS_VARIANTES, nombreDeVariante } from '../domain/variantes-de-foto.js';

/** Una forma de codificar la foto ya leída (orientada y sin metadatos). */
type Codificacion = (imagen: Sharp) => Sharp;

// El servidor es un VPS pequeño: una foto se procesa con un solo hilo y
// libvips no guarda nada en caché entre una y otra. Tarda algo más, pero no
// se come la CPU ni la memoria de todo lo demás mientras alguien sube una
// galería. Que haya una sola foto a la vez lo pone `enFilaDeFotos`.
sharp.concurrency(1);
sharp.cache(false);

/**
 * El lado mayor que se guarda de una foto, en píxeles.
 *
 * Antes no había ninguno: una foto de móvil entraba con sus 4000 px de ancho y
 * se servía así a todo el mundo, móviles incluidos. Se recomprimía —eso sí se
 * hacía— pero seguía pesando megas y se pintaba a menos de la mitad de su
 * tamaño. Doce fotos de una galería podían ser decenas de MB por visita.
 *
 * 1920 es el ancho de la foto más grande que la web sirve de serie
 * (`hero-1920.webp`); no hay ningún sitio donde se pinte nada mayor.
 */
export const LADO_MAXIMO = 1920;

/** Calidad de las fotos en WebP: con las del Grupo, se ve como el JPEG a 85 y pesa un 23 % menos. */
const CALIDAD_WEBP = 82;

/**
 * Prepara una foto para publicarla: siempre en WebP, sin metadatos y sin
 * pasar de `LADO_MAXIMO`. Entra JPEG, PNG o WebP y sale WebP, así que quien
 * la guarda tiene que ponerle la extensión `.webp` (`conExtensionWebp`).
 *
 * Por qué WebP y no AVIF: pesa algo más (un 29 % con las fotos del Grupo),
 * pero codifica cinco veces más deprisa en un servidor modesto y lo ve
 * cualquier móvil, también los iPhone anteriores a iOS 16.4.
 *
 * Los metadatos se quitan SIEMPRE: una foto del móvil lleva en el EXIF las
 * coordenadas GPS de donde se hizo (la casa de un hermano, el colegio de un
 * menor). Además:
 *  - `rotate()` sin argumentos aplica a los píxeles la orientación del EXIF; al
 *    quitar los metadatos se perdería y la foto hecha en vertical saldría tumbada.
 *  - `animated: true`: una WebP animada conserva todos sus fotogramas.
 *  - Un PNG de paleta (un logo, un dibujo de colores planos) sale sin pérdida:
 *    con pérdida se ensuciarían los bordes y apenas pesaría menos.
 *  - `smartSubsample`: los bordes entre colores fuertes (el granate sobre
 *    blanco) no se emborronan.
 *  - Si la primera codificación pesa más que el original, se prueba otra más
 *    ajustada y se queda la más ligera. El tope de 5 MB lo vuelve a comprobar
 *    quien llama sobre el resultado.
 *
 * Exportado para probarlo sin pasar por HTTP y para el script que pasa a WebP
 * las fotos subidas antes (`scripts/fotos-a-webp.ts`).
 */
export function prepararFoto(original: Buffer, opciones: OpcionesDeFoto = {}): Promise<Buffer> {
  return enFilaDeFotos(async () => (await convertirFoto(original, opciones)).foto);
}

/**
 * Para las fotos que sube cualquiera sin sesión (el alta): un tope de píxeles
 * propio y sin animación. Un PNG de 5 MB puede decir medir 16 000 × 16 000
 * (se comprime casi a nada si es liso), y decodificarlo, y codificarlo dos
 * veces, ocupaba la única fila de fotos del servidor (auditoría del
 * 22-10-2026, AUD-006). 40 megapíxeles sobran para una foto de carné o un
 * certificado fotografiado; el tope de serie de sharp son 268.
 */
export const FOTO_SIN_SESION: OpcionesDeFoto = { maxPixeles: 40_000_000, sinAnimacion: true };

export interface OpcionesDeFoto {
  /** Píxeles como mucho (ancho × alto, de todos los fotogramas): más, y se rechaza sin decodificarla. */
  maxPixeles?: number;
  /** Solo el primer fotograma de una animación. */
  sinAnimacion?: boolean;
}

/** La foto mide más de lo que se admite: el mensaje lo pone quien la recibe. */
export class FotoDemasiadoGrande extends Error {}

interface FotoConVariantes {
  foto: Buffer;
  variantes: { ancho: number; datos: Buffer }[];
}

/**
 * Como `prepararFoto`, pero además saca las copias de `ANCHOS_VARIANTES`. Todo
 * en el mismo turno de la fila: las copias se hacen con la foto aún leída.
 */
function prepararFotoConVariantes(original: Buffer): Promise<FotoConVariantes> {
  return enFilaDeFotos(async () => {
    const { foto, sinPerdida } = await convertirFoto(original);
    return { foto, variantes: await reducir(foto, sinPerdida) };
  });
}

/**
 * Las copias reducidas de una foto ya preparada (WebP, sin metadatos). Para el
 * script que las genera para las fotos subidas antes (`scripts/variantes-de-imagenes.ts`).
 */
export function variantesDeFoto(foto: Buffer, { sinPerdida = false } = {}) {
  return enFilaDeFotos(() => reducir(foto, sinPerdida));
}

async function reducir(foto: Buffer, sinPerdida: boolean): Promise<FotoConVariantes['variantes']> {
  const datos = await sharp(foto, { animated: true }).metadata();
  // Una animación se copia tal cual, por lo mismo que no se le pone tope.
  const animada = (datos.pages ?? 1) > 1;
  const variantes: FotoConVariantes['variantes'] = [];
  for (const ancho of ANCHOS_VARIANTES) {
    if (animada || (datos.width ?? 0) <= ancho) {
      variantes.push({ ancho, datos: foto });
      continue;
    }
    const reducida = sharp(foto).resize({ width: ancho, withoutEnlargement: true });
    variantes.push({
      ancho,
      datos: await (sinPerdida
        ? reducida.webp({ lossless: true })
        : reducida.webp({ quality: CALIDAD_WEBP, smartSubsample: true })).toBuffer(),
    });
  }
  return variantes;
}

async function convertirFoto(original: Buffer, { maxPixeles, sinAnimacion = false }: OpcionesDeFoto = {}): Promise<{ foto: Buffer; sinPerdida: boolean }> {
  // 'error' y no el 'warning' por defecto: una foto con un aviso menor de
  // libvips se puede publicar; una que no se puede decodificar, no.
  const opciones = { failOn: 'error' as const, animated: !sinAnimacion, ...(maxPixeles ? { limitInputPixels: maxPixeles } : {}) };
  // Leer la cabecera no decodifica nada: el tamaño se mira antes de gastar en ella.
  const datos = await sharp(original, { failOn: 'error', animated: !sinAnimacion }).metadata();
  if (!['jpeg', 'png', 'webp'].includes(datos.format ?? '')) {
    throw new Error(`Tipo de imagen no admitido: ${datos.format}`);
  }
  if (maxPixeles && (datos.width ?? 0) * (datos.height ?? 0) > maxPixeles) {
    throw new FotoDemasiadoGrande(`La foto mide ${datos.width} × ${datos.height}.`);
  }

  // Una animación se deja del tamaño que venga: al resolverla, el alto que ve
  // sharp es el de todos los fotogramas apilados, y un tope de alto la
  // encogería sin motivo. Son raras y pequeñas.
  const animada = !sinAnimacion && (datos.pages ?? 1) > 1;

  const leer = () => {
    const imagen = sharp(original, opciones).rotate();
    return animada
      ? imagen
      // `withoutEnlargement`: si ya es más pequeña, se deja como está. Nunca se
      // agranda una foto, que solo la emborronaría y la engordaría.
      : imagen.resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true });
  };

  const codificaciones: Codificacion[] = datos.isPalette
    ? [(imagen) => imagen.webp({ lossless: true })]
    : [
        (imagen) => imagen.webp({ quality: CALIDAD_WEBP, smartSubsample: true }),
        (imagen) => imagen.webp({ quality: 72, smartSubsample: true }),
      ];

  let mejor: Buffer | null = null;
  for (const codificar of codificaciones) {
    const salida = await codificar(leer()).toBuffer();
    if (!mejor || salida.length < mejor.length) mejor = salida;
    if (salida.length <= original.length) break;
  }
  return { foto: mejor!, sinPerdida: Boolean(datos.isPalette) };
}

/** El nombre del fichero con la extensión `.webp` en lugar de la que traía (`<hex>.jpg` → `<hex>.webp`). */
export const conExtensionWebp = (nombre: string) => `${path.basename(nombre, path.extname(nombre))}.webp`;

/**
 * Deja un fichero ya comprobado en su carpeta definitiva. Se escribe al lado
 * con otro nombre y se renombra: nginx sirve `storage/public` directamente, y
 * así nunca ve un fichero escrito a medias.
 */
async function publicar(datos: Buffer, nombre: string, carpeta: string) {
  const temporal = path.join(carpeta, `.${nombre}.tmp`);
  await fs.writeFile(temporal, datos);
  await fs.rename(temporal, path.join(carpeta, nombre));
}

export class SubidaController {

  static async subirArchivo(req: Request, res: Response) {
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

      // ================== FOTOS EN WEBP, SIN METADATOS ==================
      // Los PDF se guardan byte a byte: recodificarlos cambiaría el documento.
      const isPrivate = req.path.startsWith('/private');
      const destino = isPrivate ? privateStorageDir : publicStorageDir;
      let size = file.size;
      let filename = file.filename;
      let tipo = fileTypeResult.mime;
      if (esImagen) {
        let limpia: Buffer;
        let variantes: FotoConVariantes['variantes'] = [];
        try {
          // Las copias reducidas solo hacen falta en la web pública; la foto de
          // un documento privado se abre de una en una desde el CMS.
          if (isPrivate) limpia = await prepararFoto(original);
          else ({ foto: limpia, variantes } = await prepararFotoConVariantes(original));
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
        // Sale siempre en WebP: se guarda con su extensión y el original se va.
        // Las copias, antes que la principal: si algo se corta a medias, nunca
        // queda publicada una foto cuyas copias falten.
        filename = conExtensionWebp(file.filename);
        for (const { ancho, datos } of variantes) {
          await publicar(datos, nombreDeVariante(filename, ancho), destino);
        }
        await publicar(limpia, filename, destino);
        // En la privada, una WebP subida ya se llama igual que la definitiva.
        if (path.join(destino, filename) !== filePath) await fs.unlink(filePath);
        size = limpia.length;
        tipo = 'image/webp';
      } else {
        await fs.rename(filePath, path.join(destino, filename));
      }

      // Generamos la URL pública usando una fuente confiable (Variable de entorno).
      // Evitamos usar req.get('host') para prevenir ataques de Host Header Injection.
      // Fallback a localhost para entornos de desarrollo locales.
      const baseUrl = process.env.API_URL || 'http://localhost:3001';

      // Construimos la URL que guardaremos en la DB
      const fileUrl = isPrivate
        ? `${baseUrl}/api/upload/private/${encodeURIComponent(filename)}`
        : `${baseUrl}/storage/public/${encodeURIComponent(filename)}`;

      res.status(201).json({
        message: 'Archivo subido correctamente',
        data: {
            url: fileUrl,
            filename,
            type: tipo,
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

  /**
   * POST /api/upload/video/:uso — un MP4 para el hero o para una galería.
   *
   * El servidor NO recomprime el vídeo, a diferencia de las fotos: en este VPS
   * eso costaría minutos de CPU al 100 % por vídeo. Tiene que llegar ya listo
   * para la web y aquí solo se comprueba que lo está (formato, códec, peso,
   * duración y tamaño de imagen, leídos de sus cabeceras) y que el antivirus
   * lo da por bueno. El CMS avisa de todo esto antes de enviar; esto es lo que
   * manda.
   */
  static async subirVideo(req: Request, res: Response) {
    const { file } = req;
    const rechazar = async (estado: number, error: string) => {
      if (file) await fs.unlink(file.path).catch(() => {});
      return res.status(estado).json({ error });
    };
    try {
      const uso = req.params.uso;
      if (!esUsoDeVideo(uso)) return rechazar(404, 'No existe ese destino de vídeo.');
      if (!file) return rechazar(400, 'No has subido ningún vídeo o no es un MP4.');

      // El contenido real, no la extensión ni lo que dice el navegador. Un
      // .mov renombrado a .mp4 (el formato de los iPhone) muere aquí.
      const tipoReal = await fileTypeFromFile(file.path);
      if (tipoReal?.mime !== 'video/mp4' || path.extname(file.filename).toLowerCase() !== '.mp4') {
        return rechazar(400, 'El archivo no es un MP4. Pásalo por HandBrake (gratuito) con el formato MP4 y el códec H.264.');
      }

      const { maxBytes } = topesDeVideo(uso);
      if (file.size > maxBytes) {
        const megas = Math.round(maxBytes / 1024 / 1024);
        return rechazar(413, `El vídeo pesa más de ${megas} MB, el máximo aquí. Recórtalo o comprímelo más antes de subirlo.`);
      }

      const datos = await fs.readFile(file.path);
      const problema = problemaDelVideo(leerMp4(datos), uso);
      if (problema) return rechazar(400, problema);

      const antivirus = await scanBufferClamav(datos);
      if (antivirus.veredicto === 'infectado') {
        console.error(`[Security] Vídeo RECHAZADO por el antivirus: ${file.originalname} (${antivirus.reason})`);
        return rechazar(400, 'El archivo ha sido rechazado por el análisis antivirus.');
      }
      if (antivirus.veredicto === 'no-disponible') {
        console.error(`[Security] Subida de vídeo rechazada: el antivirus no está disponible (${antivirus.reason})`);
        return rechazar(503, 'El análisis antivirus no está disponible, inténtalo más tarde.');
      }

      // Solo ahora, con todo comprobado, pasa a la carpeta que sirve nginx.
      await fs.rename(file.path, path.join(publicStorageDir, file.filename));

      res.status(201).json({
        message: 'Vídeo subido correctamente',
        data: { filename: file.filename, type: 'video/mp4', size: `${(file.size / 1024).toFixed(2)} KB` },
      });
    } catch (e) {
      if (file?.path) await fs.unlink(file.path).catch(() => {});
      handleHttp(res, e, 'Error subiendo el vídeo');
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
