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
      // Sin el claim tampoco es una sesión del CMS. Durante la migración se
      // trataba como 'cms' para no tirar las sesiones abiertas antes del 7-09,
      // pero la sesión más larga dura 72 h: esa gracia ya no protege a nadie y
      // solo dejaba una puerta a un token sin origen.
      //
      // Con código propio, distinto del 403 de permisos: si otra pestaña entra
      // por el área de hermanos, la cookie del CMS se sustituye y cada petición
      // del CMS abierto recibe esto. El frontend lo reconoce por el código y lo
      // trata como sesión perdida para el CMS, en vez de un «no tienes
      // permisos» inexplicable en cada pantalla.
      if (user.origen !== 'cms') {
        console.warn(`[HTTP 403] Sesión de origen ${user.origen ?? 'desconocido'} en una ruta del CMS`);
        return res.status(403).json({
          error: SESION_NO_CMS,
          message: 'Esta sesión no da acceso al gestor de contenidos. Entra por el acceso del CMS.'
        });
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