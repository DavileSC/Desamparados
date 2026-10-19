/**
 * Las fotos que Secretaría pone en una plantilla, listas para ir dentro del
 * correo.
 *
 * Las subidas se guardan en WebP y Outlook de escritorio no lo pinta: cada
 * foto se pasa una vez a JPEG de 1024 px (el doble de lo que ocupa en la
 * carta, para las pantallas finas) y se deja en `storage/fotos-de-correo`.
 * Un boletín a trescientos hermanos con una foto la convierte una vez, no
 * trescientas. Esa carpeta no la sirve nginx: solo la lee el envío.
 *
 * Una foto que ya no está en el disco no se adjunta: el correo sale igual y
 * el lector enseña su descripción en el hueco.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { publicStorageDir } from '../../middleware/upload.middleware.js';
import { enFilaDeFotos } from '../../utils/fila-de-fotos.js';
import { carpetaFotosDeCorreo, jpegDeFoto } from '../../utils/ficheros-publicos.js';
import { FOTO_EN_CID, cidDeFoto } from './plantilla.js';

async function existe(ruta: string) {
  try {
    await fs.access(ruta);
    return true;
  } catch {
    return false;
  }
}

async function prepararJpeg(nombre: string): Promise<string | null> {
  const destino = jpegDeFoto(nombre);
  if (await existe(destino)) return destino;
  try {
    const original = await fs.readFile(path.join(publicStorageDir, nombre));
    const jpeg = await enFilaDeFotos(() => sharp(original).rotate().resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer());
    await fs.mkdir(carpetaFotosDeCorreo(), { recursive: true });
    // Primero a un temporal: dos envíos a la vez no pueden dejar un JPEG a medias.
    const temporal = `${destino}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporal, jpeg);
    await fs.rename(temporal, destino);
    return destino;
  } catch (e: any) {
    if (e?.code !== 'ENOENT') console.error(`La foto ${nombre} no se ha podido preparar para el correo.`, e);
    return null;
  }
}

/** Los adjuntos en línea de las fotos que lleva un correo ya compuesto. */
export async function fotosDe(html: string) {
  const nombres = new Set([...html.matchAll(FOTO_EN_CID)].map((m) => m[1]));
  const adjuntos = [];
  for (const nombre of nombres) {
    const ruta = await prepararJpeg(nombre);
    if (ruta) adjuntos.push({ path: ruta, cid: cidDeFoto(nombre), contentType: 'image/jpeg' });
  }
  return adjuntos;
}
