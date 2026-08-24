// 1. Importamos todo el paquete como "jwt"
import jwt from 'jsonwebtoken';
// 2. Importamos JwtPayload explícitamente como un "Type"
import type { JwtPayload } from 'jsonwebtoken';

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

// 3. DEFINIMOS LA INTERFAZ AQUÍ (Y la exportamos para que el middleware la pueda usar)
export interface AuthTokenPayload extends JwtPayload {
  id: number;   // <-- OJO: Lo llamamos 'id' para que encaje con tus controladores (req.user!.id)
  role: string;
}

// Generar Token
const generateToken = (userId: number, role: string): string => {
  const jwtSigned = jwt.sign(
    { id: userId, role }, // <-- Guardamos el valor en la propiedad 'id'
    JWT_SECRET,
    { 
      expiresIn: '8h',
      algorithm: 'HS256' 
    }
  );
  return jwtSigned;
};

// Verificar Token
const verifyToken = (jwtToken: string): AuthTokenPayload | null => {
  try {
    // 4. Casteamos (as) directamente a nuestra nueva interfaz, no a JwtPayload genérico
    // algorithms explícito: defendemos contra tokens firmados con otro algoritmo (ej. 'none')
    return jwt.verify(jwtToken, JWT_SECRET, { algorithms: ['HS256'] }) as AuthTokenPayload;
  } catch (e) {
    return null; 
  }
};

export { generateToken, verifyToken };