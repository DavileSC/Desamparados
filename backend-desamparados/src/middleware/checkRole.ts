import { Response, NextFunction, Request } from 'express';
import { handleHttp } from '../utils/error.handle';
import { Role } from '@prisma/client';
// 1. Importamos tu interfaz extendida que sí tiene el req.user tipado

export const checkRole = (allowedRoles: Role[]) => {
  // 2. Usamos RequestExt aquí
  return (req: Request, res: Response, next: NextFunction) => { 
    try {
      const user = req.user;

      // Caso 1: No hay usuario (Error 401 Unauthorized)
      if (!user) {
        return handleHttp(res, 'NO_USER_FOUND', 'Usuario no autenticado', 401);
      }

      // Caso 2: La sesión se abrió en el área de hermanos (Error 403 Forbidden).
      //
      // El segundo factor solo se pide al entrar por /cms/acceso, así que una
      // sesión nacida en /hermanos/acceso es una sesión que NO ha pasado el 2FA.
      // Sin esta comprobación bastaba con entrar por el área de hermanos y
      // reutilizar esa cookie contra la API para saltárselo entero: la guarda
      // que lo impedía vivía solo en el frontend, y el frontend no protege nada.
      //
      // Va aquí, y no en un middleware suelto que haya que recordar en cada
      // router, porque `checkRole` es el paso obligado de TODAS las rutas de
      // staff: ninguna de sus listas de roles incluye USER. Olvidarse de un
      // router es justo el fallo que ya dejó abierto /news/admin/archive.
      //
      // La ausencia del claim se trata como 'cms', igual que hace
      // auth.controller al leer el testigo del 2FA: así las sesiones emitidas
      // antes de que existiera el claim no se caen de golpe.
      if (user.origen === 'hermanos') {
        return handleHttp(
          res,
          'Sesión abierta en el área de hermanos',
          'Esta sesión no da acceso al gestor de contenidos. Entra por el acceso del CMS.',
          403,
        );
      }

      // Caso 3: El rol no coincide (Error 403 Forbidden)
      // Como user.role viene del JWT (string), lo casteamos al Enum Role de Prisma
      if (allowedRoles.includes(user.role as Role)) {
        return next();
      } else {
        return handleHttp(res, `Intentó acceder con rol: ${user.role}`, 'No tienes permisos para realizar esta acción', 403);
      }

    } catch (e) {
      // Caso 4: Error inesperado (Error 500)
      return handleHttp(res, e, 'Error verificando permisos', 500);
    }
  };
};