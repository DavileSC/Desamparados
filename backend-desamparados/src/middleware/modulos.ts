import type { RequestHandler } from 'express';
import { ModulosService } from '../services/modulos.service.js';
import { fichaDe, type ClaveModulo } from '../domain/modulos.js';

/**
 * La guarda de un router (o de una ruta suelta) de un módulo: apagado,
 * responde 404 con un mensaje claro y la clave, para que la web distinga
 * «no existe» de «no está activado». Va en `app.ts` delante de cada router
 * (`app.use('/api/tienda', conModulo('tienda'), tiendaRoutes)`) y, dentro de
 * un router que mezcla módulos, delante de las rutas del otro.
 */
export const conModulo = (clave: ClaveModulo): RequestHandler => async (_req, res, next) => {
  try {
    if (await ModulosService.activo(clave)) return next();
    res.status(404).json({
      status: 'error',
      error: 'MODULO_NO_ACTIVADO',
      modulo: clave,
      message: `El módulo «${fichaDe(clave).nombre}» no está activado en esta instalación.`,
    });
  } catch (e) {
    next(e);
  }
};

/**
 * La marca de un router del núcleo: no hace nada. Existe para que
 * `test/modulos-cobertura.test.ts` pueda exigir que TODO montaje de `app.ts`
 * diga de qué módulo es, y un router nuevo sin decidirlo no pase.
 */
export const nucleo: RequestHandler = (_req, _res, next) => next();
