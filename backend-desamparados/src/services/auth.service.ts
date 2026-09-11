import db from '../config/db';
import { encrypt, verified } from '../utils/bcrypt.handle';
import { generateToken, generatePending2FAToken, esStaff } from '../utils/jwt.handle';
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
import { ipKeyGenerator } from 'express-rate-limit';
import { ContadorFallos, RegistroReciente } from '../utils/contador-fallos.js';
import { cifrarSecretoTotp, leerSecretoTotp, SecretoTotpIlegibleError } from '../utils/cifrado-totp.js';
import { DOMINIO_CUENTA_ELIMINADA, PREFIJO_DNI_ELIMINADO } from '../domain/cuenta-anonimizada.js';
import { suprimirDatosPersonales } from '../domain/auditoria-supresion.js';
// -------------------------------

/**
 * El acceso del CMS no reparte sesiones a cuentas sin rol del equipo. Antes
 * se creaba la sesión y el frontend la cerraba al instante, pero ahora cerrar
 * sesión revoca las de la cuenta en todos sus dispositivos: al hermano que se
 * equivocara de acceso se le cerraría también la del móvil.
 */
export class CuentaSinCmsError extends HttpError {
  readonly codigo = 'CUENTA_SIN_CMS';
  constructor() {
    super('Esta cuenta no pertenece al equipo del CMS. Si eres hermano, entra por el acceso del área de hermanos.', 403);
    this.name = 'CuentaSinCmsError';
    Object.setPrototypeOf(this, CuentaSinCmsError.prototype);
  }
}

/**
 * El testigo del primer factor ya se gastó (o es de antes de un segundo factor
 * aceptado): hay que volver a pasar por la contraseña.
 */
export class Testigo2FACaducadoError extends HttpError {
  readonly codigo = 'PENDING_2FA_REQUIRED';
  constructor() {
    super('La verificación ha caducado. Vuelve a introducir tu email y contraseña.', 401);
    this.name = 'Testigo2FACaducadoError';
    Object.setPrototypeOf(this, Testigo2FACaducadoError.prototype);
  }
}

const QUINCE_MINUTOS = 15 * 60 * 1000;
const UNA_HORA = 60 * 60 * 1000;

const MENSAJE_CODIGO_USADO = 'Ese código ya se ha usado. Espera a que tu aplicación muestre el siguiente.';
const MENSAJE_2FA_YA_ACTIVO = 'El doble factor ya está activo. Desactívalo primero si quieres configurarlo con otro móvil.';

type ResultadoTotp = 'ok' | 'incorrecto' | 'usado';

// Todo lo que se deja a cero al apagar el 2FA, por el propio usuario o por un
// rescate. `twoFactorLastStep` también: si se quedaba el intervalo del código
// usado para desactivar, reactivar enseguida con el secreto nuevo daba «Ese
// código ya se ha usado» (el intervalo es el mismo aunque el secreto no).
const APAGAR_2FA = { twoFactorEnabled: false, twoFactorSecret: null, twoFactorLastStep: null } as const;

// Datos de contacto de una ficha, fuera, en la supresión de la cuenta.
const CONTACTO_FUERA = { email: null, telefono: null, direccion: null, poblacion: null, codigoPostal: null } as const;

// Un secreto que no se puede descifrar es un fallo de configuración del
// servidor (la clave cambió sin conservar la anterior), no del usuario: el
// mensaje no puede decirle que su código está mal.
const MENSAJE_SECRETO_ILEGIBLE =
  'No se puede comprobar tu doble factor por un problema de configuración del servidor. ' +
  'Avisa al administrador: puede desactivártelo para que vuelvas a entrar.';

/**
 * Impide que el último ADMIN activo se borre: dejaría el CMS sin nadie capaz
 * de nombrar ni rescatar al equipo. Suelta para poder probar la regla sin
 * vaciar de administradores la base de datos de desarrollo.
 *
 * Con `FOR UPDATE` sobre los ADMIN activos: un simple recuento dejaba que dos
 * ADMIN que se borran a la vez se vieran el uno al otro todavía activo y se
 * fueran los dos. Con el bloqueo, la segunda transacción espera a que la
 * primera confirme y entonces ya cuenta uno menos.
 */
export async function asegurarQueQuedaOtroAdmin(tx: Prisma.TransactionClient, rol: Role): Promise<void> {
  if (rol !== Role.ADMIN) return;
  const filas = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM \`User\` WHERE role = 'ADMIN' AND active = TRUE FOR UPDATE`;
  const adminsActivos = filas.length;
  if (adminsActivos <= 1) {
    throw new HttpError('Eres el único administrador activo: nombra antes a otro administrador para no dejar el CMS sin gestión.', 409);
  }
}

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
      // Quien vuelve tras una baja, o tras suprimir su cuenta, conserva su ficha
      // con el DNI en el censo: una ficha nueva chocaría con el índice único y
      // daría un 500. Lo que toca es que Secretaría reactive la que ya existe.
      const fichaConEseDni = await db.hermano.findFirst({ where: { dni: usuario.dni }, select: { id: true } });
      if (fichaConEseDni) {
        throw new HttpError(
          'Ya hay una ficha en el censo con ese DNI. Si fuiste hermano, pide a Secretaría que te reactive.',
          409
        );
      }
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

  // Bloqueo en dos niveles, complementario al limitador por IP (authLimiter):
  // - Por email + IP, con umbral bajo: frena a quien prueba contraseñas desde
  //   un sitio sin dejar fuera a la cuenta en los demás. Antes contaba solo
  //   por email, y cinco intentos desde cualquier sitio bastaban para dejar a
  //   un cargo quince minutos sin poder entrar.
  // - Por email, con umbral alto: frena el ataque repartido entre muchas IP
  //   contra una misma cuenta, que el primer nivel no ve.
  // Cuentan también los emails que no existen: si solo se bloquearan los
  // reales, el propio bloqueo diría qué correos están registrados.
  private static readonly fallosLoginPorIp = new ContadorFallos({
    maxFallos: 5, bloqueoMs: QUINCE_MINUTOS, ventanaMs: UNA_HORA, tope: 10_000
  });
  private static readonly fallosLoginPorEmail = new ContadorFallos({
    maxFallos: 50, bloqueoMs: QUINCE_MINUTOS, ventanaMs: UNA_HORA, tope: 10_000
  });

  // Redes desde las que cada cuenta ha acertado la contraseña hace poco. El
  // bloqueo global por email existe para frenar un ataque repartido entre
  // muchas IP; sin esta excepción, ese mismo ataque bastaba para dejar fuera a
  // voluntad al dueño de la cuenta. Quien entró bien desde una red en los
  // últimos 30 días no es el atacante repartido: el bloqueo global no le afecta
  // (el de su propia IP, sí). En memoria: tras reiniciar, hasta que cada cargo
  // vuelva a entrar, rige el bloqueo global a secas.
  private static readonly redesConfiadas = new RegistroReciente({ vigenciaMs: 30 * 24 * UNA_HORA, tope: 10_000 });

  /**
   * La IP como la agrupa el limitador: una IPv6 se reduce a su /56. Con la
   * dirección entera, cada una de los millones de /128 de un mismo cliente
   * doméstico era una clave nueva y el bloqueo por email + IP no frenaba nada.
   */
  private static claveIp(email: string, ip: string): string {
    return `${email}|${ipKeyGenerator(ip)}`;
  }

  private static checkLockoutLogin(email: string, ip: string): void {
    const clave = this.claveIp(email, ip);
    const global = this.redesConfiadas.tiene(clave) ? 0 : this.fallosLoginPorEmail.restanteBloqueo(email);
    const restante = Math.max(this.fallosLoginPorIp.restanteBloqueo(clave), global);
    if (restante > 0) {
      const mins = Math.ceil(restante / 60000);
      throw new HttpError(`Demasiados intentos fallidos. Cuenta bloqueada temporalmente: espera ${mins} minuto(s).`, 429);
    }
  }

  private static registerFailLogin(email: string, ip: string): void {
    this.fallosLoginPorIp.registrarFallo(this.claveIp(email, ip));
    this.fallosLoginPorEmail.registrarFallo(email);
  }

  // Hash contra el que se compara cuando el email no existe. Sin él, un email
  // inexistente respondía antes (sin pasar por bcrypt) y el tiempo de respuesta
  // decía qué correos están registrados. Mismas rondas que `encrypt`.
  private static readonly hashSenuelo: Promise<string> = encrypt(crypto.randomBytes(16).toString('hex'));

  static async loginUser({ email, password, recordarme, contexto }: LoginDto, ip = 'desconocida') {
    const emailNorm = email.trim().toLowerCase();

    // Bloqueo preventivo antes de gastar una consulta (defensa contra fuerza bruta)
    this.checkLockoutLogin(emailNorm, ip);

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

    // 1 y 2. Usuario y contraseña, en un solo paso: si el email no existe se
    // compara igualmente contra el señuelo, para que las dos respuestas tarden lo mismo.
    const isMatch = await verified(password, user ? user.password : await this.hashSenuelo);
    if (!user || !isMatch) {
      this.registerFailLogin(emailNorm, ip);
      throw new HttpError('Credenciales incorrectas.', 401);
    }

    // 3. BLOQUEO: Si la contraseña es correcta pero la cuenta no está activa.
    // Este mensaje sí confirma que la cuenta existe, pero solo a quien ya ha
    // acertado la contraseña, y los hermanos con el alta en espera lo necesitan
    // para saber que tienen que pasar por Secretaría: se mantiene a propósito.
    if (!user.active) {
      throw new HttpError('Tu solicitud está pendiente de aprobación. Pásate por Secretaría para formalizar tu alta.', 403);
    }

    // Contraseña correcta: limpiamos los contadores de fallos y apuntamos la red
    this.fallosLoginPorIp.limpiar(this.claveIp(emailNorm, ip));
    this.fallosLoginPorEmail.limpiar(emailNorm);
    this.redesConfiadas.apuntar(this.claveIp(emailNorm, ip));

    const esCms = contexto === 'cms';
    const origen = esCms ? 'cms' : 'hermanos';

    if (esCms && !esStaff(user.role)) throw new CuentaSinCmsError();

    // --- LÓGICA 2FA ---
    // El segundo factor solo se exige en el acceso al CMS. El área de hermanos
    // entra solo con contraseña, aunque la cuenta tenga 2FA activado.
    if (esCms && user.twoFactorEnabled) {
      return {
        status: '2FA_NEEDED' as const,
        // Prueba de que la contraseña era correcta. El controlador lo mueve a
        // una cookie: no debe salir nunca en el cuerpo de la respuesta.
        // Lleva el último intervalo TOTP aceptado: en cuanto se acepte otro
        // segundo factor, este testigo deja de valer (un solo uso).
        pendingToken: generatePending2FAToken(user.id, recordarme === true, origen, user.twoFactorLastStep),
        message: 'Introduce el código de tu aplicación de autenticación.'
      };
    }

    const token = generateToken(user.id, user.role, recordarme === true, origen);
    return {
      status: 'OK' as const,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        perfiles: user.hermanos,
        twoFactorEnabled: user.twoFactorEnabled,
        origen
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

    return { id: user.id, email: user.email, role: user.role, perfiles: user.hermanos, twoFactorEnabled: user.twoFactorEnabled };
  }

  // Contador de intentos fallidos de 2FA por cuenta (defensa contra fuerza bruta
  // distribuida, que el rate limiter por IP no cubre). Lo comparten el login
  // con 2FA y la desactivación: si cada uno llevara el suyo, quien tuviera la
  // contraseña probaría cinco códigos en uno y otros cinco en el otro.
  private static readonly fallos2FA = new ContadorFallos({
    maxFallos: 5, bloqueoMs: QUINCE_MINUTOS, ventanaMs: UNA_HORA, tope: 10_000
  });

  private static checkLockout2FA(userId: number): void {
    const restante = this.fallos2FA.restanteBloqueo(String(userId));
    if (restante > 0) {
      const mins = Math.ceil(restante / 60000);
      throw new HttpError(`Demasiados intentos fallidos. Cuenta bloqueada temporalmente: espera ${mins} minuto(s).`, 429);
    }
  }

  private static registerFail2FA(userId: number): void {
    this.fallos2FA.registrarFallo(String(userId));
  }

  /**
   * VERIFICAR LOGIN CON OTPAUTH
   * Acepta el código TOTP de 6 dígitos o un código de respaldo (si perdió el móvil).
   *
   * `testigo` son los datos del testigo del primer factor: `paso2fa` es el
   * `twoFactorLastStep` de la cuenta cuando se emitió (si ya no coincide, desde
   * entonces se ha aceptado otro segundo factor y no vale) y `emitidoMs`, cuándo
   * (si es anterior a `tokenValidAfter`, entre medias se cambió la contraseña o
   * se cerraron todas las sesiones).
   */
  static async verifyLogin2FA(
    userId: number,
    token2fa: string,
    recordarme = false,
    origen: 'cms' | 'hermanos' = 'cms',
    testigo: { paso2fa?: number | null; emitidoMs?: number } = {}
  ) {
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
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) throw new HttpError('2FA no configurado.', 401);

    // Testigo de un solo uso. Se eligió atarlo a `twoFactorLastStep` en vez de
    // apuntar su `jti` en memoria: vale igual con varias instancias o tras un
    // reinicio, y no hay nada que barrer. El precio es que dos logins a medias
    // de la misma cuenta se pisan: el segundo en llegar repite la contraseña.
    if (testigo.paso2fa === undefined || user.twoFactorLastStep !== testigo.paso2fa) {
      throw new Testigo2FACaducadoError();
    }

    // Y atado a la cuenta tal como estaba al acertar la contraseña: si desde
    // entonces se ha desactivado, se ha cambiado la contraseña o se han cerrado
    // todas sus sesiones, los cinco minutos del testigo no pueden saltárselo.
    // Sin `emitidoMs` (testigos de antes de existir el claim) tampoco vale.
    if (!user.active || typeof testigo.emitidoMs !== 'number' || testigo.emitidoMs < user.tokenValidAfter.getTime()) {
      throw new Testigo2FACaducadoError();
    }

    const code = token2fa.trim().toUpperCase();
    let backupCodesRemaining: number | undefined;

    if (/^[0-9]{6}$/.test(code)) {
      // El reclamo del intervalo es un compare-and-swap sobre el valor leído,
      // que es el del testigo: gana una sola petición aunque lleguen a la vez.
      const { resultado } = await this.reclamarTotp(user, code);
      if (resultado !== 'ok') {
        this.registerFail2FA(userId);
        throw new HttpError(resultado === 'usado' ? MENSAJE_CODIGO_USADO : 'Código incorrecto o expirado.', 401);
      }
    } else {
      // Código de respaldo. Gastar el testigo y consumir el respaldo van en la
      // misma transacción: por separado, si otra petición con el mismo testigo
      // y un TOTP ganaba entre medias, el respaldo quedaba gastado sin dar
      // sesión. El testigo va primero porque bloquea la fila de la cuenta y
      // pone en fila a esa otra petición; si el respaldo no vale, se deshace y
      // el testigo sigue sirviendo para teclear otro código.
      const respaldoIncorrecto = new Error('respaldo incorrecto');
      try {
        await db.$transaction(async (tx) => {
          // Un respaldo no gasta ningún intervalo TOTP, así que se avanza a mano:
          // si no, el testigo seguiría vivo y admitiría otro código.
          const { count } = await tx.user.updateMany({
            where: { id: user.id, twoFactorLastStep: user.twoFactorLastStep },
            data: { twoFactorLastStep: Math.max(this.pasoTotpActual(), (user.twoFactorLastStep ?? -1) + 1) }
          });
          if (count !== 1) throw new Testigo2FACaducadoError();
          if (!(await this.consumeBackupCode(user.id, code, tx))) throw respaldoIncorrecto;
        });
      } catch (e) {
        if (e !== respaldoIncorrecto) throw e;
        this.registerFail2FA(userId);
        throw new HttpError('Código incorrecto o expirado.', 401);
      }

      // Avisamos al frontend de cuántos le quedan (si se le acaban, necesita al ADMIN)
      backupCodesRemaining = await db.twoFactorBackupCode.count({
        where: { userId: user.id, usedAt: null }
      });
    }

    // Login correcto: limpiamos el contador de fallos
    this.fallos2FA.limpiar(String(userId));

    const token = generateToken(user.id, user.role, recordarme, origen);
    return {
      status: 'OK',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        perfiles: user.hermanos,
        twoFactorEnabled: user.twoFactorEnabled,
        origen,
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
    // MEDIDA DE SEGURIDAD: Aunque el email no exista, decimos que todo ha ido bien.
    // Así evitamos que atacantes usen este endpoint para adivinar qué correos están registrados.
    //
    // Y respondemos sin esperar a nada: antes, con un email registrado se
    // escribía el token antes de contestar y sin él no, y esa diferencia de
    // tiempo decía lo mismo que el mensaje se esforzaba en callar. Todo el
    // trabajo va en segundo plano, exista o no la cuenta.
    this.prepararRecuperacion(email)
      .catch(err => console.error('Error preparando la recuperación de contraseña:', err));

    return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
  }

  /**
   * El trabajo de «he olvidado mi contraseña», fuera del tiempo de respuesta.
   * Si el email no es de nadie, no hace nada.
   */
  static async prepararRecuperacion(email: string): Promise<void> {
    const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, nombre: true } });
    if (!user) return;

    // Una hora de validez: la persona está delante de la pantalla.
    const resetToken = await this.crearEnlaceDeContrasena(user.id, 1);

    // Enviamos el correo. OJO: se pasa el TOKEN en crudo; la URL completa la construye
    // EmailService (antes se construía aquí y el email la volvía a envolver: ?token=https://...?token=).
    await EmailService.enviarRecuperacionContrasena(user.email, user.nombre, resetToken);
  }

  // 2. Aplicar la nueva contraseña
  static async resetPassword(token: string, newPassword: string) {
    // El hash de la contraseña va antes que el token: es lo lento, y así la
    // consulta que gasta el token queda en una sola sentencia.
    const hashedPassword = await encrypt(newPassword);

    // Buscar y después escribir dejaba que dos peticiones con el mismo enlace
    // lo usaran las dos (y ganara la última). Ahora el token se gasta en la
    // misma sentencia que lo comprueba: solo una encuentra el hash sin usar.
    const { count } = await db.user.updateMany({
      where: {
        resetPasswordToken: this.hashResetToken(token),
        resetPasswordExpires: { gt: new Date() } // gt = greater than (mayor que)
      },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        // Invalidamos TODAS las sesiones abiertas (por si la contraseña se cambió
        // por robo de cuenta: el atacante con token viejo queda fuera)
        tokenValidAfter: new Date()
      }
    });

    if (count !== 1) {
      throw new HttpError('El enlace de recuperación es inválido o ha caducado.');
    }

    return { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' };
  }

  /**
   * Cierra todas las sesiones de la cuenta (logout). Mueve tokenValidAfter al
   * instante actual: los tokens emitidos antes quedan revocados en todos los
   * dispositivos, también el que se haya podido copiar de este navegador. El
   * login siguiente sigue valiendo aunque caiga en el mismo segundo, porque el
   * token lleva `emitidoMs` con milisegundos (ver middleware/session.ts).
   */
  static async cerrarSesionesDe(userId: number) {
    // updateMany y no update: si la cuenta ya no existe no hay nada que cerrar,
    // y un P2025 convertiría el cierre de sesión en un 500.
    await db.user.updateMany({ where: { id: userId }, data: { tokenValidAfter: new Date() } });
  }

  // =================================================================
  //  GESTIÓN 2FA (Setup y Rescate)
  // =================================================================

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

  static async enable2FA(userId: number, token2fa: string) {
    const user = await db.user.findUnique({ where: { id: userId }, omit: { twoFactorSecret: false } });
    if (!user || !user.twoFactorSecret) throw new HttpError('Falta generar el QR.');
    if (user.twoFactorEnabled) throw new HttpError(MENSAJE_2FA_YA_ACTIVO, 409);

    const { resultado, guardado } = await this.reclamarTotp(user, token2fa.trim());
    if (resultado === 'usado') throw new HttpError(MENSAJE_CODIGO_USADO);
    if (resultado !== 'ok') throw new HttpError('Código incorrecto.');

    // Generamos los códigos de respaldo (de un solo uso) y guardamos solo su hash
    const backupCodes = this.generateBackupCodes(8);

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
        data: backupCodes.map(code => ({ userId, codeHash: this.hashBackupCode(code) }))
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
    this.checkLockout2FA(userId);

    const user = await db.user.findUnique({ where: { id: userId }, omit: { twoFactorSecret: false } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) throw new HttpError('2FA no está activado.');

    const normalized = code.trim().toUpperCase();

    if (/^[0-9]{6}$/.test(normalized)) {
      const { resultado } = await this.reclamarTotp(user, normalized);
      if (resultado !== 'ok') {
        this.registerFail2FA(userId);
        throw new HttpError(resultado === 'usado' ? MENSAJE_CODIGO_USADO : 'Código incorrecto.');
      }
    } else {
      const consumed = await this.consumeBackupCode(userId, normalized);
      if (!consumed) {
        this.registerFail2FA(userId);
        throw new HttpError('Código incorrecto.');
      }
    }

    this.fallos2FA.limpiar(String(userId));

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
  static async forceDisable2FA(targetUserId: number, actorId: number, meta?: AuditMeta) {
    if (targetUserId === actorId) {
      throw new HttpError('No puedes rescatar tu propia cuenta. Desactiva tu doble factor desde «Mi seguridad» con un código vigente.', 403);
    }

    const antes = await this.apagar2FAForzado(targetUserId);

    // Auditoría: rescate de emergencia sobre la cuenta de otro usuario, ya confirmado
    await AuditService.log(AUDIT_ACTIONS.TFa_RESET_ADMIN, meta ?? {}, 'user', targetUserId, {
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

    await AuditService.log(
      AUDIT_ACTIONS.TFa_RESET_ADMIN,
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
          tokenValidAfter: new Date()
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
   *
   * Una cuenta del equipo solo puede borrarse desde una sesión del CMS: la del
   * área de hermanos no ha pasado el 2FA, y con la contraseña robada de un
   * cargo bastaba para hacer desaparecer su cuenta. Y nunca la del último
   * ADMIN activo, que dejaría el CMS sin nadie capaz de gestionar al equipo.
   */
  static async deleteOwnAccount(
    userId: number,
    password: string,
    origen: 'cms' | 'hermanos' | undefined,
    meta?: AuditMeta
  ) {
    const user = await db.user.findUnique({
      where: { id: userId },
      omit: { password: false }, // Necesario para confirmar la identidad
      include: { hermanos: true }
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    // Antes que la contraseña: no hace falta gastar un bcrypt para decir que no.
    if (esStaff(user.role) && origen !== 'cms') {
      throw new HttpError('Esta cuenta es del equipo del CMS: para eliminarla, entra por el acceso del CMS.', 403);
    }

    // Confirmación de identidad obligatoria
    const isMatch = await verified(password, user.password);
    if (!isMatch) throw new HttpError('Contraseña incorrecta: no se puede eliminar la cuenta.', 401);

    const randomPass = crypto.randomBytes(32).toString('hex');
    const fichas = { retiradas: 0, dadasDeBaja: 0, yaDeBaja: 0 };
    let registrosSuprimidos = 0;

    await db.$transaction(async (tx) => {
      // 0. El último ADMIN activo no se va.
      await asegurarQueQuedaOtroAdmin(tx, user.role);

      // 1. Anonimización de la cuenta
      await tx.user.update({
        where: { id: userId },
        data: {
          // Formato compartido con `esCuentaAnonimizada`, que lo usa para no
          // reactivar por error una cuenta suprimida.
          email: `anon-${userId}${DOMINIO_CUENTA_ELIMINADA}`,
          dni: `${PREFIJO_DNI_ELIMINADO}${userId}`,
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

      // 3. Fichas, según su estado (el mismo criterio que la retirada de un
      // perfil desde el área de hermanos, `deleteProfileIfOwned`). Antes todas
      // pasaban a baja con fecha de hoy: una solicitud pendiente quedaba como
      // «baja» que Secretaría podía reactivar sin pasar por Solicitudes, las ya
      // de baja perdían su fecha real y las activas conservaban su número.
      // A todas se les limpia el contacto; nombre e historial económico se
      // conservan porque los recibos tienen obligación de retención (6 años).
      const fechaBaja = new Date();
      for (const { id } of user.hermanos) {
        const ficha = await tx.hermano.findUnique({
          where: { id },
          select: {
            activo: true, fechaBaja: true,
            _count: { select: { recibos: true, papeletas: true, citas: true, transacciones: true, prendas: true } }
          }
        });
        if (!ficha) continue;

        if (ficha.fechaBaja) {
          // Ya de baja: su estado y su fecha son historia del censo.
          await tx.hermano.update({ where: { id }, data: CONTACTO_FUERA });
          fichas.yaDeBaja += 1;
          continue;
        }

        const conHistorial = Object.values(ficha._count).some((n) => n > 0);
        if (!ficha.activo && !conHistorial) {
          // Solicitud pendiente sin nada detrás: se retira, como la retiraría la familia.
          await tx.hermano.delete({ where: { id } });
          fichas.retiradas += 1;
          continue;
        }

        // Activa, o pendiente con historial: baja, y el número queda libre
        // como en cualquier otra baja (una ficha de baja no lo retiene).
        await tx.hermano.update({
          where: { id },
          data: { activo: false, fechaBaja, numeroHermano: null, ...CONTACTO_FUERA }
        });
        fichas.dadasDeBaja += 1;
      }

      // 4. La auditoría de la cuenta y de sus fichas guarda el antes y el
      // después de cada cambio (DNI, correo, dirección...) durante todo el
      // plazo de retención. Se suprimen esos valores en la misma transacción:
      // la cuenta no está suprimida mientras su historial siga diciendo quién era.
      const registros = await tx.auditLog.findMany({
        where: {
          OR: [
            { entityType: 'user', entityId: String(userId) },
            { entityType: 'hermano', entityId: { in: user.hermanos.map((h) => String(h.id)) } }
          ]
        },
        select: { id: true, detalles: true }
      });
      for (const registro of registros) {
        if (registro.detalles === null) continue;
        const suprimidos = suprimirDatosPersonales(registro.detalles);
        if (JSON.stringify(suprimidos) === JSON.stringify(registro.detalles)) continue;
        await tx.auditLog.update({
          where: { id: registro.id },
          data: { detalles: suprimidos as Prisma.InputJsonValue }
        });
        registrosSuprimidos += 1;
      }
    });

    // Auditoría después de confirmar: si la transacción falla, el registro no
    // debe dar fe de un borrado que no ocurrió. El userId del registro sigue
    // señalando a la cuenta, que se anonimiza pero no se borra.
    await AuditService.log(AUDIT_ACTIONS.CUENTA_AUTODELETE, meta ?? {}, 'user', userId, {
      antes: { rol: user.role, activa: user.active, fichasActivas: user.hermanos.filter((h) => h.activo).length },
      despues: { activa: false, anonimizada: true, fichas, registrosAuditoriaSuprimidos: registrosSuprimidos }
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
   *
   * En una sola sentencia condicionada a `usedAt: null`: antes se leía y luego
   * se escribía, y de dos peticiones simultáneas con el mismo código la que
   * perdía se encontraba el registro ya cambiado y acababa en un 500.
   */
  private static async consumeBackupCode(
    userId: number,
    code: string,
    cliente: Pick<typeof db, 'twoFactorBackupCode'> = db
  ): Promise<boolean> {
    const { count } = await cliente.twoFactorBackupCode.updateMany({
      where: { userId, codeHash: this.hashBackupCode(code), usedAt: null },
      data: { usedAt: new Date() }
    });
    return count === 1;
  }

  /** Intervalo TOTP en curso (el contador de 30 s del RFC 6238). */
  private static pasoTotpActual(ahora = Date.now()): number {
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
  private static async reclamarTotp(
    user: { id: number; twoFactorSecret: string | null; twoFactorLastStep: number | null },
    codigo: string
  ): Promise<{ resultado: ResultadoTotp; guardado: string | null }> {
    if (!user.twoFactorSecret) return { resultado: 'incorrecto', guardado: null };
    const { secreto, guardado } = await this.secretoEnClaro(user.id, user.twoFactorSecret);

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

    const paso = this.pasoTotpActual(ahora) + delta;
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
  private static async secretoEnClaro(userId: number, almacenado: string): Promise<{ secreto: string; guardado: string }> {
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
}
