import morgan from 'morgan';
import type { Request, RequestHandler } from 'express';
import { rutaParaRegistro } from '../utils/log-privacidad.js';

/**
 * Registro de accesos (morgan).
 *
 * En desarrollo, el formato `dev` de siempre: corto y con colores. En
 * producción no sirve: escribe la URL completa —y la búsqueda del censo viaja
 * en `?q=` con nombres y DNI—, y no lleva ni fecha ni IP, justo lo que hace
 * falta para reconstruir un incidente. El de producción lleva fecha ISO, IP
 * (la real: morgan usa `req.ip`, que respeta `trust proxy`), método, ruta SIN
 * la consulta, estado, tamaño y tiempo de respuesta. El agente de usuario y el
 * Referer se omiten a propósito: el Referer de la página de recuperación de
 * contraseña lleva el token.
 */

morgan.token('ruta', (req: Request) => rutaParaRegistro(req.originalUrl ?? req.url ?? ''));

export const FORMATO_PRODUCCION =
  ':date[iso] :remote-addr :method :ruta :status :res[content-length] - :response-time ms';

export function registroPeticiones(
  entorno: string | undefined = process.env.NODE_ENV,
  stream?: { write: (linea: string) => void }
): RequestHandler {
  const opciones = stream ? { stream } : {};
  return entorno === 'production'
    ? morgan(FORMATO_PRODUCCION, opciones)
    : morgan('dev', opciones);
}
