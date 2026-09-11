import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthTokenPayload } from "../utils/jwt.handle.js";
import { COOKIE_SESION } from "../utils/cookies.js";
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
export async function validateSessionAgainstDb(payload: AuthTokenPayload): Promise<AuthTokenPayload | null> {
  const dbUser = await db.user.findUnique({
    where: { id: payload.id },
    select: { role: true, active: true, tokenValidAfter: true }
  });

  if (!dbUser || !dbUser.active) return null;

  // Con milisegundos cuando el token los trae: `iat` va en segundos enteros y,
  // tras un cierre de sesión (que mueve tokenValidAfter al instante actual),
  // el login que se hiciera en ese mismo segundo nacería ya revocado. Los
  // tokens emitidos antes de existir `emitidoMs` siguen con `iat`.
  const issuedAtMs = typeof payload.emitidoMs === 'number' ? payload.emitidoMs : (payload.iat ?? 0) * 1000;
  if (issuedAtMs < dbUser.tokenValidAfter.getTime()) return null;

  // Devolvemos el payload con el rol REAL de la BD (no el que viajaba en el JWT)
  return { ...payload, role: dbUser.role };
}

// 2. MIDDLEWARE ESTRICTO (Si no hay token, bloquea)
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[COOKIE_SESION];

    if (!token) {
      return res.status(401).json({ error: "NO_TOKEN_PROVIDED", message: "Se requiere una sesión iniciada" });
    }

    // El tipo esperado es obligatorio: un testigo de 2FA colado en esta cookie
    // no puede valer como sesión.
    const decodedPayload = verifyToken(token, 'session');

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
    const token = req.cookies?.[COOKIE_SESION];

    if (!token) {
      req.user = undefined;
      return next();
    }

    // Mismo tipo exigido que en el estricto: si solo lo comprobara aquel, el
    // testigo de 2FA serviria para identificarse en las rutas opcionales.
    const payload = verifyToken(token, 'session');

    // Token válido según firma: lo validamos también contra BD (rol fresco, no revocado).
    // Si la BD lo invalida, tratamos al visitante como invitado en lugar de bloquearlo.
    req.user = payload ? (await validateSessionAgainstDb(payload)) ?? undefined : undefined;
    next();

  } catch (e) {
    req.user = undefined;
    next();
  }
};
