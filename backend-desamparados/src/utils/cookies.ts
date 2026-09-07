import type { CookieOptions, Response } from 'express';
import { duracionSesionSegundos, esStaff, PENDIENTE_2FA_SEGUNDOS, RECORDARME_SEGUNDOS } from './jwt.handle.js';

export const COOKIE_SESION = 'desamparados_session';
export const COOKIE_2FA = 'desamparados_2fa';

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
 * Staff del CMS: sin maxAge, o sea cookie de sesión que muere al cerrar el
 * navegador (el CMS se usa desde equipos compartidos de la casa parroquial).
 * Hermanos: persiste, con el mismo tope que el JWT para que no lo sobreviva.
 *
 * Con "Recordarme" ( cualquier rol ): cookie persistente de 72 h, alineada con
 * el JWT para que ninguna de las dos sobreviva a la otra.
 */
export const opcionesCookieSesion = (role: string, recordarme = false): CookieOptions => ({
  ...base(RUTA_SESION),
  ...(recordarme
    ? { maxAge: RECORDARME_SEGUNDOS * 1000 }
    : esStaff(role)
      ? {}
      : { maxAge: duracionSesionSegundos(role) * 1000 })
});

export const ponerCookieSesion = (res: Response, token: string, role: string, recordarme = false): void => {
  res.cookie(COOKIE_SESION, token, opcionesCookieSesion(role, recordarme));
};

export const ponerCookie2FA = (res: Response, token: string): void => {
  res.cookie(COOKIE_2FA, token, { ...base(RUTA_2FA), maxAge: PENDIENTE_2FA_SEGUNDOS * 1000 });
};

// OJO: borrar una cookie exige repetir su Path exacto. Sin él el navegador
// ignora el borrado y la respuesta sigue siendo un 204 engañoso.
export const limpiarCookie2FA = (res: Response): void => {
  res.clearCookie(COOKIE_2FA, base(RUTA_2FA));
};

export const limpiarCookiesAuth = (res: Response): void => {
  res.clearCookie(COOKIE_SESION, base(RUTA_SESION));
  limpiarCookie2FA(res);
};
