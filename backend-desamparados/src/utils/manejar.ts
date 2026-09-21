import { Request, Response } from 'express';
import { handleHttp } from './error.handle.js';

/**
 * Un handler de Express con su red: lo que lance va a `handleHttp` con el
 * mensaje de esta ruta, y de ahí sale el estado y el registro que toque.
 *
 * Los controladores repetían ese try/catch entero en cada método, unas ciento
 * treinta veces entre todos. Escrito a mano es fácil olvidarlo —y entonces el
 * error sube al manejador global de Express, que responde otra cosa— o dejar
 * un `catch` que se traga el error sin registrarlo. Con el envoltorio el caso
 * de error no se puede olvidar: no se escribe.
 *
 * Lo que sigue viniendo de cada ruta es el mensaje público de qué se estaba
 * haciendo («Error aprobando la solicitud»), que es lo único que cambiaba de
 * un `catch` a otro.
 *
 * Los errores esperados (no encontrado, sin permiso) se siguen contestando
 * dentro del cuerpo llamando a `handleHttp` con su estado: eso no es una
 * excepción, es una respuesta.
 */
export const manejar = (
  mensajeSiFalla: string,
  accion: (req: Request, res: Response) => Promise<unknown>,
) => async (req: Request, res: Response): Promise<void> => {
  try {
    await accion(req, res);
  } catch (e) {
    handleHttp(res, e, mensajeSiFalla);
  }
};
