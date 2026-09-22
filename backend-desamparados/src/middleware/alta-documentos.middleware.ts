import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { fileTypeFromBuffer } from 'file-type';
import { MAX_BYTES_IMAGEN, privateStorageDir } from './upload.middleware.js';
import { recodificarSinMetadatos } from '../controllers/subida.controller.js';
import { scanBufferClamav } from '../utils/clamd.js';

/**
 * Los dos documentos que se adjuntan al alta: la foto y el certificado de
 * bautismo. Es la única subida de la API sin sesión, así que va aparte de la
 * del CMS y con sus propias reglas:
 *
 *  - Solo dos ficheros, cada uno con su campo y sus tipos. La foto, JPG o PNG;
 *    el certificado, PDF, DOC o DOCX, que es como lo dan las parroquias.
 *  - Van a storage/private: los ve Secretaría desde el CMS y nadie más.
 *  - Se comprueban por su contenido real (no por la extensión que dice el
 *    navegador), pasan por el antivirus y la foto pierde sus metadatos.
 *  - El resto del alta viaja como JSON en el campo `datos`, y se deja en
 *    `req.body` para que `validate(registerSchema)` lo mire igual que siempre.
 *  - Si el alta no sale adelante por lo que sea (datos que no validan, un DNI
 *    repetido, la trampa de robots), los ficheros se borran al responder. Solo
 *    se quedan si el controlador marca `res.locals.conservarDocumentos`.
 *
 * Los nombres que se guardan en la ficha los pone el servidor
 * (`req.documentosDelAlta`), nunca el cuerpo: el esquema del alta no admite
 * nombres de fichero, así que nadie puede enlazar su ficha a un documento ajeno.
 */

export const MAX_BYTES_CERTIFICADO = 10 * 1024 * 1024;

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Lo que admite cada campo: tipos reales (los que ve file-type) y extensiones. */
const DOCUMENTOS = {
  foto: {
    tipos: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] } as Record<string, string[]>,
    tope: MAX_BYTES_IMAGEN,
    formato: 'La foto tiene que ser JPG o PNG.',
    pesada: 'La foto pesa más de 5 MB. Redúcela antes de adjuntarla.',
  },
  certificadoBautismo: {
    // Un .doc es un contenedor OLE (file-type lo ve como `x-cfb`); un .docx, un zip de Office.
    tipos: { 'application/pdf': ['.pdf'], 'application/x-cfb': ['.doc'], [DOCX]: ['.docx'] } as Record<string, string[]>,
    tope: MAX_BYTES_CERTIFICADO,
    formato: 'El certificado tiene que ser PDF, DOC o DOCX.',
    pesada: 'El certificado pesa más de 10 MB. Redúcelo antes de adjuntarlo.',
  },
} as const;

export type CampoDocumento = keyof typeof DOCUMENTOS;
const CAMPOS = Object.keys(DOCUMENTOS) as CampoDocumento[];

/** Los nombres ya comprobados, para la ficha. */
export type DocumentosDelAlta = Partial<Record<CampoDocumento, string>>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      documentosDelAlta?: DocumentosDelAlta;
    }
  }
}

class DocumentoRechazado extends Error {
  constructor(public campo: CampoDocumento, message: string, public status = 400) {
    super(message);
  }
}

const subida = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, privateStorageDir),
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  fileFilter: (_req, file, cb) => {
    const reglas = DOCUMENTOS[file.fieldname as CampoDocumento];
    if (!reglas) return cb(new DocumentoRechazado('foto', 'Solo se adjuntan la foto y el certificado de bautismo.'));
    const ext = path.extname(file.originalname).toLowerCase();
    if (!Object.values(reglas.tipos).flat().includes(ext)) {
      return cb(new DocumentoRechazado(file.fieldname as CampoDocumento, reglas.formato));
    }
    cb(null, true);
  },
  // Multer corta en el tope mayor; el de cada campo se aplica después.
  limits: { fileSize: MAX_BYTES_CERTIFICADO, files: CAMPOS.length, fields: 1, fieldSize: 64 * 1024 },
}).fields(CAMPOS.map((name) => ({ name, maxCount: 1 })));

const ficherosDe = (req: Request): Express.Multer.File[] =>
  Object.values((req.files ?? {}) as Record<string, Express.Multer.File[]>).flat();

const rechazar = (res: Response, campo: string, message: string, status = 400) =>
  res.status(status).json({ status: 'error', message, errors: [{ field: campo, message }] });

/**
 * Recibe el alta en multipart (con documentos) o en JSON (sin ellos, como las
 * webs de antes). En los dos casos deja en `req.body` el alta en JSON.
 */
export function recibirAlta(req: Request, res: Response, next: NextFunction) {
  if (!req.is('multipart/form-data')) return next();

  subida(req, res, (error: unknown) => {
    // Pase lo que pase después, lo que no se conserve expresamente se borra.
    res.on('finish', () => {
      if (res.locals.conservarDocumentos) return;
      for (const fichero of ficherosDe(req)) void fs.unlink(fichero.path).catch(() => {});
    });

    if (error instanceof DocumentoRechazado) return rechazar(res, error.campo, error.message);
    if (error instanceof multer.MulterError) {
      const campo = (CAMPOS as string[]).includes(error.field ?? '') ? error.field! : 'certificadoBautismo';
      return error.code === 'LIMIT_FILE_SIZE'
        ? rechazar(res, campo, DOCUMENTOS[campo as CampoDocumento].pesada, 413)
        : rechazar(res, campo, 'No se han podido recibir los documentos. Vuelve a adjuntarlos.');
    }
    if (error) return next(error);

    try {
      req.body = JSON.parse(String(req.body?.datos ?? ''));
    } catch {
      return res.status(400).json({ status: 'error', message: 'La solicitud ha llegado incompleta. Vuelve a enviarla.' });
    }
    next();
  });
}

/**
 * Comprueba cada documento de verdad: tipo por su contenido, que la extensión
 * cuadre, su tope, el antivirus y, en la foto, fuera metadatos (el GPS del
 * móvil dice dónde vive quien se apunta). Va después de validar el alta: no
 * se analiza nada de una solicitud que no iba a salir.
 */
export async function comprobarDocumentosDelAlta(req: Request, res: Response, next: NextFunction) {
  const recibidos = (req.files ?? {}) as Partial<Record<CampoDocumento, Express.Multer.File[]>>;
  const documentos: DocumentosDelAlta = {};
  try {
    for (const campo of CAMPOS) {
      const fichero = recibidos[campo]?.[0];
      if (!fichero) continue;
      const reglas = DOCUMENTOS[campo];

      const original = await fs.readFile(fichero.path);
      const tipo = await fileTypeFromBuffer(original);
      const extensiones = tipo ? reglas.tipos[tipo.mime] : undefined;
      if (!extensiones) throw new DocumentoRechazado(campo, reglas.formato);
      if (!extensiones.includes(path.extname(fichero.filename).toLowerCase())) {
        throw new DocumentoRechazado(campo, `${reglas.formato} La extensión no corresponde con lo que contiene.`);
      }
      if (fichero.size > reglas.tope) throw new DocumentoRechazado(campo, reglas.pesada, 413);

      const analisis = await scanBufferClamav(original);
      if (analisis.veredicto === 'infectado') {
        console.error(`[Alta] Documento rechazado por el antivirus (${campo}): ${analisis.reason}`);
        throw new DocumentoRechazado(campo, 'El antivirus ha rechazado este documento.');
      }
      if (analisis.veredicto === 'no-disponible') {
        // No es culpa del documento, y la solicitud no tiene por qué esperar:
        // se puede mandar sin él y entregarlo en Secretaría.
        console.error(`[Alta] Antivirus no disponible: ${analisis.reason}`);
        throw new DocumentoRechazado(campo, 'Ahora mismo no se pueden revisar los documentos. Inténtalo más tarde, o envía la solicitud sin él y entrégalo en Secretaría.', 503);
      }

      if (campo === 'foto') {
        let limpia: Buffer;
        try {
          limpia = await recodificarSinMetadatos(original, tipo!.mime);
        } catch {
          throw new DocumentoRechazado(campo, 'No se ha podido leer la foto. Comprueba que no está dañada.');
        }
        if (limpia.length > reglas.tope) throw new DocumentoRechazado(campo, reglas.pesada, 413);
        await fs.writeFile(fichero.path, limpia);
      }
      documentos[campo] = fichero.filename;
    }
  } catch (error) {
    if (error instanceof DocumentoRechazado) return rechazar(res, error.campo, error.message, error.status);
    return next(error);
  }
  req.documentosDelAlta = documentos;
  next();
}
