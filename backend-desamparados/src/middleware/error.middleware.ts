import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { handleHttp } from '../utils/error.handle.js';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    handleHttp(res, null, 'Endpoint no encontrado', 404);
};

export const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
    
    // A. CAPTURAMOS ERRORES NATIVOS DE PRISMA
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            return handleHttp(res, err, `El registro ya existe (Dato duplicado).`, 409);
        }
        if (err.code === 'P2025') {
            return handleHttp(res, err, 'El registro solicitado no existe.', 404);
        }
    }

    // B. CAPTURAMOS TUS ERRORES DE NEGOCIO ('throw new Error')
    // AÑADIMOS RETURN PARA QUE NO SIGA EJECUTANDO
    if (err instanceof Error && err.message) {
        return handleHttp(res, err, err.message, 400); 
    }

    // C. CUALQUIER OTRO ERROR DESCONOCIDO (500)
    return handleHttp(res, err, 'Error interno del servidor no controlado', err.status || 500);
};