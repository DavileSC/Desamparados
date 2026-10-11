import crypto from 'crypto';
import * as OTPAuth from 'otpauth';
import db from '../../config/db';
import { HttpError } from '../../utils/error.handle';
import { EmailService } from '../email.service.js';
import { ContadorFallos } from '../../utils/contador-fallos.js';
import { cifrarSecretoTotp, leerSecretoTotp, SecretoTotpIlegibleError } from '../../utils/cifrado-totp.js';

/**
 * Lo que el doble factor sabe hacer con un código: comprobarlo, gastarlo y no
 * dejar que se gaste dos veces.
 *
 * Vive aparte porque lo usan los dos lados y ninguno es su dueño: el **acceso**
 * comprueba el segundo factor al entrar (`AuthService.verifyLogin2FA`) y **«Mi
 * seguridad»** lo activa y lo desactiva (`DobleFactorService`). Mientras todo
 * esto estaba en un fichero de 1.200 líneas eran métodos privados, y la única
 * manera de usarlos desde otro sitio era no separar nunca los dos temas.
 */

const MINUTO = 60 * 1000;
const UNA_HORA = 60 * MINUTO;

/**
 * Cuánto dura cada bloqueo seguido del doble factor: 15 min, 1 h, 4 h y, de
 * ahí en adelante, un día. Con un bloqueo fijo de quince minutos, quien tenía
 * la contraseña de un cargo podía probar veinte códigos por hora sin fin.
 */
export const ESCALADA_BLOQUEO_2FA = [15 * MINUTO, UNA_HORA, 4 * UNA_HORA, 24 * UNA_HORA];

export const MENSAJE_CODIGO_USADO = 'Ese código ya se ha usado. Espera a que tu aplicación muestre el siguiente.';
export const MENSAJE_2FA_YA_ACTIVO = 'El doble factor ya está activo. Desactívalo primero si quieres configurarlo con otro móvil.';

// Un secreto que no se puede descifrar es un fallo de configuración del
// servidor (la clave cambió sin conservar la anterior), no del usuario: el
// mensaje no puede decirle que su código está mal.
const MENSAJE_SECRETO_ILEGIBLE =
  'No se puede comprobar tu doble factor por un problema de configuración del servidor. ' +
  'Avisa al administrador: puede desactivártelo para que vuelvas a entrar.';

type ResultadoTotp = 'ok' | 'incorrecto' | 'usado';

// Todo lo que se deja a cero al apagar el 2FA, por el propio usuario o por un
// rescate. `twoFactorLastStep` también: si se quedaba el intervalo del código
// usado para desactivar, reactivar enseguida con el secreto nuevo daba «Ese
// código ya se ha usado» (el intervalo es el mismo aunque el secreto no).
export const APAGAR_2FA = { twoFactorEnabled: false, twoFactorSecret: null, twoFactorLastStep: null } as const;

// Contador de intentos fallidos de 2FA por cuenta (defensa contra fuerza bruta
// distribuida, que el rate limiter por IP no cubre). Lo comparten el login con
// 2FA y la desactivación: si cada uno llevara el suyo, quien tuviera la
// contraseña probaría cinco códigos en uno y otros cinco en el otro. Por eso
// vive aquí y no dentro de ninguno de los dos servicios.
// Las tandas se olvidan con un acierto o tras un día entero sin fallar
// después del último bloqueo.
const fallos2FA = new ContadorFallos({
  maxFallos: 5, bloqueoMs: ESCALADA_BLOQUEO_2FA[0], escaladaMs: ESCALADA_BLOQUEO_2FA,
  ventanaMs: UNA_HORA, olvidoTandasMs: 24 * UNA_HORA, tope: 10_000
});

/** «15 minutos», «1 hora», «4 horas»: lo que dura un bloqueo, para leerlo. */
export function textoDePlazo(ms: number): string {
  const minutos = Math.max(1, Math.ceil(ms / MINUTO));
  if (minutos < 60) return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
  const horas = Math.ceil(minutos / 60);
  return horas === 1 ? '1 hora' : `${horas} horas`;
}

export function comprobarBloqueo2FA(userId: number): void {
  const restante = fallos2FA.restanteBloqueo(String(userId));
  if (restante > 0) {
    throw new HttpError(`Demasiados intentos fallidos. Cuenta bloqueada temporalmente: espera ${textoDePlazo(restante)}.`, 429);
  }
}

/**
 * Apunta un código equivocado. Si con él empieza un bloqueo, se avisa al
 * titular por correo (uno por tanda, no uno por fallo), sin esperar: el
 * aviso no puede retrasar ni tumbar la respuesta.
 */
export function registrarFallo2FA(userId: number): void {
  const bloqueo = fallos2FA.registrarFallo(String(userId));
  if (bloqueo > 0) {
    avisarBloqueo2FA(userId, bloqueo).catch((error) => console.error('[2FA] No se pudo avisar del bloqueo:', error));
  }
}

async function avisarBloqueo2FA(userId: number, bloqueoMs: number): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, nombre: true, hermanos: { where: { esTitular: true }, select: { sexo: true }, take: 1 } },
  });
  if (!user) return false;
  return EmailService.enviarDobleFactorBloqueado(user.email, user.nombre, textoDePlazo(bloqueoMs), user.hermanos[0]?.sexo ?? undefined);
}

export function limpiarFallos2FA(userId: number): void {
  fallos2FA.limpiar(String(userId));
}

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L)
const BACKUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generarCodigosDeRespaldo(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw = '';
    for (let j = 0; j < 12; j++) {
      raw += BACKUP_ALPHABET[crypto.randomInt(BACKUP_ALPHABET.length)];
    }
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`);
  }
  return codes;
}

/**
 * El código tal como se compara: sin espacios, en mayúsculas y, si es de
 * respaldo, con sus guiones. En el móvil el teclado escribe en minúsculas y hay
 * apps que enseñan el TOTP partido («863 427»); rechazar eso dejaba fuera a
 * quien había perdido el móvil justo con el código bueno en la mano.
 */
export function normalizarCodigo2FA(code: string): string {
  const c = code.trim().toUpperCase();
  const totp = /^([0-9]{3})\s?([0-9]{3})$/.exec(c);
  if (totp) return totp[1] + totp[2];
  // Solo se recolocan los guiones de lo que tiene forma de código de respaldo;
  // lo demás se compara tal cual y, si no es de nadie, falla como siempre.
  const respaldo = /^([A-Z0-9]{4})[\s-]?([A-Z0-9]{4})[\s-]?([A-Z0-9]{4})$/.exec(c);
  return respaldo ? respaldo.slice(1).join('-') : c;
}

export function hashDeCodigoDeRespaldo(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Consume un código de respaldo (de un solo uso). Devuelve true si era válido.
 *
 * En una sola sentencia condicionada a `usedAt: null`: antes se leía y luego
 * se escribía, y de dos peticiones simultáneas con el mismo código la que
 * perdía se encontraba el registro ya cambiado y acababa en un 500.
 */
export async function consumirCodigoDeRespaldo(
  userId: number,
  code: string,
  cliente: Pick<typeof db, 'twoFactorBackupCode'> = db
): Promise<boolean> {
  const { count } = await cliente.twoFactorBackupCode.updateMany({
    where: { userId, codeHash: hashDeCodigoDeRespaldo(code), usedAt: null },
    data: { usedAt: new Date() }
  });
  return count === 1;
}

/** Intervalo TOTP en curso (el contador de 30 s del RFC 6238). */
export function pasoTotpActual(ahora = Date.now()): number {
  return OTPAuth.TOTP.counter({ period: 30, timestamp: ahora });
}

/**
 * Comprueba un código TOTP y reclama su intervalo en la misma operación.
 *
 * Un código vale todo su intervalo y, con `window: 1`, también el anterior y
 * el siguiente: hasta 90 s en los que quien lo viera por encima del hombro
 * podía reutilizarlo. Se guarda el último intervalo aceptado y se rechaza
 * cualquiera igual o anterior. La escritura es un compare-and-swap sobre el
 * valor leído: de dos peticiones simultáneas con el mismo código, gana una.
 *
 * Devuelve también el secreto tal como queda guardado (cifrado al vuelo si
 * era antiguo), para que quien active el 2FA pueda condicionar su escritura
 * a ese valor exacto.
 */
export async function reclamarTotp(
  user: { id: number; twoFactorSecret: string | null; twoFactorLastStep: number | null },
  codigo: string
): Promise<{ resultado: ResultadoTotp; guardado: string | null }> {
  if (!user.twoFactorSecret) return { resultado: 'incorrecto', guardado: null };
  const { secreto, guardado } = await secretoEnClaro(user.id, user.twoFactorSecret);

  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secreto)
  });

  // window: 1 permite un margen de +/- 30 segundos por si el reloj no está sincro
  const ahora = Date.now();
  const delta = totp.validate({ token: codigo, window: 1, timestamp: ahora });
  if (delta === null) return { resultado: 'incorrecto', guardado };

  const paso = pasoTotpActual(ahora) + delta;
  if (user.twoFactorLastStep !== null && paso <= user.twoFactorLastStep) return { resultado: 'usado', guardado };

  const { count } = await db.user.updateMany({
    where: { id: user.id, twoFactorLastStep: user.twoFactorLastStep },
    data: { twoFactorLastStep: paso }
  });
  return { resultado: count === 1 ? 'ok' : 'usado', guardado };
}

/**
 * Descifra el secreto guardado. Los antiguos en claro (o cifrados con una
 * clave que ya no es la principal) se reescriben cifrados al leerlos, para
 * que la migración no dependa solo de acordarse de ejecutar el script.
 *
 * Si no se puede descifrar con ninguna clave configurada, el fallo es del
 * servidor: queda en el registro con la cuenta afectada y al usuario se le
 * dice eso, no que su código está mal (antes salía un 500 con «Código 2FA
 * incorrecto», y el cargo seguía probando códigos buenos).
 */
async function secretoEnClaro(userId: number, almacenado: string): Promise<{ secreto: string; guardado: string }> {
  let lectura: { secreto: string; recifrar: boolean };
  try {
    lectura = leerSecretoTotp(almacenado);
  } catch (e) {
    if (!(e instanceof SecretoTotpIlegibleError)) throw e;
    console.error(`[2FA] Secreto ilegible del usuario ${userId}. ${e.message} Rescate: npm run 2fa:rescatar -- <correo>.`);
    throw new HttpError(MENSAJE_SECRETO_ILEGIBLE, 500);
  }

  if (!lectura.recifrar) return { secreto: lectura.secreto, guardado: almacenado };

  // Condicionado al valor leído: si entre medias se desactivó o ya lo
  // reescribió otra petición, no se pisa. Y si falla, el login sigue: el
  // secreto ya está en memoria y el script lo cifrará después.
  const nuevo = cifrarSecretoTotp(lectura.secreto);
  try {
    const { count } = await db.user.updateMany({
      where: { id: userId, twoFactorSecret: almacenado },
      data: { twoFactorSecret: nuevo }
    });
    return { secreto: lectura.secreto, guardado: count === 1 ? nuevo : almacenado };
  } catch (e) {
    console.error('[2FA] No se pudo cifrar un secreto antiguo al leerlo:', e);
    return { secreto: lectura.secreto, guardado: almacenado };
  }
}
