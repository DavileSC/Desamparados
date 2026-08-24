import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import process from 'node:process';

// ================== VALIDACIÓN DE VARIABLES DE ENTORNO ==================
// Patrón "Fail-Fast": Si falta una variable crítica, la aplicación no debe arrancar.
const requiredEnvVars = [
  'DATABASE_HOST',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME'
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`Error: La variable de entorno '${varName}' es obligatoria y no está definida.`);
  }
}
// =======================================================================

// Ahora podemos usar las variables con la certeza de que existen.
// El '!' (non-null assertion) es seguro aquí gracias a la validación anterior.
const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST!,
  user: process.env.DATABASE_USER!,
  password: process.env.DATABASE_PASSWORD!,
  database: process.env.DATABASE_NAME!,
  connectionLimit: 5
});

const prisma = new PrismaClient({
  adapter,
  // RED DE SEGURIDAD (fuga de secretos): por defecto NINGUNA consulta a User devuelve
  // el hash de contraseña, el secreto TOTP ni el token de reset. Los pocos sitios que
  // los necesitan de verdad (login, verificación 2FA, borrado de cuenta) deben pedirlos
  // explícitamente con `omit: { password: false }` en esa consulta concreta.
  omit: {
    user: {
      password: true,
      twoFactorSecret: true,
      resetPasswordToken: true,
      resetPasswordExpires: true
    }
  }
});

export default prisma;
