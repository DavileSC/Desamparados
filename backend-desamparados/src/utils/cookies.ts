import type { CookieOptions, Response } from 'express';
import { duracionSesionSegundos, PENDIENTE_2FA_SEGUNDOS, RECORDARME_SEGUNDOS } from './jwt.handle.js';

/**
 * El CMS y el área de hermanos tienen **una cookie cada uno**. Con una sola,
 * entrar por un acceso sustituía la sesión del otro: quien estaba dentro del
 * CMS y se identificaba como hermano para ver su perfil perdía la
 * administración. Son dos sesiones distintas de la misma persona.
 */
export type AreaSesion = 'cms' | 'hermanos';

export const COOKIE_CMS = 'desamparados_cms';
export const COOKIE_HERMANO = 'desamparados_hermano';
export const COOKIE_2FA = 'desamparados_2fa';

export const nombreCookie = (area: AreaSesion): string =>
  area === 'cms' ? COOKIE_CMS : COOKIE_HERMANO;

// La cookie de sesión solo viaja a la API; los estáticos y /storage/public no la reciben.
const RUTA_SESION = '/api';
const RUTA_2FA = '/api/auth';

/** Secure solo en producción: en local se sirve por http y el navegador la descartaría. */
const base = (path: string): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path
});

/**
 * La duración la decide el ÁREA, no el rol.
 *
 * - CMS: sin maxAge, o sea cookie que muere al cerrar el navegador, porque se
 *   usa desde equipos compartidos de la casa parroquial.
 * - Hermanos: persiste, con el mismo tope que el JWT para que no lo sobreviva.
 *
 * Antes lo decidía `esStaff(role)`, y entonces un Tesorero que entraba al área
 * de hermanos a ver su perfil se llevaba la cookie corta del CMS sin estar en
 * el CMS.
 *
 * Con «Recordarme» (cualquier área, cualquier rol): 72 h, alineadas con el JWT.
 */
export const opcionesCookieSesion = (area: AreaSesion, role: string, recordarme = false): CookieOptions => ({
  ...base(RUTA_SESION),
  ...(recordarme
    ? { maxAge: RECORDARME_SEGUNDOS * 1000 }
    : area === 'cms'
      ? {}
      : { maxAge: duracionSesionSegundos(role) * 1000 })
});

export const ponerCookieSesion = (
  res: Response, area: AreaSesion, token: string, role: string, recordarme = false
): void => {
  res.cookie(nombreCookie(area), token, opcionesCookieSesion(area, role, recordarme));
};

export const ponerCookie2FA = (res: Response, token: string): void => {
  res.cookie(COOKIE_2FA, token, { ...base(RUTA_2FA), maxAge: PENDIENTE_2FA_SEGUNDOS * 1000 });
};

// OJO: borrar una cookie exige repetir su Path exacto. Sin él el navegador
// ignora el borrado y la respuesta sigue siendo un 204 engañoso.
export const limpiarCookieSesion = (res: Response, area: AreaSesion): void => {
  res.clearCookie(nombreCookie(area), base(RUTA_SESION));
};

export const limpiarCookie2FA = (res: Response): void => {
  res.clearCookie(COOKIE_2FA, base(RUTA_2FA));
};

export const limpiarCookiesAuth = (res: Response): void => {
  limpiarCookieSesion(res, 'cms');
  limpiarCookieSesion(res, 'hermanos');
  limpiarCookie2FA(res);
};
