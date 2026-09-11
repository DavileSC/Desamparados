// Desactiva el doble factor de una cuenta desde la consola del servidor.
//
// Para cuando nadie puede hacerlo desde el CMS: el rescate de allí es solo de
// ADMIN y nunca sobre uno mismo, así que si todos los ADMIN tienen 2FA y lo
// pierden (móvil perdido, o TOTP_ENC_KEY cambiada sin conservar la anterior),
// nadie entra. Quien tiene la consola ya tiene la base de datos: no se le pide
// más, pero queda en la auditoría como 2FA_RESET_ADMIN con `via: 'consola'`.
//
// Apaga el 2FA, borra los códigos de respaldo y cierra las sesiones de la
// cuenta. Después, esa persona entra solo con contraseña y vuelve a activarlo
// desde «Mi seguridad».
//
// Uso (desde backend-desamparados):
//   npm run 2fa:rescatar -- secretaria@ejemplo.org
//   RESCATE_EMAIL=secretaria@ejemplo.org npm run 2fa:rescatar
//   npm run 2fa:rescatar          → pregunta el correo
import { createInterface } from 'node:readline/promises';
import db from '../src/config/db.js';
import { AuthService } from '../src/services/auth.service.js';

async function pedirCorreo(): Promise<string> {
  const argumento = process.argv[2]?.trim();
  if (argumento) return argumento;
  if (process.env.RESCATE_EMAIL?.trim()) return process.env.RESCATE_EMAIL.trim();

  if (!process.stdin.isTTY) {
    throw new Error('Indica el correo de la cuenta: como argumento o con RESCATE_EMAIL.');
  }
  const consola = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await consola.question('Correo de la cuenta a la que quitar el doble factor: ')).trim();
  } finally {
    consola.close();
  }
}

try {
  const email = await pedirCorreo();
  if (!email) throw new Error('No se ha indicado ningún correo.');

  const { id, role, antes } = await AuthService.rescatar2FADesdeConsola(email);
  console.log(
    antes.twoFactorEnabled
      ? `Doble factor desactivado para ${email} (usuario ${id}, ${role}). Sus sesiones se han cerrado: ` +
        'que entre con su contraseña y lo vuelva a activar desde «Mi seguridad».'
      : `La cuenta ${email} (usuario ${id}) no tenía el doble factor activo. Aun así se han limpiado sus restos y cerrado sus sesiones.`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
