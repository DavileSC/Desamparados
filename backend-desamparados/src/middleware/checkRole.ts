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

      // Caso 2: El rol no coincide (Error 403 Forbidden)
      // Como user.role viene del JWT (string), lo casteamos al Enum Role de Prisma
      if (allowedRoles.includes(user.role as Role)) {
        return next();
      } else {
        return handleHttp(res, `Intentó acceder con rol: ${user.role}`, 'No tienes permisos para realizar esta acción', 403);
      }

    } catch (e) {
      // Caso 3: Error inesperado (Error 500)
      return handleHttp(res, e, 'Error verificando permisos', 500);
    }
  };
};