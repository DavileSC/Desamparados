import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import topesVideo from '../../../shared/topes-video.json' with { type: 'json' };

export const publicStorageDir = path.join(process.cwd(), 'storage', 'public');
export const privateStorageDir = path.join(process.cwd(), 'storage', 'private');
/**
 * Donde caen las subidas públicas mientras se comprueban (tipo real, antivirus,
 * sharp). nginx sirve `storage/public` directamente del disco: si multer
 * escribiera allí, un fichero sin validar —o uno que el antivirus va a
 * rechazar— sería descargable durante esos segundos. Está dentro de `storage/`
 * para que pasarlo a la pública sea un `rename` en el mismo disco.
 */
export const carpetaDeSubidas = path.join(process.cwd(), 'storage', 'subiendo');

for (const directory of [publicStorageDir, privateStorageDir, carpetaDeSubidas]) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
}

// Tope por tipo real del archivo. Un boletín o un anuario en PDF pasa sin
// esfuerzo de 5 MB; una foto para la web no tiene por qué. Multer solo sabe
// poner un tope por petición, así que corta en el mayor (el del PDF) y el
// controlador aplica el de imagen cuando ya conoce el tipo real.
// Si se cambia MAX_BYTES_PDF, hay que subir también `client_max_body_size` en nginx.
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;
export const MAX_BYTES_PDF = 20 * 1024 * 1024;

function createStorage(directory: string) {
  return multer.diskStorage({
    destination: function (_req, _file, cb) {
      cb(null, directory);
    },
    filename: function (_req, file, cb) {
      const randomName = crypto.randomBytes(16).toString('hex');
      // En minúsculas: «FOTO.JPG» quedaría como `<hex>.JPG`, que no casa con el
      // filtro de rutas con el que se borran los ficheros que ya nadie usa
      // (utils/ficheros-publicos.ts) y se quedaría publicado para siempre.
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomName}${ext}`);
    }
  });
}

// Filtro de defensa en profundidad: mimetype declarado + extensión del nombre.
// El controlador vuelve a verificar los "magic numbers" del archivo real.
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

// Hay navegadores y sistemas que mandan un PDF sin tipo o como genérico
// (`application/octet-stream`): el CMS lo aceptaba por la extensión y aquí se
// rechazaba con un 400 que no decía por qué. Se deja pasar solo con extensión
// .pdf; el controlador comprueba después los bytes reales y la extensión.
const TIPOS_GENERICOS = ['application/octet-stream', ''];

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const pdfSinTipo = ext === '.pdf' && TIPOS_GENERICOS.includes(file.mimetype ?? '');

  if ((ALLOWED_MIMETYPES.includes(file.mimetype) || pdfSinTipo) && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    // Rechazamos el archivo pero no lanzamos error fatal, solo no lo sube
    cb(null, false);
  }
};

// Cada destino tiene su propio middleware para no depender de datos enviados
// por el cliente para decidir si un documento es público o privado.
export const publicUploadMiddleware = multer({
  storage: createStorage(carpetaDeSubidas),
  fileFilter,
  limits: { fileSize: MAX_BYTES_PDF }
});

export const privateUploadMiddleware = multer({
  storage: createStorage(privateStorageDir),
  fileFilter,
  limits: { fileSize: MAX_BYTES_PDF }
});

/**
 * Los vídeos, aparte: solo MP4, solo a la carpeta pública y con su propio tope
 * (el mayor de sus usos, el de la galería). El de cada uso, más bajo en el
 * hero, lo aplica el controlador. Si se sube este tope, hay que subir también
 * `client_max_body_size` de `/api/upload/` en nginx y `StreamMaxLength` de
 * ClamAV, o el vídeo se cortaría antes de analizarse.
 */
const MAX_BYTES_VIDEO = Math.max(topesVideo.hero.maxBytes, topesVideo.galeria.maxBytes);

const filtroDeVideo = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ext === '.mp4' && ['video/mp4', 'application/octet-stream', ''].includes(file.mimetype ?? ''));
};

export const videoUploadMiddleware = multer({
  storage: createStorage(carpetaDeSubidas),
  fileFilter: filtroDeVideo,
  limits: { fileSize: MAX_BYTES_VIDEO, files: 1 }
});

/**
 * Ficheros de datos que se leen y no se guardan (el extracto del banco, la
 * hoja del censo): a memoria y uno solo. Un censo de miles de fichas en Excel
 * ocupa unos cientos de KB; el tope queda holgado y por debajo de los 3 MB
 * que nginx deja pasar a `/api/`. Qué tipo es lo decide quien lo lee.
 */
const MAX_BYTES_DATOS = 900 * 1024;

export const ficheroDeDatosMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_DATOS, files: 1 }
});

/**
 * El texto de un fichero de datos: UTF-8 si lo es, y si no Latin-1, que es
 * como sale casi todo lo que exportan los bancos y Excel en España.
 */
export function textoDeFichero(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return buffer.toString('latin1');
  }
}
