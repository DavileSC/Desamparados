import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.handle';

export const optionalAuthentication = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    // VALIDACIÓN ESTRICTA:
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      // Es un invitado, no hay usuario
      req.user = undefined; 
      return next();
    }

    const token = authHeader.split(' ')[1] || '';
    const user = verifyToken(token); // Devuelve AuthTokenPayload | null

    // Si el token es válido, inyectamos el usuario. Si expiró (null), lo tratamos como invitado.
    req.user = user ? user : undefined;
    next();
    
  } catch (e) {
    req.user = undefined;
    next();
  }
};