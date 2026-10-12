import fs from 'fs/promises';
import path from 'path';
import { publicStorageDir } from '../middleware/upload.middleware.js';
import { variantesDeFoto } from '../controllers/subida.controller.js';
import { ANCHOS_VARIANTES, nombreDeVariante } from '../domain/variantes-de-foto.js';

/** Una foto pública subida desde el CMS ya en WebP: 32 hex en la raíz de storage/public. */
const FOTO_WEBP = /^[a-f0-9]{32}\.webp$/i;

/**
 * Las fotos de la portada que pone la siembra (`portada/01-rostro.webp`):
 * son las primeras que ve cualquier visita y van a pantalla completa, así que
 * también llevan copias (`01-rostro-640.webp`). La web las reconoce por la
 * misma forma (ver `lib/fotoSubida.ts`). Las copias no cuentan como fotos. La
 * siembra la usa también para elegir qué fotos de la instalación toma.
 */
const CARPETA_PORTADA = 'portada';
export const FOTO_DE_PORTADA = /^\d{2}-[a-z0-9-]+(?<!-640|-1280)\.webp$/i;

/**
 * Una WebP sin pérdida lleva un trozo `VP8L` en la cabecera. Sus copias se
 * hacen también sin pérdida: suele ser un logo o un dibujo de colores planos,
 * y con pérdida se ensuciarían los bordes.
 */
const esSinPerdida = (webp: Buffer) => webp.subarray(0, 64).includes('VP8L');

interface ResultadoVariantes {
  /** Fotos a las que les faltaba alguna copia. */
  completadas: string[];
  /** Fotos que ya las tenían todas. */
  yaEstaban: number;
  /** Fotos que sharp no ha podido leer: se dejan como están. */
  fallidas: string[];
}

/**
 * Genera las copias reducidas (`<hex>-640.webp`, `<hex>-1280.webp`) que les
 * falten a las fotos de storage/public: las subidas antes de que la subida las
 * hiciera sola, o pasadas a WebP por `fotos:webp`, y las de la portada de la
 * siembra (en `portada/`). Idempotente: lo que ya
 * existe no se toca. Con `aplicar: false` solo cuenta.
 */
export async function completarVariantes(
  { directorio = publicStorageDir, aplicar = true }: { directorio?: string; aplicar?: boolean } = {},
): Promise<ResultadoVariantes> {
  const resultado: ResultadoVariantes = { completadas: [], yaEstaban: 0, fallidas: [] };
  await completarCarpeta(directorio, FOTO_WEBP, '', aplicar, resultado);
  const portada = path.join(directorio, CARPETA_PORTADA);
  if (await fs.stat(portada).then((s) => s.isDirectory(), () => false)) {
    await completarCarpeta(portada, FOTO_DE_PORTADA, `${CARPETA_PORTADA}/`, aplicar, resultado);
  }
  return resultado;
}

/** Las copias que falten en una carpeta, de las fotos cuyo nombre case con `esFoto`. */
async function completarCarpeta(directorio: string, esFoto: RegExp, prefijo: string, aplicar: boolean, resultado: ResultadoVariantes) {
  const entradas = await fs.readdir(directorio, { withFileTypes: true });
  const existentes = new Set(entradas.filter((e) => e.isFile()).map((e) => e.name));

  for (const entrada of entradas) {
    if (!entrada.isFile() || !esFoto.test(entrada.name)) continue;
    const faltan = ANCHOS_VARIANTES.filter((ancho) => !existentes.has(nombreDeVariante(entrada.name, ancho)));
    if (faltan.length === 0) {
      resultado.yaEstaban++;
      continue;
    }
    if (!aplicar) {
      resultado.completadas.push(prefijo + entrada.name);
      continue;
    }
    try {
      const foto = await fs.readFile(path.join(directorio, entrada.name));
      const variantes = await variantesDeFoto(foto, { sinPerdida: esSinPerdida(foto) });
      for (const { ancho, datos } of variantes) {
        if (!(faltan as readonly number[]).includes(ancho)) continue;
        // Al lado con otro nombre y renombrada: nginx nunca sirve una a medias.
        const destino = path.join(directorio, nombreDeVariante(entrada.name, ancho));
        const temporal = path.join(directorio, `.${path.basename(destino)}.tmp`);
        await fs.writeFile(temporal, datos);
        await fs.rename(temporal, destino);
      }
      resultado.completadas.push(prefijo + entrada.name);
    } catch (error) {
      console.warn(`  ! ${prefijo}${entrada.name}: no se ha podido leer (${error instanceof Error ? error.message : error})`);
      resultado.fallidas.push(prefijo + entrada.name);
    }
  }
}
