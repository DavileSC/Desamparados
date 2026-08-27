import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const publicStorageDir = path.join(process.cwd(), 'storage', 'public');
export const privateStorageDir = path.join(process.cwd(), 'storage', 'private');

for (const directory of [publicStorageDir, privateStorageDir]) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
}

function createStorage(directory: string) {
  return multer.diskStorage({
    destination: function (_req, _file, cb) {
      cb(null, directory);
    },
    filename: function (_req, file, cb) {
      const randomName = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname);
      cb(null, `${randomName}${ext}`);
    }
  });
}

// Filtro de defensa en profundidad: mimetype declarado + extensión del nombre.
// El controlador vuelve a verificar los "magic numbers" del archivo real.
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ALLOWED_MIMETYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
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
  limits: { fileSize: 5 * 1024 * 1024 }
});

export const privateUploadMiddleware = multer({
  storage: createStorage(privateStorageDir),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});
