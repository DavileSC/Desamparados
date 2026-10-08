import fs from 'fs/promises';
import path from 'path';
import db from '../config/db.js';
import { privateStorageDir } from '../middleware/upload.middleware.js';

/**
 * El nombre que pone la subida: 32 hex y la extensión. Cualquier otra cosa no
 * se toca. Con webp: la foto del alta se guarda así, y sin él la foto de una
 * solicitud rechazada o de una cuenta suprimida se quedaba en el disco para
 * siempre.
 */
const NOMBRE_DE_SUBIDA = /^[a-f0-9]{32}\.(jpg|jpeg|png|webp|pdf|doc|docx)$/i;

export const esNombreDeDocumentoPrivado = (nombre: string) => NOMBRE_DE_SUBIDA.test(nombre);

/**
 * Borra de storage/private los documentos del alta (foto y certificado de
 * bautismo) de fichas que ya no existen o se han suprimido. Se llama después de
 * confirmar la transacción: si esta fallara, la ficha seguiría apuntando a un
 * fichero borrado. Un fallo al borrar se registra y no tumba la operación.
 */
export async function borrarDocumentosPrivados(nombres: (string | null | undefined)[], directorio = privateStorageDir) {
  let borrados = 0;
  for (const nombre of nombres) {
    if (!nombre || !NOMBRE_DE_SUBIDA.test(nombre)) continue;
    await fs.unlink(path.join(directorio, nombre)).then(
      () => { borrados += 1; },
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') console.error(`[Documentos] No se ha podido borrar ${nombre}:`, error.message);
      },
    );
  }
  return borrados;
}

/** Los dos documentos de cada ficha, en una lista, para `borrarDocumentosPrivados`. */
export const documentosDe = (fichas: { foto: string | null; certificadoBautismo: string | null }[]) =>
  fichas.flatMap((f) => [f.foto, f.certificadoBautismo]);

/**
 * Los documentos privados que alguna ficha sigue mencionando. Solo la ficha
 * del censo guarda nombres de storage/private (`foto` y
 * `certificadoBautismo`, puestos por el alta): si algún día otra tabla guarda
 * uno, tiene que sumarse aquí o la limpieza lo daría por huérfano.
 */
export async function documentosPrivadosReferenciados(): Promise<Set<string>> {
  const fichas = await db.hermano.findMany({
    where: { OR: [{ foto: { not: null } }, { certificadoBautismo: { not: null } }] },
    select: { foto: true, certificadoBautismo: true },
  });
  return new Set(documentosDe(fichas).filter((n): n is string => Boolean(n)).map((n) => n.toLowerCase()));
}

export interface DocumentoHuerfano { nombre: string; bytes: number; modificado: Date }

/**
 * Los documentos de storage/private que no menciona ninguna ficha. Como en
 * storage/public, solo el nombre exacto de una subida y nada reciente: el
 * alta guarda los ficheros antes de crear la ficha, y un alta a medio
 * procesar no puede perder su foto.
 */
export async function buscarDocumentosHuerfanos({
  referenciados,
  directorio = privateStorageDir,
  minHoras = 24,
  ahora = new Date(),
}: { referenciados: Set<string>; directorio?: string; minHoras?: number; ahora?: Date }): Promise<{ huerfanos: DocumentoHuerfano[]; ignorados: string[] }> {
  const enUso = new Set([...referenciados].map((n) => n.toLowerCase()));
  const entradas = await fs.readdir(directorio, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const huerfanos: DocumentoHuerfano[] = [];
  const ignorados: string[] = [];
  for (const entrada of entradas) {
    if (!entrada.isFile()) continue;
    if (!NOMBRE_DE_SUBIDA.test(entrada.name)) {
      ignorados.push(entrada.name);
      continue;
    }
    if (enUso.has(entrada.name.toLowerCase())) continue;
    const datos = await fs.stat(path.join(directorio, entrada.name));
    const edadMs = Math.max(0, ahora.getTime() - datos.mtime.getTime());
    if (edadMs < minHoras * 3600_000) continue;
    huerfanos.push({ nombre: entrada.name, bytes: datos.size, modificado: datos.mtime });
  }
  huerfanos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return { huerfanos, ignorados };
}
