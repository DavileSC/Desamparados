import { Response, NextFunction, Request } from 'express';
import { handleHttp } from '../utils/error.handle';
import { Role } from '@prisma/client';
// 1. Importamos tu interfaz extendida que sí tiene el req.user tipado

/** Código del 403 por sesión que no nació en el CMS (lo lee `lib/api/client.ts` del frontend). */
export const SESION_NO_CMS = 'SESION_NO_CMS';

export const checkRole = (allowedRoles: Role[]) => {
  // 2. Usamos RequestExt aquí
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Caso 1: La sesión del CMS no está (Error 403 Forbidden con código propio).
      //
      // El CMS y el área de hermanos tienen una cookie cada uno. El segundo
      // factor solo se pide al entrar por /cms/acceso, así que una sesión del
      // área de hermanos es una sesión que NO ha pasado el 2FA: no puede abrir
      // nada de aquí. Con cookies separadas ni siquiera puede confundirse, pero
      // la comprobación se queda porque es la que da sentido al 2FA.
      //
      // Va aquí, y no en un middleware suelto que haya que recordar en cada
      // router, porque `checkRole` es el paso obligado de TODAS las rutas de
      // staff: ninguna de sus listas de roles incluye USER. Olvidarse de un
      // router es justo el fallo que ya dejó abierta /news/admin/archive.
      const sesion = req.sesiones?.cms;
      if (!sesion) {
        // Si hay sesión de hermanos, es que alguien ha llegado aquí desde el
        // área de hermanos: no es un fallo de permisos, es que falta el acceso
        // del CMS. Sin ninguna de las dos, es un 401 normal.
        if (!req.sesiones?.hermano) {
          return handleHttp(res, 'NO_USER_FOUND', 'Usuario no autenticado', 401);
        }
        return res.status(403).json({
          error: SESION_NO_CMS,
          message: 'Esta sesión no da acceso al gestor de contenidos. Entra por el acceso del CMS.'
        });
      }

      // A partir de aquí, la identidad de la petición es la del CMS: la
      // auditoría tiene que apuntar a quien está administrando, no a la sesión
      // de hermano que esa misma persona pueda tener abierta en otra pestaña.
      req.user = sesion;

      // Caso 2: El rol no coincide (Error 403 Forbidden).
      // Como user.role viene del JWT (string), lo casteamos al Enum Role de Prisma
      if (allowedRoles.includes(sesion.role as Role)) {
        return next();
      }
      return handleHttp(res, `Intentó acceder con rol: ${sesion.role}`, 'No tienes permisos para realizar esta acción', 403);

    } catch (e) {
      return handleHttp(res, e, 'Error verificando permisos', 500);
    }
  };
};
