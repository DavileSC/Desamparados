/**
 * Genera las copias reducidas (640 y 1280 px de ancho) de las fotos públicas
 * que no las tengan: las subidas antes de que la subida las hiciera sola. La
 * web las pide en `srcset` sin preguntar si existen (ver
 * `src/domain/variantes-de-foto.ts`), así que hay que lanzarlo una vez al
 * desplegar este cambio, y otra después de `npm run fotos:webp`.
 *
 *   npm run imagenes:variantes               → las genera
 *   npm run imagenes:variantes -- --comprobar → solo cuenta las que faltan
 *
 * Idempotente: lo que ya existe no se toca. Se ejecuta desde la carpeta del
 * backend (como el servidor): storage/ se resuelve contra el directorio actual.
 * Una foto cada vez y con un solo hilo, como la subida.
 */
import 'dotenv/config';
import { publicStorageDir } from '../src/middleware/upload.middleware.js';
import { completarVariantes } from '../src/utils/variantes-publicas.js';

const aplicar = !process.argv.includes('--comprobar');

try {
  console.log(`Carpeta: ${publicStorageDir}`);
  if (!aplicar) console.log('MODO DE PRUEBA: no se escribe nada.');
  const { completadas, yaEstaban, fallidas } = await completarVariantes({ aplicar });
  console.log(`Fotos que ya tenían sus copias: ${yaEstaban}`);
  console.log(`${aplicar ? 'Completadas' : 'Les falta alguna copia'}: ${completadas.length}`);
  if (fallidas.length) {
    console.log(`No se han podido leer (${fallidas.length}); la web las pedirá y les faltará la copia:`);
    for (const nombre of fallidas) console.log(`  · ${nombre}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error('No se han podido generar las copias:', error);
  process.exitCode = 1;
}
