import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthTokenPayload } from "../utils/jwt.handle.js";
import db from "../config/db.js";

// 1. DECLARATION MERGING: Extiende el Request global de Express de forma automática
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Valida un token ya firmado contra la base de datos:
 * - El usuario existe y está activo (baja/cuenta bloqueada = sesión muerta)
 * - El token se emitió DESPUÉS de 'tokenValidAfter' (invalidación por cambio de
 *   contraseña, degradación de rol, etc.)
 * - Refresca el rol: si degradan a alguien, su token viejo pierde permisos al instante.
 */
async function validateSessionAgainstDb(payload: AuthTokenPayload): Promise<AuthTokenPayload | null> {
  const dbUser = await db.user.findUnique({
    where: { id: payload.id },
    select: { role: true, active: true, tokenValidAfter: true }
  });

  if (!dbUser || !dbUser.active) return null;

  const issuedAtMs = (payload.iat ?? 0) * 1000;
  if (issuedAtMs < dbUser.tokenValidAfter.getTime()) return null;

  // Devolvemos el payload con el rol REAL de la BD (no el que viajaba en el JWT)
  return { ...payload, role: dbUser.role };
}

// 2. MIDDLEWARE ESTRICTO (Si no hay token, bloquea)
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "NO_TOKEN_PROVIDED", message: "Se requiere un token Bearer válido" });
    }

    const token = authHeader.split(" ")[1];
    const decodedPayload = verifyToken(token);

    if (!decodedPayload) {
      return res.status(401).json({ error: "INVALID_TOKEN", message: "El token ha expirado o es inválido" });
    }

    const validPayload = await validateSessionAgainstDb(decodedPayload);
    if (!validPayload) {
      return res.status(401).json({ error: "SESSION_REVOKED", message: "Tu sesión ha sido invalidada. Vuelve a iniciar sesión." });
    }

    req.user = validPayload;
    next();

  } catch (e: any) {
    res.status(401).json({ error: "INVALID_SESSION", message: "Error crítico en la autenticación" });
  }
};

// 3. MIDDLEWARE OPCIONAL (Si no hay token, lo deja pasar como invitado)
export const optionalAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = undefined;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    // Token válido según firma: lo validamos también contra BD (rol fresco, no revocado).
    // Si la BD lo invalida, tratamos al visitante como invitado en lugar de bloquearlo.
    req.user = payload ? (await validateSessionAgainstDb(payload)) ?? undefined : undefined;
    next();

  } catch (e) {
    req.user = undefined;
    next();
  }
};
