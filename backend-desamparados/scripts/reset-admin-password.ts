// Genera una contraseña nueva para una cuenta de administrador y cierra sus
// sesiones abiertas. Para cuando nadie puede entrar en el CMS.
//
// Uso (desde backend-desamparados):
//   npm run admin:nueva-contrasena -- secretaria@ejemplo.org
//   ADMIN_EMAIL=secretaria@ejemplo.org npm run admin:nueva-contrasena
//   npm run admin:nueva-contrasena          → pregunta el correo
//
// No hay correo por defecto: antes era `admin@cofradia.com`, la cuenta de la
// siembra de desarrollo, y en producción ese dominio es ajeno. Mejor que
// pregunte a que cambie la contraseña de una cuenta que no es la que se quería.
import crypto from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Role } from '@prisma/client';
import db from '../src/config/db.js';
import { encrypt } from '../src/utils/bcrypt.handle.js';
import { corteDeSesiones } from '../src/utils/jwt.handle.js';

async function pedirCorreo(): Promise<string> {
  const argumento = process.argv[2]?.trim();
  if (argumento) return argumento;
  if (process.env.ADMIN_EMAIL?.trim()) return process.env.ADMIN_EMAIL.trim();

  if (!process.stdin.isTTY) {
    throw new Error('Indica el correo del administrador: como argumento o con ADMIN_EMAIL.');
  }
  const consola = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await consola.question('Correo del administrador: ')).trim();
  } finally {
    consola.close();
  }
}

try {
  const email = await pedirCorreo();
  if (!email) throw new Error('No se ha indicado ningún correo.');

  const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user) throw new Error(`No existe ninguna cuenta con el correo ${email}.`);
  if (user.role !== Role.ADMIN) {
    throw new Error(`La cuenta ${email} no es de administrador (rol ${user.role}): este script solo rescata administradores.`);
  }

  const password = crypto.randomBytes(18).toString('base64url');
  await db.user.update({
    where: { id: user.id },
    data: {
      // El mismo hash que el resto de la aplicación (bcrypt, 10 rondas).
      password: await encrypt(password),
      // Invalida las sesiones abiertas: si alguien tenía la cuenta, la pierde.
      tokenValidAfter: corteDeSesiones(),
    },
  });

  console.log(JSON.stringify({ email, password }));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
