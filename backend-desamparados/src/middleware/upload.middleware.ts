import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const publicStorageDir = path.join(process.cwd(), 'storage', 'public');
export const privateStorageDir = path.join(process.cwd(), 'storage', 'private');

for (const directory of [publicStorageDir, privateStorageDir]) {
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
  storage: createStorage(publicStorageDir),
  fileFilter,
  limits: { fileSize: MAX_BYTES_PDF }
});

export const privateUploadMiddleware = multer({
  storage: createStorage(privateStorageDir),
  fileFilter,
  limits: { fileSize: MAX_BYTES_PDF }
});
