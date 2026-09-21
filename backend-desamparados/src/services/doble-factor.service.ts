import db from '../config/db';
import * as OTPAuth from 'otpauth';
import qrcode from 'qrcode';
import { corteDeSesiones } from '../utils/jwt.handle';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { cifrarSecretoTotp, leerSecretoTotp, SecretoTotpIlegibleError } from '../utils/cifrado-totp.js';
import {
  APAGAR_2FA, MENSAJE_2FA_YA_ACTIVO, MENSAJE_CODIGO_USADO,
  comprobarBloqueo2FA, consumirCodigoDeRespaldo, generarCodigosDeRespaldo,
  hashDeCodigoDeRespaldo, limpiarFallos2FA, reclamarTotp, registrarFallo2FA,
} from './auth/codigos-2fa.js';

/**
 * El doble factor de una cuenta: activarlo, desactivarlo y rescatarlo.
 *
 * Es lo que se hace desde «Mi seguridad» y, en un apuro, desde el CMS o la
 * consola del servidor. Comprobarlo al entrar no está aquí: eso es parte del
 * acceso (`AuthService.verifyLogin2FA`). Lo que comparten —cómo se valida un
 * código, el contador de fallos, cómo se lee el secreto— vive en
 * `auth/codigos-2fa`, que no es de ninguno de los dos.
 */
export class DobleFactorService {

  static async generate2FAQR(userId: number) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    // Con el 2FA activo, generar pisaba el secreto en uso: la app del móvil
    // dejaba de valer y quien tuviera una sesión abierta podía cambiar el
    // segundo factor por uno suyo sin conocer el vigente.
    if (user.twoFactorEnabled) throw new HttpError(MENSAJE_2FA_YA_ACTIVO, 409);

    // 1. Generamos un nuevo secreto aleatorio (20 bytes es el estándar)
    const secret = new OTPAuth.Secret({ size: 20 });

    // 2. Creamos el objeto TOTP
    const totp = new OTPAuth.TOTP({
      issuer: 'Cofradía Virtual',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret
    });

    // 3. Obtenemos la URL otpauth://... automáticamente
    const otpauthUrl = totp.toString();

    // 4. Generamos imagen QR
    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

    // 5. Guardamos el secreto cifrado. Condicionado a que siga apagado: si se
    // activó entre la lectura y aquí, no se pisa.
    const { count } = await db.user.updateMany({
      where: { id: userId, twoFactorEnabled: false },
      data: { twoFactorSecret: cifrarSecretoTotp(secret.base32) }
    });
    if (count !== 1) throw new HttpError(MENSAJE_2FA_YA_ACTIVO, 409);

    // En claro solo en esta respuesta: es la clave para quien no puede escanear el QR.
    return { qrCodeUrl, secret: secret.base32 };
  }

  /**
   * `comprobar` se puede sustituir, como el cliente de `consumirCodigoDeRespaldo`:
   * es el único punto donde otra pestaña puede colarse entre la comprobación
   * del código y la escritura, y la prueba de esa carrera necesita meterse
   * justo ahí (test/auth-revision).
   */
  static async enable2FA(userId: number, token2fa: string, comprobar = reclamarTotp) {
    const user = await db.user.findUnique({ where: { id: userId }, omit: { twoFactorSecret: false } });
    if (!user || !user.twoFactorSecret) throw new HttpError('Falta generar el QR.');
    if (user.twoFactorEnabled) throw new HttpError(MENSAJE_2FA_YA_ACTIVO, 409);

    const { resultado, guardado } = await comprobar(user, token2fa.trim());
    if (resultado === 'usado') throw new HttpError(MENSAJE_CODIGO_USADO);
    if (resultado !== 'ok') throw new HttpError('Código incorrecto.');

    // Generamos los códigos de respaldo (de un solo uso) y guardamos solo su hash
    const backupCodes = generarCodigosDeRespaldo(8);

    await db.$transaction(async (tx) => {
      // Se activa el secreto que se ha comprobado y no otro. Sin la condición,
      // un «generar QR» de otra pestaña que llegara entre la comprobación y
      // aquí dejaba el 2FA activo con un secreto que nadie había escaneado, y
      // la cuenta fuera del CMS hasta un rescate.
      const { count } = await tx.user.updateMany({
        where: { id: userId, twoFactorEnabled: false, twoFactorSecret: guardado },
        data: { twoFactorEnabled: true }
      });
      if (count !== 1) {
        throw new HttpError('El QR ha cambiado mientras lo activabas (quizá desde otra pestaña). Genera uno nuevo y escanéalo otra vez.', 409);
      }
      // Por si reactivaba después de un disable forzado, limpiamos restos primero
      await tx.twoFactorBackupCode.deleteMany({ where: { userId } });
      await tx.twoFactorBackupCode.createMany({
        data: backupCodes.map(code => ({ userId, codeHash: hashDeCodigoDeRespaldo(code) }))
      });
    });

    // OJO: los códigos en claro se devuelven UNA sola vez aquí.
    // El frontend debe pedirle al usuario que los guarde (papel, gestor de contraseñas...).
    return {
      message: '2FA activado correctamente. Guarda tus códigos de respaldo ahora: no volverán a mostrarse.',
      backupCodes
    };
  }

  /**
   * DESACTIVAR 2FA (por el propio usuario)
   * Requiere el código TOTP vigente o un código de respaldo (cambio/perdida de móvil).
   *
   * Comparte el contador de fallos con el login 2FA: sin él, quien tuviera la
   * contraseña de un cargo podía probar códigos aquí sin límite. Los fallos
   * responden 400 y no 401 a propósito: el frontend trata un 401 como sesión
   * caducada y echaría al usuario por teclear mal un código.
   */
  static async disable2FA(userId: number, code: string) {
    comprobarBloqueo2FA(userId);

    const user = await db.user.findUnique({ where: { id: userId }, omit: { twoFactorSecret: false } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) throw new HttpError('2FA no está activado.');

    const normalized = code.trim().toUpperCase();

    if (/^[0-9]{6}$/.test(normalized)) {
      const { resultado } = await reclamarTotp(user, normalized);
      if (resultado !== 'ok') {
        registrarFallo2FA(userId);
        throw new HttpError(resultado === 'usado' ? MENSAJE_CODIGO_USADO : 'Código incorrecto.');
      }
    } else {
      const consumed = await consumirCodigoDeRespaldo(userId, normalized);
      if (!consumed) {
        registrarFallo2FA(userId);
        throw new HttpError('Código incorrecto.');
      }
    }

    limpiarFallos2FA(userId);

    return await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { ...APAGAR_2FA }
      });
      await tx.twoFactorBackupCode.deleteMany({ where: { userId } });
      return { message: '2FA desactivado. Podrás volver a activarlo generando un QR nuevo.' };
    });
  }

  /**
   * DESACTIVAR 2FA FORZADO (Rescate de emergencia: solo ADMIN)
   * No pide código porque lo invoca la mesa del Grupo Parroquial tras verificar la identidad.
   *
   * Nunca sobre la propia cuenta: un rescate sin código sobre uno mismo es
   * quitarse el segundo factor sin demostrar que se tiene. Para eso está la
   * desactivación con código de «Mi seguridad».
   */
  static async forceDisable2FA(targetUserId: number, actorId: number, meta?: MetaDeAuditoria) {
    if (targetUserId === actorId) {
      throw new HttpError('No puedes rescatar tu propia cuenta. Desactiva tu doble factor desde «Mi seguridad» con un código vigente.', 403);
    }

    const antes = await this.apagar2FAForzado(targetUserId);

    // Auditoría: rescate de emergencia sobre la cuenta de otro usuario, ya confirmado
    await AuditoriaService.log(ACCIONES_AUDITORIA.TFa_RESET_ADMIN, meta ?? {}, 'user', targetUserId, {
      antes,
      despues: { twoFactorEnabled: false, codigosRespaldoSinUsar: 0 },
      sesionesCerradas: true
    });
    return { message: '2FA desactivado por un administrador.' };
  }

  /**
   * Rescate desde la consola del servidor (`npm run 2fa:rescatar`), para
   * cuando no queda nadie que pueda hacerlo desde el CMS: todos los ADMIN con
   * 2FA y el móvil perdido, o la clave del 2FA perdida. Quien tiene la consola
   * ya tiene la base de datos, así que no se le pide más; sí queda auditado.
   */
  static async rescatar2FADesdeConsola(email: string) {
    const emailNorm = email.trim().toLowerCase();
    const objetivo = await db.user.findUnique({ where: { email: emailNorm }, select: { id: true, role: true } });
    if (!objetivo) throw new NotFoundError(`No existe ninguna cuenta con el correo ${emailNorm}.`);

    const antes = await this.apagar2FAForzado(objetivo.id);

    await AuditoriaService.log(
      ACCIONES_AUDITORIA.TFa_RESET_ADMIN,
      { ip: 'consola', userAgent: 'scripts/rescatar-2fa.ts' },
      'user',
      objetivo.id,
      { via: 'consola', antes, despues: { twoFactorEnabled: false, codigosRespaldoSinUsar: 0 }, sesionesCerradas: true }
    );
    return { id: objetivo.id, email: emailNorm, role: objetivo.role, antes };
  }

  /**
   * Lo común a los dos rescates: apaga el 2FA, borra los respaldos y cierra
   * las sesiones. Leer y escribir en la misma transacción: un id inexistente
   * da 404 en vez del 500 que daba el P2025 del update.
   */
  private static async apagar2FAForzado(targetUserId: number) {
    return db.$transaction(async (tx) => {
      const objetivo = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { twoFactorEnabled: true }
      });
      if (!objetivo) throw new NotFoundError('Usuario no encontrado');

      const codigosRespaldoSinUsar = await tx.twoFactorBackupCode.count({
        where: { userId: targetUserId, usedAt: null }
      });

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          ...APAGAR_2FA,
          // Rescate de emergencia: se invalidan sus sesiones por seguridad
          tokenValidAfter: corteDeSesiones()
        }
      });
      await tx.twoFactorBackupCode.deleteMany({ where: { userId: targetUserId } });

      return { twoFactorEnabled: objetivo.twoFactorEnabled, codigosRespaldoSinUsar };
    });
  }

  /**
   * Cifra los secretos 2FA que sigan en claro o con una clave que ya no es la
   * principal (TOTP_ENC_KEY_ANTERIOR tras una rotación). Idempotente: los
   * cifrados con la clave actual se saltan. Lo usa
   * `scripts/cifrar-secretos-2fa.ts`; `soloIds` acota la pasada (para los tests).
   */
  static async cifrarSecretosPendientes(soloIds?: number[]) {
    const usuarios = await db.user.findMany({
      where: { twoFactorSecret: { not: null }, ...(soloIds ? { id: { in: soloIds } } : {}) },
      select: { id: true, twoFactorSecret: true }
    });

    let cifrados = 0;
    const ilegibles: number[] = [];
    for (const { id, twoFactorSecret } of usuarios) {
      let lectura: { secreto: string; recifrar: boolean };
      try {
        lectura = leerSecretoTotp(twoFactorSecret!);
      } catch (e) {
        if (!(e instanceof SecretoTotpIlegibleError)) throw e;
        // Cifrado con una clave que ya no se tiene: no se toca, se informa.
        ilegibles.push(id);
        continue;
      }
      if (!lectura.recifrar) continue;

      // Condicionado al valor leído, como el cifrado al vuelo del login.
      const { count } = await db.user.updateMany({
        where: { id, twoFactorSecret },
        data: { twoFactorSecret: cifrarSecretoTotp(lectura.secreto) }
      });
      cifrados += count;
    }

    return { revisados: usuarios.length, cifrados, ilegibles };
  }
}
