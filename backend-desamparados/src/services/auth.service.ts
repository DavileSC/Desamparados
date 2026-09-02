import db from '../config/db';
import { encrypt, verified } from '../utils/bcrypt.handle';
import { generateToken, generatePending2FAToken } from '../utils/jwt.handle';
import crypto from 'crypto';
import { Prisma, Role } from '@prisma/client';
import { RegisterDto, LoginDto } from '../dtos/auth.dto';
import { AuditService, AUDIT_ACTIONS, AuditMeta } from './audit.service';

// --- NUEVA LIBRERÍA: OTPAUTH ---
import * as OTPAuth from 'otpauth';
import qrcode from 'qrcode';
import { EmailService } from './email.service';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { enmascararEmail } from '../utils/log-privacidad.js';
// -------------------------------

export class AuthService {

  // =================================================================
  //  REGISTRO (Crea Solicitud Inactiva y envía Email Seguro)
  // =================================================================
  static async registerUser({ isTutor, usuario, hermano }: RegisterDto) {
    const checkUser = await db.user.findFirst({
      where: { OR: [{ email: usuario.email }, { dni: usuario.dni }] }
    });
    if (checkUser) throw new HttpError('El email o DNI ya están registrados.', 409);

    if (isTutor) {
      if (!hermano || !hermano.nombre || !hermano.fechaNacimiento) {
        throw new HttpError('Datos del hermano/hijo incompletos.');
      }
      if (hermano.dni) {
        const checkHermano = await db.hermano.findFirst({ where: { dni: hermano.dni } });
        if (checkHermano) throw new HttpError('El DNI del hermano ya existe.', 409);
      }
    } else {
      if (!hermano?.fechaNacimiento) throw new HttpError('Fecha de nacimiento obligatoria.');
    }

    const hashedPassword = await encrypt(usuario.password);

    // 1. TRANSACCIÓN RÁPIDA DE BASE DE DATOS
    const result = await db.$transaction(async (tx) => {
      // Creamos el Usuario BLOQUEADO
      const newUser = await tx.user.create({
        data: {
          email: usuario.email,
          dni: usuario.dni,
          password: hashedPassword,
          role: Role.USER,
          active: false, // <--- Nace bloqueado, pendiente de pago/aprobación
          nombre: usuario.nombre,
          apellidos: usuario.apellidos,
          telefono: usuario.telefono,
          direccion: usuario.direccion,
          poblacion: usuario.poblacion,
          codigoPostal: usuario.codigoPostal
        },
      });

      // Preparamos la ficha del Hermano (SIN datos de procesión)
      const baseHermano = {
        user: { connect: { id: newUser.id } },
        fechaNacimiento: new Date(hermano!.fechaNacimiento),
        telefono: usuario.telefono,
        email: usuario.email,
        direccion: usuario.direccion,
        poblacion: usuario.poblacion,
        codigoPostal: usuario.codigoPostal,
        activo: false // <--- Ficha inactiva también
      };

      let hermanoData: Prisma.HermanoCreateInput;

      if (isTutor && hermano) {
        hermanoData = {
          ...baseHermano,
          esTitular: false,
          nombre: hermano.nombre!,
          apellidos: hermano.apellidos || usuario.apellidos,
          dni: hermano.dni || null,
        };
      } else {
        hermanoData = {
          ...baseHermano,
          esTitular: true,
          nombre: usuario.nombre,
          apellidos: usuario.apellidos,
          dni: usuario.dni,
        };
      }

      // Guardamos la "solicitud"
      const newHermano = await tx.hermano.create({ data: hermanoData });
      
      // Devolvemos los datos para usarlos fuera de la transacción
      return { user: newUser, hermano: newHermano };
    }); 

    // 2. TAREAS ASÍNCRONAS (Envío de Email fuera de la transacción)
    // El "catch" asegura que si falla el email, no se rompa el registro de la API
    EmailService.enviarConfirmacionRegistro(result.user.email, result.user.nombre)
      .catch(error => {
        console.error(`❌ [Error Email] Fallo al enviar el correo de confirmación a ${enmascararEmail(result.user.email)}:`, error);
      });

    // 3. RETORNAMOS LA RESPUESTA AL USUARIO
    return { 
      user: { id: result.user.id, email: result.user.email }, // Retornamos info segura, sin password
      message: 'Solicitud enviada correctamente. Revisa tu email y pásate por Secretaría para formalizar tu alta.'
    };
  }

  // =================================================================
  //  LOGIN (Con Filtro de Solicitud Pendiente y Lockout por Cuenta)
  // =================================================================

  // Lockout por CUENTA en el login de contraseña: complementa al rate limiter
  // por IP (que no cubre ataques distribuidos contra una contraseña concreta).
  private static attemptsLogin = new Map<string, { fails: number; blockedUntil: number }>();
  private static readonly MAX_ATTEMPTS_LOGIN = 5;
  private static readonly LOCKOUT_LOGIN_MS = 15 * 60 * 1000; // 15 minutos

  private static checkLockoutLogin(email: string): void {
    const state = this.attemptsLogin.get(email);
    if (state && state.blockedUntil > Date.now()) {
      const mins = Math.ceil((state.blockedUntil - Date.now()) / 60000);
      throw new HttpError(`Demasiados intentos fallidos. Cuenta bloqueada temporalmente: espera ${mins} minuto(s).`, 429);
    }
  }

  private static registerFailLogin(email: string): void {
    const state = this.attemptsLogin.get(email) ?? { fails: 0, blockedUntil: 0 };
    state.fails += 1;
    if (state.fails >= this.MAX_ATTEMPTS_LOGIN) {
      state.blockedUntil = Date.now() + this.LOCKOUT_LOGIN_MS;
      state.fails = 0;
    }
    this.attemptsLogin.set(email, state);
  }

  static async loginUser({ email, password }: LoginDto) {
    const emailNorm = email.trim().toLowerCase();

    // Bloqueo preventivo antes de gastar una consulta (defensa contra fuerza bruta)
    this.checkLockoutLogin(emailNorm);

    const user = await db.user.findUnique({
      where: { email: emailNorm },
      omit: { password: false }, // Necesario para comparar el hash (el cliente lo oculta por defecto)
      include: {
        hermanos: {
          // Solo perfiles activos: los dados de baja no deben salir en el selector
          where: { activo: true },
          select: { id: true, nombre: true, esTitular: true, puesto: true }
        }
      }
    });

    // 1. Validamos que el usuario exista
    if (!user) throw new HttpError('Credenciales incorrectas.', 401);

    // 2. Validamos la contraseña
    const isMatch = await verified(password, user.password);
    if (!isMatch) {
      this.registerFailLogin(emailNorm);
      throw new HttpError('Credenciales incorrectas.', 401);
    }

    // 3. BLOQUEO: Si la contraseña es correcta pero la cuenta no está activa
    if (!user.active) {
      throw new HttpError('Tu solicitud está pendiente de aprobación. Pásate por Secretaría para formalizar tu alta.', 403);
    }

    // Login correcto: limpiamos el contador de fallos
    this.attemptsLogin.delete(emailNorm);

    // --- LÓGICA 2FA ---
    if (user.twoFactorEnabled) {
      return {
        status: '2FA_NEEDED' as const,
        // Prueba de que la contraseña era correcta. El controlador lo mueve a
        // una cookie: no debe salir nunca en el cuerpo de la respuesta.
        pendingToken: generatePending2FAToken(user.id),
        message: 'Introduce el código de tu aplicación de autenticación.'
      };
    }

    const token = generateToken(user.id, user.role);
    return {
      status: 'OK' as const,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        perfiles: user.hermanos
      }
    };
  }

  /**
   * Los datos de sesion que el frontend necesita al arrancar. Devuelve el mismo
   * objeto `user` que el login, para que el front tenga un unico formato.
   */
  static async perfilSesion(userId: number) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        hermanos: {
          where: { activo: true },
          select: { id: true, nombre: true, esTitular: true, puesto: true }
        }
      }
    });

    if (!user) throw new NotFoundError('Usuario no encontrado');

    return { id: user.id, email: user.email, role: user.role, perfiles: user.hermanos };
  }

  // Contador de intentos fallidos de 2FA por cuenta (defensa contra fuerza bruta
  // distribuida, que el rate limiter por IP no cubre). En memoria: suficiente
  // para una instancia; con varias instancias habría que moverlo a Redis/BD.
  private static attempts2FA = new Map<number, { fails: number; blockedUntil: number }>();
  private static readonly MAX_ATTEMPTS_2FA = 5;
  private static readonly LOCKOUT_2FA_MS = 15 * 60 * 1000; // 15 minutos

  private static checkLockout2FA(userId: number): void {
    const state = this.attempts2FA.get(userId);
    if (state && state.blockedUntil > Date.now()) {
      const mins = Math.ceil((state.blockedUntil - Date.now()) / 60000);
      throw new HttpError(`Demasiados intentos fallidos. Cuenta bloqueada temporalmente: espera ${mins} minuto(s).`, 429);
    }
  }

  private static registerFail2FA(userId: number): void {
    const state = this.attempts2FA.get(userId) ?? { fails: 0, blockedUntil: 0 };
    state.fails += 1;
    if (state.fails >= this.MAX_ATTEMPTS_2FA) {
      state.blockedUntil = Date.now() + this.LOCKOUT_2FA_MS;
      state.fails = 0;
    }
    this.attempts2FA.set(userId, state);
  }

  /**
   * VERIFICAR LOGIN CON OTPAUTH
   * Acepta el código TOTP de 6 dígitos o un código de respaldo (si perdió el móvil).
   */
  static async verifyLogin2FA(userId: number, token2fa: string) {
    // Bloqueo preventivo antes de gastar consultas
    this.checkLockout2FA(userId);

    const user = await db.user.findUnique({
      where: { id: userId },
      omit: { twoFactorSecret: false }, // Necesario para validar el TOTP
      include: {
        hermanos: {
          // Mismo formato que el login normal para que el selector de perfiles funcione igual
          where: { activo: true },
          select: { id: true, nombre: true, esTitular: true, puesto: true }
        }
      }
    });
    if (!user || !user.twoFactorSecret) throw new HttpError('2FA no configurado.', 401);

    const code = token2fa.trim().toUpperCase();
    let backupCodesRemaining: number | undefined;

    if (/^[0-9]{6}$/.test(code)) {
      // 1. Reconstruimos el objeto TOTP con el secreto guardado
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret)
      });

      // 2. Validamos (window: 1 permite un margen de +/- 30 segundos por si el reloj no está sincro)
      const delta = totp.validate({ token: code, window: 1 });
      if (delta === null) {
        this.registerFail2FA(userId);
        throw new HttpError('Código incorrecto o expirado.', 401);
      }
    } else {
      // Código de respaldo: lo buscamos por hash y debe estar sin usar
      const consumed = await this.consumeBackupCode(user.id, code);
      if (!consumed) {
        this.registerFail2FA(userId);
        throw new HttpError('Código incorrecto o expirado.', 401);
      }

      // Avisamos al frontend de cuántos le quedan (si se le acaban, necesita al ADMIN)
      backupCodesRemaining = await db.twoFactorBackupCode.count({
        where: { userId: user.id, usedAt: null }
      });
    }

    // Login correcto: limpiamos el contador de fallos
    this.attempts2FA.delete(userId);

    const token = generateToken(user.id, user.role);
    return {
      status: 'OK',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        perfiles: user.hermanos,
        ...(backupCodesRemaining !== undefined ? { backupCodesRemaining } : {})
      }
    };
  }

  // 1. Solicitar el reseteo (Genera token y envía email)
  /**
   * Emite un enlace para poner contraseña y devuelve el token en crudo.
   *
   * Lo usan dos flujos con plazos distintos: el «he olvidado mi contraseña»
   * (una hora, la persona está delante) y la emancipación desde secretaría
   * (tres días, la persona se entera cuando abra el correo).
   */
  static async crearEnlaceDeContrasena(userId: number, validezHoras: number): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await db.user.update({
      where: { id: userId },
      data: {
        resetPasswordToken: this.hashResetToken(token),
        resetPasswordExpires: new Date(Date.now() + validezHoras * 3600000)
      }
    });
    return token;
  }

  static async requestPasswordReset(email: string) {
    const user = await db.user.findUnique({ where: { email } });
    
    // MEDIDA DE SEGURIDAD: Aunque el email no exista, decimos que todo ha ido bien.
    // Así evitamos que atacantes usen este endpoint para adivinar qué correos están registrados.
    if (!user) {
      return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
    }

    // Una hora de validez: la persona está delante de la pantalla.
    const resetToken = await this.crearEnlaceDeContrasena(user.id, 1);

    // Enviamos el correo. OJO: se pasa el TOKEN en crudo; la URL completa la construye
    // EmailService (antes se construía aquí y el email la volvía a envolver: ?token=https://...?token=).
    EmailService.enviarRecuperacionContrasena(user.email, user.nombre, resetToken)
      .catch(err => console.error('Error enviando email de recuperación:', err));

    return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
  }

  // 2. Aplicar la nueva contraseña
  static async resetPassword(token: string, newPassword: string) {
    // Buscamos un usuario que tenga ese token EXACTO y cuya fecha de expiración sea mayor a AHORA
    const user = await db.user.findFirst({
      where: {
        resetPasswordToken: this.hashResetToken(token),
        resetPasswordExpires: { gt: new Date() } // gt = greater than (mayor que)
      }
    });

    if (!user) {
      throw new HttpError('El enlace de recuperación es inválido o ha caducado.');
    }

    // Encriptamos la nueva contraseña
    const hashedPassword = await encrypt(newPassword);

    // Actualizamos la contraseña y LIMPIAMOS los campos del token para que no se pueda reusar
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        // Invalidamos TODAS las sesiones abiertas (por si la contraseña se cambió
        // por robo de cuenta: el atacante con token viejo queda fuera)
        tokenValidAfter: new Date()
      }
    });

    return { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' };
  }

  // =================================================================
  //  GESTIÓN 2FA (Setup y Rescate)
  // =================================================================

  static async generate2FAQR(userId: number) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Usuario no encontrado');

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

    // 5. Guardamos el secreto en Base32 en la BD
    await db.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 }
    });

    return { qrCodeUrl, secret: secret.base32 };
  }

  static async enable2FA(userId: number, token2fa: string) {
    const user = await db.user.findUnique({ where: { id: userId }, omit: { twoFactorSecret: false } });
    if (!user || !user.twoFactorSecret) throw new HttpError('Falta generar el QR.');

    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret)
    });

    const delta = totp.validate({ token: token2fa, window: 1 });

    if (delta === null) throw new HttpError('Código incorrecto.');

    // Generamos los códigos de respaldo (de un solo uso) y guardamos solo su hash
    const backupCodes = this.generateBackupCodes(8);

    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true }
      }),
      // Por si reactivaba después de un disable forzado, limpiamos restos primero
      db.twoFactorBackupCode.deleteMany({ where: { userId } }),
      db.twoFactorBackupCode.createMany({
        data: backupCodes.map(code => ({ userId, codeHash: this.hashBackupCode(code) }))
      })
    ]);

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
   */
  static async disable2FA(userId: number, code: string) {
    const user = await db.user.findUnique({ where: { id: userId }, omit: { twoFactorSecret: false } });
    if (!user || !user.twoFactorEnabled) throw new HttpError('2FA no está activado.');

    const normalized = code.trim().toUpperCase();

    if (/^[0-9]{6}$/.test(normalized)) {
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret!)
      });
      const delta = totp.validate({ token: normalized, window: 1 });
      if (delta === null) throw new HttpError('Código incorrecto.');
    } else {
      const consumed = await this.consumeBackupCode(userId, normalized);
      if (!consumed) throw new HttpError('Código incorrecto.');
    }

    return await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null }
      });
      await tx.twoFactorBackupCode.deleteMany({ where: { userId } });
      return { message: '2FA desactivado. Podrás volver a activarlo generando un QR nuevo.' };
    });
  }

  /**
   * DESACTIVAR 2FA FORZADO (Rescate de emergencia: solo ADMIN/SECRETARÍA)
   * No pide código porque lo invoca la mesa del Grupo Parroquial tras verificar la identidad.
   */
  static async forceDisable2FA(targetUserId: number, meta?: AuditMeta) {
    await db.$transaction([
      db.user.update({
        where: { id: targetUserId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          // Rescate de emergencia: se invalidan sus sesiones por seguridad
          tokenValidAfter: new Date()
        }
      }),
      db.twoFactorBackupCode.deleteMany({ where: { userId: targetUserId } })
    ]);
    // Auditoría: rescate de emergencia sobre la cuenta de otro usuario
    AuditService.log(AUDIT_ACTIONS.TFa_RESET_ADMIN, meta ?? {}, 'user', targetUserId);
    return { message: '2FA desactivado por un administrador.' };
  }

  // =================================================================
  //  RGPD: EXPORTACIÓN Y SUPRESIÓN DE DATOS PROPIOS
  // =================================================================

  /**
   * Derecho de acceso (art. 15 RGPD): exporta TODOS los datos personales
   * del usuario: cuenta, fichas familiares, recibos, papeletas, citas y
   * transacciones asociadas a sus perfiles.
   */
  static async exportMisDatos(userId: number, meta?: AuditMeta) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        hermanos: {
          include: {
            recibos: { orderBy: { year: 'desc' } },
            papeletas: { orderBy: { year: 'desc' } },
            citas: { include: { turno: true } },
            transacciones: true
          }
        }
      }
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    // Auditoría (las exportaciones masivas de datos también son rastreables)
    AuditService.log(AUDIT_ACTIONS.CUENTA_DATOS_EXPORT, meta ?? {}, 'user', userId);

    // Nunca exponemos secretos en la exportación: el cliente Prisma ya los omite
    // globalmente (ver config/db.ts), así que `user` llega sin password/2FA/reset.
    const { hermanos, ...safeUser } = user;
    return {
      exportadoEn: new Date().toISOString(),
      aviso: 'Exportación de datos personales conforme al art. 15 RGPD.',
      usuario: safeUser,
      perfilesHermanos: user.hermanos
    };
  }

  /**
   * Derecho de supresión (art. 17 RGPD) adaptado a las obligaciones fiscales
   * del Grupo Parroquial:
   * - La CUENTA se anonimiza por completo (email, DNI, nombre, contraseña)
   *   y se desactiva. Sus sesiones quedan invalidadas al instante.
   * - Las FICHAS de hermano se dan de baja y se les limpia el contacto
   *   (email/teléfono/dirección), conservando nombre y historial económico
   *   porque los recibos tienen obligación de retención (6 años Hacienda).
   * Requiere confirmar con la contraseña actual.
   */
  static async deleteOwnAccount(userId: number, password: string, meta?: AuditMeta) {
    const user = await db.user.findUnique({
      where: { id: userId },
      omit: { password: false }, // Necesario para confirmar la identidad
      include: { hermanos: true }
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    // Confirmación de identidad obligatoria
    const isMatch = await verified(password, user.password);
    if (!isMatch) throw new HttpError('Contraseña incorrecta: no se puede eliminar la cuenta.', 401);

    // Antes de anonimizar, registramos la acción (con sus datos aún identificables)
    await AuditService.log(AUDIT_ACTIONS.CUENTA_AUTODELETE, meta ?? {}, 'user', userId);

    const randomPass = crypto.randomBytes(32).toString('hex');

    await db.$transaction(async (tx) => {
      // 1. Anonimización de la cuenta
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `anon-${userId}@eliminado.local`,
          dni: `ELIMINADO-${userId}`,
          nombre: 'Usuario',
          apellidos: 'Eliminado',
          telefono: '',
          direccion: null,
          poblacion: null,
          codigoPostal: null,
          password: randomPass, // Inutiliza la contraseña anterior
          active: false,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          tokenValidAfter: new Date() // Mata todas las sesiones abiertas
        }
      });

      // 2. Backup codes del 2FA fuera
      await tx.twoFactorBackupCode.deleteMany({ where: { userId } });

      // 3. Fichas: baja + limpieza de datos de contacto (se conserva historial fiscal)
      for (const hermano of user.hermanos) {
        await tx.hermano.update({
          where: { id: hermano.id },
          data: {
            activo: false,
            fechaBaja: new Date(),
            email: null,
            telefono: null,
            direccion: null,
            poblacion: null,
            codigoPostal: null
          }
        });
      }
    });

    return {
      message: 'Tu cuenta ha sido eliminada y tus datos personales anonimizados. ' +
        'El historial de recibos se conserva durante el plazo legal obligatorio, ya sin vincular a tus datos de contacto.'
    };
  }

  // =================================================================
  //  HELPERS PRIVADOS 2FA
  // =================================================================

  // Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L)
  private static readonly BACKUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  private static generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      let raw = '';
      for (let j = 0; j < 12; j++) {
        raw += this.BACKUP_ALPHABET[crypto.randomInt(this.BACKUP_ALPHABET.length)];
      }
      codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`);
    }
    return codes;
  }

  private static hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private static hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Consume un código de respaldo (de un solo uso). Devuelve true si era válido.
   */
  private static async consumeBackupCode(userId: number, code: string): Promise<boolean> {
    const backup = await db.twoFactorBackupCode.findFirst({
      where: { userId, codeHash: this.hashBackupCode(code), usedAt: null }
    });
    if (!backup) return false;

    await db.twoFactorBackupCode.update({
      where: { id: backup.id },
      data: { usedAt: new Date() }
    });
    return true;
  }
}
