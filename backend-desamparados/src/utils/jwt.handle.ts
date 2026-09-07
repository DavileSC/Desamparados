// 1. Importamos todo el paquete como "jwt"
import jwt from 'jsonwebtoken';
// 2. Importamos JwtPayload explícitamente como un "Type"
import type { JwtPayload } from 'jsonwebtoken';
// 3. Los roles deciden cuanto dura la sesion
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Falta la variable de entorno JWT_SECRET en el archivo .env");
}

// En producción exigimos un secret robusto: un secret corto/corto-conocido
// permite ataques de fuerza bruta offline sobre los tokens firmados.
if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET inseguro para producción: usa al menos 32 caracteres. " +
    "Genera uno con: npm run gen:secret"
  );
}

// 4. LOS DOS TIPOS DE TOKEN
/**
 * Los dos JWT los firma el mismo secreto, asi que sin un claim que los
 * distinga el testigo de "2FA pendiente" -que ya identifica a un usuario-
 * serviria como token de sesion y permitiria saltarse el segundo factor.
 */
export type TokenType = 'session' | '2fa_pending';

export interface AuthTokenPayload extends JwtPayload {
  id: number;   // <-- OJO: Lo llamamos 'id' para que encaje con tus controladores (req.user!.id)
  role: string;
  typ: TokenType;
  // Solo en el testigo de 2FA: si marcó "recordarme" en el primer factor, el
  // segundo (que es el que crea la sesión real) debe respetarlo.
  rem?: boolean;
  // De qué login nació la sesión. El CMS solo acepta tokens creados desde
  // /cms/acceso, donde se exige el segundo factor cuando está activado.
  origen?: 'cms' | 'hermanos';
}

// Roles con acceso al CMS. Su sesion dura mas, pero la cookie muere al cerrar
// el navegador (ver utils/cookies.ts): se usan desde equipos compartidos.
const ROLES_STAFF: string[] = [
  Role.ADMIN,
  Role.TESORERIA,
  Role.ALBACERIA,
  Role.HERMANO_MAYOR,
  Role.REDES,
  Role.SECRETARIA
];

export const esStaff = (role: string): boolean => ROLES_STAFF.includes(role);

/** 8 h para el staff del CMS, 4 h para los hermanos del area familiar */
export const duracionSesionSegundos = (role: string): number =>
  esStaff(role) ? 8 * 3600 : 4 * 3600;

/**
 * Duración de la sesión cuando se marca "Recordarme": 72 h desde el login,
 * para cualquier rol. Es una ventana fija: la actividad no la renueva.
 */
export const RECORDARME_SEGUNDOS = 72 * 3600;

/** El paso intermedio del 2FA caduca pronto: es solo para teclear un codigo */
export const PENDIENTE_2FA_SEGUNDOS = 5 * 60;

// Generar Token de sesion
const generateToken = (
  userId: number,
  role: string,
  recordarme = false,
  origen: 'cms' | 'hermanos' = 'cms'
): string => {
  const jwtSigned = jwt.sign(
    { id: userId, role, typ: 'session', origen }, // <-- Guardamos el valor en la propiedad 'id'
    JWT_SECRET,
    {
      expiresIn: recordarme ? RECORDARME_SEGUNDOS : duracionSesionSegundos(role),
      algorithm: 'HS256'
    }
  );
  return jwtSigned;
};

/**
 * Prueba de que se supero el primer factor (la contrasena). Sin esto, el
 * endpoint del 2FA aceptaba un userId suelto del body y el segundo factor
 * quedaba desvinculado del primero.
 */
const generatePending2FAToken = (
  userId: number,
  recordarme = false,
  origen: 'cms' | 'hermanos' = 'cms'
): string => {
  return jwt.sign(
    { id: userId, role: '', typ: '2fa_pending', rem: recordarme, origen },
    JWT_SECRET,
    {
      expiresIn: PENDIENTE_2FA_SEGUNDOS,
      algorithm: 'HS256'
    }
  );
};

// Verificar Token: el tipo esperado es obligatorio, para que un token de un
// tipo no pueda usarse en el sitio del otro.
const verifyToken = (jwtToken: string, expectedType: TokenType): AuthTokenPayload | null => {
  try {
    // Casteamos (as) directamente a nuestra interfaz, no a JwtPayload generico
    // algorithms explicito: defendemos contra tokens firmados con otro algoritmo (ej. 'none')
    const payload = jwt.verify(jwtToken, JWT_SECRET, { algorithms: ['HS256'] }) as AuthTokenPayload;
    if (payload.typ !== expectedType) return null;
    return payload;
  } catch (e) {
    return null;
  }
};

export { generateToken, generatePending2FAToken, verifyToken };
