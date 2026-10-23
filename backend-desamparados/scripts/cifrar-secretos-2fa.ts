/**
 * Cifra los secretos del doble factor que sigan en claro, y pasa a la clave
 * actual los que estén cifrados con la anterior.
 *
 * Desde el 11-09-2026 `User.twoFactorSecret` se guarda cifrado con
 * AES-256-GCM (clave en TOTP_ENC_KEY, ver src/utils/cifrado-totp.ts). Los
 * secretos antiguos siguen funcionando y se cifran solos la próxima vez que su
 * dueño usa el 2FA, pero el de un cargo que no entra en meses seguiría en claro
 * en cada copia de seguridad hasta entonces. Este script los cifra todos de una
 * vez.
 *
 * También es el paso central de una rotación de la clave: con la nueva en
 * TOTP_ENC_KEY y la vieja en TOTP_ENC_KEY_ANTERIOR, reescribe con la nueva
 * todo lo que estaba con la vieja. Cuando termina sin ilegibles, la anterior
 * ya puede quitarse (ver «Rotar TOTP_ENC_KEY» en docs/despliegue.md).
 *
 * Idempotente: los ya cifrados con la clave actual se saltan, así que puede
 * ejecutarse cuantas veces haga falta. Los cifrados con la clave derivada de
 * desarrollo se reescriben con TOTP_ENC_KEY si ya está definida.
 *
 * Uso (con el .env del entorno que se quiere migrar):
 *   npm run 2fa:cifrar-secretos
 */
import db from '../src/config/db.js';
import { DobleFactorService } from '../src/services/doble-factor.service.js';

try {
  const { revisados, cifrados, ilegibles } = await DobleFactorService.cifrarSecretosPendientes();
  console.log(`Secretos 2FA revisados: ${revisados}. Cifrados o recifrados ahora: ${cifrados}.`);

  if (ilegibles.length > 0) {
    // No se tocan: con la clave buena en TOTP_ENC_KEY_ANTERIOR podrían
    // recuperarse. Si la clave se perdió, cada una de esas cuentas necesita el
    // rescate (npm run 2fa:rescatar) y volver a activar su doble factor.
    console.error(
      `No se han podido descifrar ${ilegibles.length} secreto(s) (usuarios ${ilegibles.join(', ')}) ` +
      'ni con TOTP_ENC_KEY ni con TOTP_ENC_KEY_ANTERIOR. No quites la clave anterior hasta resolverlo.'
    );
    process.exitCode = 1;
  } else if (process.env.TOTP_ENC_KEY_ANTERIOR?.trim()) {
    console.log('Todo está ya con la clave actual: puedes quitar TOTP_ENC_KEY_ANTERIOR y reiniciar el servicio.');
  }
} finally {
  await db.$disconnect();
}
