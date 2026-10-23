import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import multer from 'multer';
import { handleHttp, HttpError, traducirErrorPrisma } from '../utils/error.handle.js';

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
    handleHttp(res, null, 'Endpoint no encontrado', 404);
};

/**
 * Mensajes de multer en español. Ninguno es un fallo del servidor: todos se
 * deben a lo que mandó el cliente, así que salen como 400 (413 el de tamaño).
 * Los códigos son los de `multer.MulterError`.
 */
const MENSAJES_MULTER: Record<string, string> = {
    LIMIT_FILE_SIZE: 'El archivo supera el tamaño máximo permitido. Redúcelo o comprímelo y vuelve a intentarlo.',
    LIMIT_FILE_COUNT: 'Se han enviado demasiados archivos: sube uno cada vez.',
    LIMIT_UNEXPECTED_FILE: 'El archivo llegó en un campo inesperado: debe enviarse en el campo «file».',
    LIMIT_PART_COUNT: 'El formulario de subida tiene demasiadas partes.',
    LIMIT_FIELD_KEY: 'El nombre de un campo del formulario es demasiado largo.',
    LIMIT_FIELD_VALUE: 'El valor de un campo del formulario es demasiado largo.',
    LIMIT_FIELD_COUNT: 'El formulario de subida tiene demasiados campos.',
    MISSING_FIELD_NAME: 'Falta el nombre de un campo del formulario.',
};

/**
 * Errores que el propio Express genera al leer el cuerpo (body-parser). Traen
 * `status` y un mensaje en inglés pensado para desarrolladores; aquí se
 * traducen por su `type`, que es estable entre versiones.
 */
const MENSAJES_CUERPO: Record<string, string> = {
    'entity.too.large': 'El contenido enviado es demasiado grande.',
    'entity.parse.failed': 'El cuerpo de la petición no es un JSON válido.',
    'encoding.unsupported': 'La codificación del contenido no está admitida.',
    'charset.unsupported': 'El juego de caracteres del contenido no está admitido.',
    'request.aborted': 'La petición se interrumpió antes de terminar de enviarse.',
};

export const globalErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {

    // A. ERRORES DE NEGOCIO (HttpError): viajan al cliente con su estado y mensaje
    if (err instanceof HttpError) {
        return handleHttp(res, err, err.message, err.status);
    }

    // B. ERRORES DE PRISMA con traducción (P2002, P2025, P2003). handleHttp los
    // traduce solo con el estado por defecto; se comprueba aquí para no caer
    // en el apartado D con un error que sí es culpa de la petición.
    if (traducirErrorPrisma(err)) {
        return handleHttp(res, err);
    }

    // C. Subidas (multer). MulterError no trae `status`, así que antes caía en el 500.
    if (err instanceof multer.MulterError) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return handleHttp(res, err, MENSAJES_MULTER[err.code] ?? 'La subida del archivo no es válida.', status);
    }

    // D. Errores con estado propio (body-parser: JSON malformado = 400, cuerpo demasiado grande = 413...)
    const status = typeof err?.status === 'number' ? err.status : (typeof err?.statusCode === 'number' ? err.statusCode : 500);
    if (status >= 400 && status < 500) {
        const traducido = typeof err?.type === 'string' ? MENSAJES_CUERPO[err.type] : undefined;
        return handleHttp(res, err, traducido ?? (err.expose && err.message ? err.message : 'Petición incorrecta'), status);
    }

    // E. CUALQUIER OTRO ERROR DESCONOCIDO (500). Nunca filtramos el mensaje interno.
    return handleHttp(res, err, 'Error interno del servidor no controlado', 500);
};
