import fs from 'fs/promises';
import path from 'path';
import { privateStorageDir } from '../middleware/upload.middleware.js';

/** El nombre que pone la subida: 32 hex y la extensión. Cualquier otra cosa no se toca. */
const NOMBRE_DE_SUBIDA = /^[a-f0-9]{32}\.(jpg|jpeg|png|pdf|doc|docx)$/i;

/**
 * Borra de storage/private los documentos del alta (foto y certificado de
 * bautismo) de fichas que ya no existen o se han suprimido. Se llama después de
 * confirmar la transacción: si esta fallara, la ficha seguiría apuntando a un
 * fichero borrado. Un fallo al borrar se registra y no tumba la operación.
 */
export async function borrarDocumentosPrivados(nombres: (string | null | undefined)[]) {
  for (const nombre of nombres) {
    if (!nombre || !NOMBRE_DE_SUBIDA.test(nombre)) continue;
    await fs.unlink(path.join(privateStorageDir, nombre)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') console.error(`[Documentos] No se ha podido borrar ${nombre}:`, error.message);
    });
  }
}

/** Los dos documentos de cada ficha, en una lista, para `borrarDocumentosPrivados`. */
export const documentosDe = (fichas: { foto: string | null; certificadoBautismo: string | null }[]) =>
  fichas.flatMap((f) => [f.foto, f.certificadoBautismo]);
