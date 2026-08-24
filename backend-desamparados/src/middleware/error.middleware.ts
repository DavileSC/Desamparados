import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { handleHttp, HttpError } from '../utils/error.handle.js';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    handleHttp(res, null, 'Endpoint no encontrado', 404);
};

export const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {

    // A. ERRORES DE NEGOCIO (HttpError): viajan al cliente con su estado y mensaje
    if (err instanceof HttpError) {
        return handleHttp(res, err, err.message, err.status);
    }

    // B. ERRORES NATIVOS DE PRISMA
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            return handleHttp(res, err, 'El registro ya existe (Dato duplicado).', 409);
        }
        if (err.code === 'P2025') {
            return handleHttp(res, err, 'El registro solicitado no existe.', 404);
        }
    }

    // C. Errores con estado propio (body-parser JSON malformado = 400, multer = 4xx...)
    const status = typeof err?.status === 'number' ? err.status : (typeof err?.statusCode === 'number' ? err.statusCode : 500);
    if (status >= 400 && status < 500) {
        return handleHttp(res, err, err.expose && err.message ? err.message : 'Petición incorrecta', status);
    }

    // D. CUALQUIER OTRO ERROR DESCONOCIDO (500). Nunca filtramos el mensaje interno.
    return handleHttp(res, err, 'Error interno del servidor no controlado', 500);
};
