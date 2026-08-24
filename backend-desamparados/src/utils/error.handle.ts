import { Response } from 'express';

/**
 * Error de negocio con código HTTP asociado.
 *
 * Los servicios lanzan `HttpError` para reglas de dominio ("Ya tienes tu papeleta",
 * "DNI duplicado", "Hermano no encontrado"...). Su mensaje es apto para el usuario
 * final y viaja al cliente con el estado indicado (por defecto 400).
 *
 * Cualquier otro `Error` (TypeError, fallo de Prisma, bug...) se considera interno:
 * se registra en el servidor y el cliente recibe un 500 genérico sin detalles.
 */
export class HttpError extends Error {
  public readonly status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = 'Recurso no encontrado') {
    super(message, 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Manejador centralizado de respuestas de error.
 *
 * @param res Objeto Response de Express
 * @param errorRaw El error crudo (objeto Error, string o null) para logging interno del servidor.
 * @param publicMessage Mensaje amigable que se enviará al cliente JSON (fallback si el error no es HttpError).
 * @param statusCode Código HTTP de la respuesta (Default: 500). Si el error es un HttpError y aquí
 *                   se deja el valor por defecto, se usa el estado del propio HttpError.
 */
const handleHttp = (
  res: Response,
  errorRaw: any,
  publicMessage: string = 'Error interno del servidor',
  statusCode: number = 500
) => {
  let status = statusCode;
  let message = publicMessage;

  // Errores de negocio: el mensaje y el estado del propio error tienen prioridad
  // (salvo que el controlador haya forzado explícitamente un estado distinto de 500).
  if (errorRaw instanceof HttpError) {
    message = errorRaw.message;
    status = statusCode === 500 ? errorRaw.status : statusCode;
  }

  // 1. Logging interno (vital para debuggear en producción).
  // Los 4xx de negocio son ruido esperado: los dejamos en nivel warn.
  if (status >= 500) {
    console.error(`[HTTP ${status}] ${message}`, errorRaw);
  } else {
    console.warn(`[HTTP ${status}] ${message}`);
  }

  // 2. Respuesta al cliente
  res.status(status).json({ error: message });
};

export { handleHttp };
