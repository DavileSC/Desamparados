import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Aseguramos que la carpeta exista, si no, la crea
const storageDir = path.join(process.cwd(), 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Guardamos en la carpeta /storage de la raíz del proyecto
    cb(null, storageDir);
  },
  filename: function (req, file, cb) {
    // Generamos un nombre de archivo único y seguro usando crypto
    const randomName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${randomName}${ext}`);
  }
});

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

export const uploadMiddleware = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB por archivo
});