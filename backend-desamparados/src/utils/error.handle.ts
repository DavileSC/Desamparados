import { Response } from 'express';

/**
 * Manejador centralizado de respuestas de error.
 * * @param res Objeto Response de Express
 * @param errorRaw El error crudo (objeto Error, string o null) para logging interno del servidor.
 * @param publicMessage Mensaje amigable que se enviará al cliente JSON.
 * @param statusCode Código HTTP de la respuesta (Default: 500).
 */
const handleHttp = (
  res: Response, 
  errorRaw: any, 
  publicMessage: string = 'Error interno del servidor', 
  statusCode: number = 500
) => {
  // 1. Logging interno (vital para debuggear en producción)
  // Usamos console.error para que herramientas como CloudWatch/Datadog lo capturen como error.
  console.error(`[HTTP ${statusCode}] ${publicMessage}`, errorRaw);

  // 2. Respuesta al cliente
  res.status(statusCode).json({ 
    error: publicMessage,
    // Opcional: Si estás en entorno 'development', podrías querer devolver el stack
    // details: process.env.NODE_ENV === 'development' ? errorRaw : undefined
  });
};

export { handleHttp };