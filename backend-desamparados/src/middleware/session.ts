import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthTokenPayload } from "../utils/jwt.handle.js";
import { AreaSesion, nombreCookie } from "../utils/cookies.js";
import db from "../config/db.js";
import { ModulosService } from "../services/modulos.service.js";
import { conModulo } from "./modulos.js";

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
    select: {
      role: true, active: true, twoFactorEnabled: true, primerAccesoPendiente: true,
      tokenValidAfter: true, cmsValidoDesde: true, hermanoValidoDesde: true,
    }
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
  return { ...payload, role: dbUser.role, dobleFactor: dbUser.twoFactorEnabled, primerAccesoPendiente: dbUser.primerAccesoPendiente };
}

/** Lee una cookie de sesión y la valida; `null` si no está, no vale o no es de su área. */
async function leerSesion(req: Request, area: AreaSesion): Promise<AuthTokenPayload | null> {
  // Con el área de hermanos apagada, una sesión de hermano que ya existiera
  // no vale: la pantalla desaparece y la API responde como si no hubiera sesión.
  if (area === 'hermanos' && !(await ModulosService.activo('area-hermanos'))) return null;
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

/** Código del 403 por primer acceso sin confirmar (lo lee el cliente de la API de la web). */
export const PRIMER_ACCESO_PENDIENTE = 'PRIMER_ACCESO_PENDIENTE';

/**
 * Lo único que abre una sesión del área con el primer acceso sin confirmar:
 * lo que llaman de verdad las pantallas de la revisión
 * (`desamparados-web/src/features/areaHermano/primerAcceso/` y los apartados
 * de «Mi perfil» que reutiliza). `/auth/me` y `/auth/logout` no pasan por
 * aquí: no llevan `authenticateToken`. Una pantalla nueva en la revisión que
 * llame a otra ruta tiene que añadirla aquí, o recibirá el 403.
 *
 * Descargar los datos y borrar la cuenta (RGPD, arts. 15 y 17) también: son
 * derechos de la persona, y exigirle antes el DNI, la dirección o el IBAN que
 * faltan en su ficha para poder ejercerlos sería pedirle justo lo que quizá
 * no quiere dar.
 */
const RUTAS_DE_LA_REVISION: { metodo: string; ruta: RegExp }[] = [
  { metodo: 'GET', ruta: /^\/api\/auth\/mis-datos\/?$/i },
  { metodo: 'DELETE', ruta: /^\/api\/auth\/mi-cuenta\/?$/i },
  { metodo: 'GET', ruta: /^\/api\/hermanos\/mis-perfiles\/?$/i },
  { metodo: 'PUT', ruta: /^\/api\/hermanos\/mis-perfiles\/[^/]+\/?$/i },
  { metodo: '*', ruta: /^\/api\/hermanos\/primer-acceso\/./i },
];

function esDeLaRevision(req: Request): boolean {
  const ruta = req.originalUrl.split('?')[0];
  return RUTAS_DE_LA_REVISION.some((r) => (r.metodo === '*' || r.metodo === req.method) && r.ruta.test(ruta));
}

/**
 * Estricto: sin ninguna de las dos sesiones, bloquea.
 *
 * Y frena aquí a la cuenta que aún no ha confirmado su ficha del primer
 * acceso: la web la manda a la revisión, pero la API no puede fiarse de la
 * web, y con la cookie a mano se pedían papeletas, se veían los recibos o se
 * daba de baja a un familiar sin que Secretaría lo viera llegar. Va aquí, y
 * no en cada router del área, por lo mismo que el 2FA va en `checkRole`: es
 * el paso obligado de todas sus rutas, y un router olvidado quedaría abierto.
 *
 * Solo cuenta para la sesión del área de hermanos, que es la que la revisión
 * bloquea: fuera de la revisión esa sesión se descarta, y si además hay una
 * del CMS la petición sigue con ella (es la que usan las rutas de staff, que
 * `checkRole` vuelve a mirar). El dato sale de la base en cada petición
 * (`validateSessionAgainstDb`), así que confirmar abre el área al instante.
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  await resolverSesiones(req, res, () => {});
  if (!req.sesiones.cms && !req.sesiones.hermano) {
    return res.status(401).json({ error: 'NO_TOKEN_PROVIDED', message: 'Se requiere una sesión iniciada' });
  }
  if (req.sesiones.hermano?.primerAccesoPendiente && !esDeLaRevision(req)) {
    req.sesiones = { cms: req.sesiones.cms, hermano: null };
    req.user = req.sesiones.cms ?? undefined;
    if (!req.sesiones.cms) {
      return res.status(403).json({
        error: PRIMER_ACCESO_PENDIENTE,
        message: 'Antes de usar el área de hermanos tienes que revisar y confirmar tu ficha.',
      });
    }
  }
  next();
};

const guardaDelArea = conModulo('area-hermanos');

/**
 * La guarda de las rutas propias del área de hermanos (mis fichas, mi
 * procesión, mis recibos), detrás de `authenticateToken`; nunca en las
 * `/admin`. `authenticateToken` deja pasar con cualquiera de las dos sesiones,
 * y una del CMS no sabía nada del área: con «Área de hermanos» apagado, o con
 * la cuenta aún sin confirmar su ficha, un cargo entraba por /cms/acceso y
 * pedía papeletas o daba de alta a un menor por la API. Aquí cuenta la
 * identidad que haya quedado, venga de la sesión que venga.
 */
export const exigirAreaHermanos = (req: Request, res: Response, next: NextFunction) =>
  guardaDelArea(req, res, (error?: unknown) => {
    if (error) return next(error);
    if (req.user?.primerAccesoPendiente && !esDeLaRevision(req)) {
      return res.status(403).json({
        error: PRIMER_ACCESO_PENDIENTE,
        message: 'Antes de usar el área de hermanos tienes que revisar y confirmar tu ficha.',
      });
    }
    next();
  });
