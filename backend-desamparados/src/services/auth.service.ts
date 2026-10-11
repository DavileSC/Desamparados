import db from '../config/db';
import { encrypt, verified } from '../utils/bcrypt.handle';
import { generateToken, generatePending2FAToken, esStaff, corteDeSesiones } from '../utils/jwt.handle';
import type { AreaSesion } from '../utils/cookies';
import crypto from 'crypto';
import { Prisma, Role } from '@prisma/client';
import { RegisterDto, LoginDto, ReactivacionDto } from '../dtos/auth.dto';
import { comprobarEsAdulto, comprobarEsMenor } from '../domain/fechas-hermano.js';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service';

// --- NUEVA LIBRERÍA: OTPAUTH ---
import * as OTPAuth from 'otpauth';
import qrcode from 'qrcode';
import { EmailService } from './email.service';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { enmascararEmail } from '../utils/log-privacidad.js';
import { ipKeyGenerator } from 'express-rate-limit';
import { ContadorFallos, RegistroReciente } from '../utils/contador-fallos.js';
import {
  MENSAJE_CODIGO_USADO, comprobarBloqueo2FA, consumirCodigoDeRespaldo, normalizarCodigo2FA,
  limpiarFallos2FA, pasoTotpActual, reclamarTotp, registrarFallo2FA,
} from './auth/codigos-2fa.js';
import { cifrarSecretoTotp, leerSecretoTotp, SecretoTotpIlegibleError } from '../utils/cifrado-totp.js';
import { DOMINIO_CUENTA_ELIMINADA, PREFIJO_DNI_ELIMINADO } from '../domain/cuenta-anonimizada.js';
import { suprimirDatosPersonales } from '../domain/auditoria-supresion.js';
import { ModulosService } from './modulos.service.js';
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
 * El área de hermanos está apagada en esta instalación: su acceso rechaza a
 * todo el mundo, también a la junta (que tiene el suyo propio en /cms/acceso).
 * Clase propia (no un `HttpError` suelto) para que el controlador pueda
 * responder con el mensaje tal cual, sin la envoltura genérica de `handleHttp`.
 */
export class AreaHermanosApagadaError extends HttpError {
  constructor() {
    super('El área de hermanos no está activada en esta instalación.', 404);
    this.name = 'AreaHermanosApagadaError';
    Object.setPrototypeOf(this, AreaHermanosApagadaError.prototype);
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

/** El testigo del enlace de recuperación se guarda cifrado, nunca en claro. */
function hashDelTestigoDeRecuperacion(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {

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

    // Con el área de hermanos apagada no se reparten sesiones de hermano a
    // nadie, tampoco a la junta: el CMS tiene su propio acceso (/cms/acceso).
    if (contexto === 'hermanos' && !(await ModulosService.activo('area-hermanos'))) {
      throw new AreaHermanosApagadaError();
    }

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
        // La web lleva a la revisión de la ficha en vez de al área.
        primerAccesoPendiente: user.primerAccesoPendiente,
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

    return {
      id: user.id, email: user.email, role: user.role, perfiles: user.hermanos, twoFactorEnabled: user.twoFactorEnabled,
      primerAccesoPendiente: user.primerAccesoPendiente,
    };
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
    comprobarBloqueo2FA(userId);

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

    const code = normalizarCodigo2FA(token2fa);
    let backupCodesRemaining: number | undefined;

    if (/^[0-9]{6}$/.test(code)) {
      // El reclamo del intervalo es un compare-and-swap sobre el valor leído,
      // que es el del testigo: gana una sola petición aunque lleguen a la vez.
      const { resultado } = await reclamarTotp(user, code);
      if (resultado !== 'ok') {
        registrarFallo2FA(userId);
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
            data: { twoFactorLastStep: Math.max(pasoTotpActual(), (user.twoFactorLastStep ?? -1) + 1) }
          });
          if (count !== 1) throw new Testigo2FACaducadoError();
          if (!(await consumirCodigoDeRespaldo(user.id, code, tx))) throw respaldoIncorrecto;
        });
      } catch (e) {
        if (e !== respaldoIncorrecto) throw e;
        registrarFallo2FA(userId);
        throw new HttpError('Código incorrecto o expirado.', 401);
      }

      // Avisamos al frontend de cuántos le quedan (si se le acaban, necesita al ADMIN)
      backupCodesRemaining = await db.twoFactorBackupCode.count({
        where: { userId: user.id, usedAt: null }
      });
    }

    // Login correcto: limpiamos el contador de fallos
    limpiarFallos2FA(userId);

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
   * (tres días, la persona se entera cuando abra el correo). La invitación del
   * primer acceso (dos semanas) lo dice con `invitacion`, y su caducidad queda
   * apuntada aparte en la misma escritura: cualquier otro enlace pisa el
   * token, y entonces la invitación ya no vale aunque el CMS la diera por viva.
   */
  static async crearEnlaceDeContrasena(userId: number, validezHoras: number, opciones: { invitacion?: boolean } = {}): Promise<string> {
    const { token, datos } = this.enlaceSinGuardar(validezHoras, opciones);
    await db.user.update({ where: { id: userId }, data: datos });
    return token;
  }

  /**
   * Lo mismo que `crearEnlaceDeContrasena`, pero sin escribirlo: el token
   * para el correo y lo que hay que guardar en la cuenta. Es para quien
   * guarda solo si el correo sale. Escrito antes, un correo que no salía ya
   * había pisado el enlace anterior, que sí llegó: la invitación reenviada
   * sin éxito quedaba «vigente» en el CMS y el enlace bueno, muerto.
   */
  static enlaceSinGuardar(validezHoras: number, opciones: { invitacion?: boolean } = {}) {
    const token = crypto.randomBytes(32).toString('hex');
    const caduca = new Date(Date.now() + validezHoras * 3600000);
    const datos = {
      resetPasswordToken: hashDelTestigoDeRecuperacion(token),
      resetPasswordExpires: caduca,
      invitacionCaducaEn: opciones.invitacion ? caduca : null,
    } satisfies Prisma.UserUpdateInput;
    return { token, datos };
  }

  /**
   * De quién es un enlace de contraseña que sigue vigente, sin gastarlo. El
   * primer acceso saluda por el nombre antes de pedir la contraseña, y abre
   * la sesión de esa cuenta en cuanto la pone.
   */
  static async cuentaDelEnlace(token: string) {
    return db.user.findFirst({
      where: { resetPasswordToken: hashDelTestigoDeRecuperacion(token), resetPasswordExpires: { gt: new Date() }, active: true },
      select: { id: true, nombre: true, email: true, role: true, primerAccesoPendiente: true },
    });
  }

  static async requestPasswordReset(email: string, contexto: AreaSesion = 'hermanos') {
    // MEDIDA DE SEGURIDAD: Aunque el email no exista, decimos que todo ha ido bien.
    // Así evitamos que atacantes usen este endpoint para adivinar qué correos están registrados.
    //
    // Y respondemos sin esperar a nada: antes, con un email registrado se
    // escribía el token antes de contestar y sin él no, y esa diferencia de
    // tiempo decía lo mismo que el mensaje se esforzaba en callar. Todo el
    // trabajo va en segundo plano, exista o no la cuenta.
    this.prepararRecuperacion(email, contexto)
      .catch(err => console.error('Error preparando la recuperación de contraseña:', err));

    return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
  }

  /**
   * El trabajo de «he olvidado mi contraseña», fuera del tiempo de respuesta.
   * Si el email no es de nadie, no hace nada.
   */
  static async prepararRecuperacion(email: string, contexto: AreaSesion = 'hermanos'): Promise<void> {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, nombre: true, hermanos: { where: { esTitular: true }, select: { sexo: true }, take: 1 } },
    });
    if (!user) return;

    // Una hora de validez: la persona está delante de la pantalla.
    const { token: resetToken, datos } = this.enlaceSinGuardar(1);

    // Enviamos el correo. OJO: se pasa el TOKEN en crudo; la URL completa la construye
    // EmailService (antes se construía aquí y el email la volvía a envolver: ?token=https://...?token=).
    const enviado = await EmailService.enviarRecuperacionContrasena(user.email, user.nombre, resetToken, { horas: 1, sexo: user.hermanos[0]?.sexo, area: contexto });
    // Se guarda solo si el correo ha salido: si no, el enlace que tuviera
    // (el de su invitación, que sí le llegó) sigue valiendo. Queda un instante
    // en que el correo ya ha salido y el token aún no está escrito; quien lo
    // abra justo entonces ve «enlace no válido» y le basta con reintentar.
    if (enviado) await db.user.update({ where: { id: user.id }, data: datos });
  }

  // 2. Aplicar la nueva contraseña
  static async resetPassword(token: string, newPassword: string) {
    // El hash de la contraseña va antes que el token: es lo lento, y así la
    // consulta que gasta el token queda en una sola sentencia.
    const hashedPassword = await encrypt(newPassword);
    const vigente = {
      resetPasswordToken: hashDelTestigoDeRecuperacion(token),
      resetPasswordExpires: { gt: new Date() } // gt = greater than (mayor que)
    };
    // Solo para saber de quién desbloquear el acceso al final; quien gasta el
    // token es el updateMany de abajo.
    const cuenta = await db.user.findFirst({ where: vigente, select: { email: true } });

    // Buscar y después escribir dejaba que dos peticiones con el mismo enlace
    // lo usaran las dos (y ganara la última). Ahora el token se gasta en la
    // misma sentencia que lo comprueba: solo una encuentra el hash sin usar.
    const { count } = await db.user.updateMany({
      where: vigente,
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        // Sea el de la invitación o el de una recuperación, ya ha entrado: el
        // CMS deja de pedir que se le reenvíe.
        invitacionCaducaEn: null,
        contrasenaPuestaEn: new Date(),
        // Invalidamos TODAS las sesiones abiertas (por si la contraseña se cambió
        // por robo de cuenta: el atacante con token viejo queda fuera)
        tokenValidAfter: corteDeSesiones()
      }
    });

    if (count !== 1) {
      throw new HttpError('El enlace de recuperación es inválido o ha caducado.');
    }

    // Quien recupera la contraseña suele venir de equivocarse varias veces, y
    // el bloqueo seguía en pie: con la contraseña nueva recién puesta, el
    // acceso respondía «espera 15 minutos». Abrir el enlace del correo ya
    // prueba que la cuenta es suya, así que se le quita en todas las redes.
    if (cuenta) {
      const email = cuenta.email.trim().toLowerCase();
      this.fallosLoginPorEmail.limpiar(email);
      this.fallosLoginPorIp.limpiarPrefijo(`${email}|`);
    }

    return { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' };
  }

  // Fallos de la contraseña actual al cambiarla, por cuenta. Desde una sesión
  // robada (un ordenador sin bloquear) se podría ir probando la contraseña
  // sin pasar por el login y sus bloqueos; el limitador por IP no basta si la
  // sesión se usa desde varias redes.
  private static readonly fallosCambioContrasena = new ContadorFallos({
    maxFallos: 5, bloqueoMs: QUINCE_MINUTOS, ventanaMs: UNA_HORA, tope: 10_000
  });

  /**
   * Cambiar la contraseña con la sesión abierta: la actual y la nueva. Cierra
   * todas las sesiones de la cuenta, como el enlace de recuperación (si la
   * cambia porque se la han robado, el ladrón queda fuera), y devuelve una
   * sesión nueva para cada área que traía esta petición, para que quien la
   * cambia no se vea echado. Quita también el bloqueo del login, como la
   * recuperación: ya ha probado que la cuenta es suya.
   */
  static async cambiarContrasena(
    userId: number,
    actual: string,
    nueva: string,
    sesiones: { area: AreaSesion; recordarme: boolean }[],
    meta: MetaDeAuditoria = {},
  ): Promise<{ message: string; sesiones: { area: AreaSesion; token: string; role: Role; recordarme: boolean }[] }> {
    const clave = String(userId);
    const restante = this.fallosCambioContrasena.restanteBloqueo(clave);
    if (restante > 0) {
      throw new HttpError(`Demasiados intentos con la contraseña actual equivocada: espera ${Math.ceil(restante / 60000)} minuto(s).`, 429);
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, nombre: true, role: true, active: true, password: true, hermanos: { where: { esTitular: true }, select: { sexo: true }, take: 1 } },
    });
    if (!user || !user.active) throw new HttpError('Tu sesión ha caducado. Vuelve a entrar.', 401);

    // 400 y no 401: la sesión es buena, lo que falla es un dato del formulario,
    // y un 401 haría creer a la web que la sesión ha caducado.
    if (!(await verified(actual, user.password))) {
      this.fallosCambioContrasena.registrarFallo(clave);
      throw new HttpError('La contraseña actual no es correcta.');
    }
    this.fallosCambioContrasena.limpiar(clave);
    if (await verified(nueva, user.password)) {
      throw new HttpError('La contraseña nueva es igual que la actual: elige otra.');
    }

    const corte = corteDeSesiones();
    await db.user.update({
      where: { id: userId },
      data: {
        password: await encrypt(nueva),
        // Un enlace de recuperación (o de invitación) pedido antes ya no debe servir.
        resetPasswordToken: null,
        resetPasswordExpires: null,
        invitacionCaducaEn: null,
        contrasenaPuestaEn: new Date(),
        tokenValidAfter: corte,
      },
    });

    const email = user.email.trim().toLowerCase();
    this.fallosLoginPorEmail.limpiar(email);
    this.fallosLoginPorIp.limpiarPrefijo(`${email}|`);

    // La sesión nueva tiene que nacer después del corte, o la cortaría él.
    while (Date.now() < corte.getTime()) await new Promise((r) => setTimeout(r, 1));
    const nuevas = sesiones.map(({ area, recordarme }) => ({
      area, recordarme, role: user.role, token: generateToken(user.id, user.role, recordarme, area),
    }));

    await AuditoriaService.log(ACCIONES_AUDITORIA.CONTRASENA_CAMBIAR, { ...meta, userId }, 'user', userId, { sesionesCerradas: true });

    const fecha = new Date();
    const cuando = `${new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' }).format(fecha)}, a las ${new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(fecha)}`;
    EmailService.enviarContrasenaCambiada(user.email, user.nombre, cuando, user.hermanos[0]?.sexo ?? undefined)
      .catch((error) => console.error('[Cuenta] No se pudo avisar del cambio de contraseña:', error));

    return { message: 'Contraseña cambiada. Se han cerrado las sesiones abiertas en otros dispositivos.', sesiones: nuevas };
  }

  /**
   * Cierra las sesiones de la cuenta. Con `area`, solo las de esa área: salir
   * del portal del hermano no puede echar a nadie del CMS, ni al revés, porque
   * son dos sesiones distintas de la misma persona.
   *
   * Sin `area`, corta las dos: es lo que hace falta cuando la cuenta entera
   * deja de ser de fiar (cambio de contraseña, RGPD, degradación de rol).
   */
  static async cerrarSesionesDe(userId: number, area?: AreaSesion) {
    const corte = corteDeSesiones();
    const data =
      area === 'cms' ? { cmsValidoDesde: corte }
      : area === 'hermanos' ? { hermanoValidoDesde: corte }
      : { cmsValidoDesde: corte, hermanoValidoDesde: corte, tokenValidAfter: corte };

    // updateMany y no update: si la cuenta ya no existe no hay nada que cerrar,
    // y un P2025 convertiría el cierre de sesión en un 500.
    await db.user.updateMany({ where: { id: userId }, data });
  }
}
