import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthTokenPayload } from "../utils/jwt.handle.js";
import { AreaSesion, nombreCookie } from "../utils/cookies.js";
import db from "../config/db.js";

// 1. DECLARATION MERGING: Extiende el Request global de Express de forma automática
declare global {
  namespace Express {
    interface Request {
      /**
       * Identidad de esta petición. Por defecto la del área de hermanos, que es
       * la que usan sus rutas sin tocarlas; `checkRole` la cambia por la del CMS
       * en las rutas de staff, para que la auditoría apunte a quien corresponde.
       */
      user?: AuthTokenPayload;
      /** Las dos sesiones que trae el navegador, cada una ya validada. */
      sesiones: { cms: AuthTokenPayload | null; hermano: AuthTokenPayload | null };
    }
  }
}

/**
 * Valida un token ya firmado contra la base de datos:
 * - El usuario existe y está activo (baja/cuenta bloqueada = sesión muerta)
 * - El token nació en ESTA área (el claim `origen`). Un token del área de
 *   hermanos presentado como sesión del CMS es un token que no ha pasado el
 *   segundo factor, que solo se pide en /cms/acceso.
 * - Se emitió DESPUÉS del corte global (`tokenValidAfter`: contraseña, rol,
 *   RGPD) Y del corte de su área (`cmsValidoDesde` / `hermanoValidoDesde`:
 *   cerrar sesión en una no puede echar de la otra).
 * - Refresca el rol: si degradan a alguien, su token viejo pierde permisos al
 *   instante.
 */
export async function validateSessionAgainstDb(
  payload: AuthTokenPayload,
  area: AreaSesion
): Promise<AuthTokenPayload | null> {
  if (payload.origen !== area) return null;

  const dbUser = await db.user.findUnique({
    where: { id: payload.id },
    select: { role: true, active: true, tokenValidAfter: true, cmsValidoDesde: true, hermanoValidoDesde: true }
  });

  if (!dbUser || !dbUser.active) return null;

  // Con milisegundos cuando el token los trae: `iat` va en segundos enteros y,
  // tras un cierre de sesión (que mueve la marca al instante actual), el login
  // que se hiciera en ese mismo segundo nacería ya revocado.
  const issuedAtMs = typeof payload.emitidoMs === 'number' ? payload.emitidoMs : (payload.iat ?? 0) * 1000;
  const marcaDelArea = area === 'cms' ? dbUser.cmsValidoDesde : dbUser.hermanoValidoDesde;
  const corte = Math.max(dbUser.tokenValidAfter.getTime(), marcaDelArea.getTime());
  if (issuedAtMs < corte) return null;

  // Devolvemos el payload con el rol REAL de la BD (no el que viajaba en el JWT)
  return { ...payload, role: dbUser.role };
}

/** Lee una cookie de sesión y la valida; `null` si no está, no vale o no es de su área. */
async function leerSesion(req: Request, area: AreaSesion): Promise<AuthTokenPayload | null> {
  const token = req.cookies?.[nombreCookie(area)];
  if (!token) return null;
  // El tipo esperado es obligatorio: un testigo de 2FA colado en esta cookie
  // no puede valer como sesión.
  const payload = verifyToken(token, 'session');
  if (!payload) return null;
  return await validateSessionAgainstDb(payload, area);
}

/**
 * Deja las dos sesiones en `req.sesiones`. No bloquea nunca: quien decide si
 * hace falta una, y cuál, es `authenticateToken` o `checkRole`.
 */
export const resolverSesiones = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const [cms, hermano] = await Promise.all([leerSesion(req, 'cms'), leerSesion(req, 'hermanos')]);
    req.sesiones = { cms, hermano };
    req.user = hermano ?? cms ?? undefined;
  } catch {
    req.sesiones = { cms: null, hermano: null };
    req.user = undefined;
  }
  next();
};

/** Estricto: sin ninguna de las dos sesiones, bloquea. */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  await resolverSesiones(req, res, () => {});
  if (!req.sesiones.cms && !req.sesiones.hermano) {
    return res.status(401).json({ error: 'NO_TOKEN_PROVIDED', message: 'Se requiere una sesión iniciada' });
  }
  next();
};

/** Opcional: sin sesión, sigue como invitado. */
export const optionalAuthentication = resolverSesiones;
