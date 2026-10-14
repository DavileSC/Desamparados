import crypto from 'crypto';
import { EstadoAprobacion, Prisma, Role } from '@prisma/client';
import db from '../../config/db';
import { HttpError, NotFoundError } from '../../utils/error.handle';
import { verified } from '../../utils/bcrypt.handle';
import { ContadorFallos } from '../../utils/contador-fallos.js';
import { enmascararEmail } from '../../utils/log-privacidad.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from '../auditoria.service.js';
import { EmailService } from '../email.service.js';
import { ModulosService } from '../modulos.service.js';
import { comprobarBloqueo2FA, pasoTotpActual, registrarFallo2FA } from '../auth/codigos-2fa.js';
import { pasarSinCodigo, type DatosDelTestigo } from '../auth/sesion-2fa.js';
import { avisosConfigurados, clavePublicaVapid, enviarAviso, type SuscripcionPush } from './push.js';
import { APROBACION_SEGUNDOS, numeroYOpciones, opcionesATexto, opcionesDeTexto } from '../../domain/aprobacion-entrada.js';
import { fechaYHoraParaCorreo } from '../../domain/fecha-y-hora.js';

/**
 * Aprobar la entrada al CMS desde un móvil apuntado, en vez de teclear el
 * código de la app (que sigue de reserva).
 *
 * El ordenador acierta la contraseña y enseña un número; al móvil le llega un
 * aviso, y quien lo abre elige ese número entre tres. Acertar aprueba, fallar
 * anula y «No he sido yo» rechaza y avisa a Administración. La sesión no la
 * da el móvil: la recoge el ordenador con su testigo del primer factor, y por
 * el mismo final que el código (`auth/sesion-2fa`).
 *
 * Qué prueba cada cosa: la contraseña, el testigo; el móvil, su clave (que
 * solo guarda él; aquí, su hash); que no se aprueba por costumbre, el número.
 */

/** El móvil ya no está apuntado, o la clave no es suya: tiene que olvidarla. */
export class MovilNoApuntadoError extends HttpError {
  constructor() {
    // Con su código, para que el móvil olvide una clave que ya no vale.
    super('Este móvil ya no está apuntado para aprobar entradas. Vuelve a apuntarlo desde «Mi seguridad».', 403, { codigo: 'MOVIL_NO_APUNTADO' });
    this.name = 'MovilNoApuntadoError';
    Object.setPrototypeOf(this, MovilNoApuntadoError.prototype);
  }
}

/** Un móvil, tal como lo ve su dueño en «Mi seguridad». */
export interface MovilDeLaLista {
  id: number;
  nombre: string;
  creadoEn: string;
  usadoEn: string | null;
}

/** Lo que el ordenador sabe de su aprobación cada vez que pregunta. */
export type EstadoDeLaEspera = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'FALLADA' | 'CADUCADA';

/** Lo que el móvil ve de una aprobación: los números, solo mientras espera. */
export type VistaEnElMovil =
  | { estado: 'PENDIENTE'; opciones: number[]; desde: string; expiraEn: string }
  | { estado: Exclude<EstadoAprobacion, 'PENDIENTE'> };

const sha256 = (texto: string) => crypto.createHash('sha256').update(texto).digest('hex');

/** Igual, sin decir por el tiempo cuánto se parecen. Los dos son hashes de la misma longitud. */
const mismoHash = (a: string, b: string) => crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const aLista = (m: { id: number; nombre: string; creadoEn: Date; usadoEn: Date | null }): MovilDeLaLista => ({
  id: m.id, nombre: m.nombre, creadoEn: m.creadoEn.toISOString(), usadoEn: m.usadoEn?.toISOString() ?? null,
});

const UN_DIA = 24 * 60 * 60 * 1000;

/** La función existe en esta instalación: el módulo encendido y las claves puestas. */
async function disponible(): Promise<boolean> {
  return avisosConfigurados() && (await ModulosService.activo('avisos-en-el-movil'));
}

// Contraseñas equivocadas al apuntar un móvil, por cuenta. Como al cambiar la
// contraseña: desde una sesión robada no se puede ir probando sin límite.
const fallosAlApuntar = new ContadorFallos({ maxFallos: 5, bloqueoMs: 15 * 60 * 1000, ventanaMs: 60 * 60 * 1000, tope: 10_000 });

/**
 * El móvil y su clave, de esta cuenta. Una clave equivocada de un móvil que sí
 * es de la cuenta cuenta como un fallo del doble factor: es lo que probaría
 * quien tuviera el id del móvil y no el móvil.
 */
async function movilConClave(userId: number, dispositivo: number, clave: string) {
  const movil = await db.movilApuntado.findUnique({ where: { id: dispositivo } });
  if (!movil || movil.userId !== userId) throw new MovilNoApuntadoError();
  if (!mismoHash(movil.claveHash, sha256(clave))) {
    registrarFallo2FA(userId);
    throw new MovilNoApuntadoError();
  }
  return movil;
}

/**
 * Pasa a caducada una aprobación pendiente cuyo plazo ya pasó, y lo apunta en
 * la auditoría una sola vez (gana quien la cambia). Devuelve el estado de ahora.
 */
async function estadoAlDia(aprobacion: { id: string; userId: number; estado: EstadoAprobacion; expiraEn: Date }): Promise<EstadoAprobacion> {
  if (aprobacion.estado !== 'PENDIENTE' || aprobacion.expiraEn.getTime() > Date.now()) return aprobacion.estado;
  const { count } = await db.aprobacionEntrada.updateMany({
    where: { id: aprobacion.id, estado: 'PENDIENTE' },
    data: { estado: 'CADUCADA' },
  });
  if (count === 1) {
    await AuditoriaService.log(ACCIONES_AUDITORIA.ENTRADA_CADUCADA, { userId: aprobacion.userId }, 'aprobacion', aprobacion.id);
    return 'CADUCADA';
  }
  return (await db.aprobacionEntrada.findUnique({ where: { id: aprobacion.id }, select: { estado: true } }))?.estado ?? 'CADUCADA';
}

export class AprobacionEntradaService {

  // =================================================================
  //  «MI SEGURIDAD»: APUNTAR, LISTAR Y QUITAR MÓVILES
  // =================================================================

  /** Los móviles de la cuenta y si la función existe aquí (con la clave pública para suscribirse). */
  static async listar(userId: number) {
    const moviles = await db.movilApuntado.findMany({
      where: { userId },
      orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
      select: { id: true, nombre: true, creadoEn: true, usadoEn: true },
    });
    const hay = await disponible();
    return { disponible: hay, clavePublica: hay ? clavePublicaVapid() : null, moviles: moviles.map(aLista) };
  }

  /**
   * Apunta el móvil desde el que se llama, con su suscripción de push. Pide la
   * contraseña, como cambiar de móvil el código de la app: con una sesión
   * robada se podría apuntar un móvil propio y aprobar entradas para siempre.
   * Avisa por correo. Devuelve la clave del dispositivo en claro, una sola
   * vez: el móvil la guarda y aquí queda solo su hash.
   *
   * Un endpoint ya apuntado (el mismo navegador, otra vez) sustituye al de
   * antes, sea de la cuenta que sea: ese navegador guarda una sola clave, así
   * que la fila vieja ya no la tiene nadie.
   */
  static async apuntar(
    userId: number,
    datos: { password: string; nombre: string; suscripcion: SuscripcionPush },
    meta: MetaDeAuditoria = {},
  ): Promise<{ movil: MovilDeLaLista; clave: string }> {
    if (!(await disponible())) throw new HttpError('Los avisos en el móvil no están disponibles en esta instalación.', 409);

    const clave = String(userId);
    const restante = fallosAlApuntar.restanteBloqueo(clave);
    if (restante > 0) {
      throw new HttpError(`Demasiados intentos con la contraseña equivocada: espera ${Math.ceil(restante / 60000)} minuto(s).`, 429);
    }
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, nombre: true, password: true, active: true, twoFactorEnabled: true, hermanos: { where: { esTitular: true }, select: { sexo: true }, take: 1 } },
    });
    if (!user || !user.active) throw new HttpError('Tu sesión ha caducado. Vuelve a entrar.', 401);
    // Es otra forma de pasar el doble factor, no un sustituto: sin él activo no hay nada que aprobar.
    if (!user.twoFactorEnabled) throw new HttpError('Activa antes el doble factor con la app de autenticación.', 409);
    // 400 y no 401, como al cambiar la contraseña: la sesión es buena.
    if (!(await verified(datos.password, user.password))) {
      fallosAlApuntar.registrarFallo(clave);
      throw new HttpError('La contraseña no es correcta.');
    }
    fallosAlApuntar.limpiar(clave);

    const claveDelMovil = crypto.randomBytes(32).toString('base64url');
    const endpointHash = sha256(datos.suscripcion.endpoint);
    const nombre = datos.nombre.trim();
    const movil = await db.$transaction(async (tx) => {
      await tx.movilApuntado.deleteMany({ where: { endpointHash } });
      return tx.movilApuntado.create({
        data: {
          userId, nombre, endpoint: datos.suscripcion.endpoint, endpointHash,
          p256dh: datos.suscripcion.p256dh, auth: datos.suscripcion.auth, claveHash: sha256(claveDelMovil),
        },
        select: { id: true, nombre: true, creadoEn: true, usadoEn: true },
      });
    });

    await AuditoriaService.log(ACCIONES_AUDITORIA.MOVIL_APUNTAR, { ...meta, userId }, 'movil', movil.id);
    EmailService.enviarMovilApuntado(user.email, user.nombre, nombre, fechaYHoraParaCorreo(movil.creadoEn), user.hermanos[0]?.sexo ?? undefined)
      .catch((error) => console.error(`[Avisos] No se pudo avisar a ${enmascararEmail(user.email)} del móvil apuntado:`, error));

    return { movil: aLista(movil), clave: claveDelMovil };
  }

  static async quitar(userId: number, movilId: number, meta: MetaDeAuditoria = {}): Promise<void> {
    const { count } = await db.movilApuntado.deleteMany({ where: { id: movilId, userId } });
    if (count !== 1) throw new NotFoundError('Ese móvil no está apuntado en tu cuenta.');
    await AuditoriaService.log(ACCIONES_AUDITORIA.MOVIL_QUITAR, { ...meta, userId }, 'movil', movilId);
  }

  /**
   * Quita todos los móviles de la cuenta y anula lo que esperaba. Lo hacen los
   * que apagan el doble factor (desactivarlo para cambiar de móvil, un rescate
   * de Administración o de la consola): un móvil apuntado es un segundo factor
   * más, y quien rescata una cuenta perdida no puede dejarle otro vivo.
   */
  static async quitarTodos(tx: Prisma.TransactionClient, userId: number): Promise<number> {
    await tx.aprobacionEntrada.updateMany({
      where: { userId, estado: { in: ['PENDIENTE', 'APROBADA'] } },
      data: { estado: 'CADUCADA' },
    });
    return (await tx.movilApuntado.deleteMany({ where: { userId } })).count;
  }

  // =================================================================
  //  AL ENTRAR: PEDIR LA APROBACIÓN
  // =================================================================

  /**
   * Tras acertar la contraseña de una cuenta con 2FA: si tiene móviles, crea
   * la aprobación atada a `pendingToken` y les manda el aviso. Devuelve el
   * número para el ordenador y si se entra desde uno de esos móviles
   * (`esteMovil`, que no recibe aviso: aprueba ahí mismo).
   *
   * Sin aprobación (y el código de la app como siempre) si la función no está,
   * si el doble factor de la cuenta está bloqueado por fallos o si ya hay una
   * esperando: un aviso más por cada intento con la contraseña es justo el
   * cansancio de avisos que el número intenta evitar.
   */
  static async pedirAlEntrar(
    userId: number,
    pendingToken: string,
    { dispositivo, desde }: { dispositivo?: number; desde: string },
  ): Promise<{ aprobacion?: { numero: number; expiraEn: string }; esteMovil?: true }> {
    if (!(await disponible())) return {};
    try {
      comprobarBloqueo2FA(userId);
    } catch {
      return {};
    }

    const moviles = await db.movilApuntado.findMany({ where: { userId } });
    const esteMovil = dispositivo !== undefined && moviles.some((m) => m.id === dispositivo) ? { esteMovil: true as const } : {};
    const destinos = moviles.filter((m) => m.id !== dispositivo);
    if (!destinos.length) return esteMovil;

    const ahora = new Date();
    const esperando = await db.aprobacionEntrada.count({ where: { userId, estado: 'PENDIENTE', expiraEn: { gt: ahora } } });
    if (esperando) return esteMovil;

    // Las de hace más de un día ya no las mira nadie: lo que pasó queda en la auditoría.
    await db.aprobacionEntrada.deleteMany({ where: { creadoEn: { lt: new Date(ahora.getTime() - UN_DIA) } } });

    const { numero, opciones } = numeroYOpciones(crypto.randomInt);
    const aprobacion = await db.aprobacionEntrada.create({
      data: {
        id: crypto.randomBytes(16).toString('base64url'),
        userId, numero, opciones: opcionesATexto(opciones), desde,
        pendienteDe: sha256(pendingToken),
        expiraEn: new Date(ahora.getTime() + APROBACION_SEGUNDOS * 1000),
      },
    });

    // Sin esperar: el servicio de push puede tardar, y el ordenador tiene que
    // enseñar el número ya. Un móvil que el servicio da por muerto se borra.
    const aviso = {
      tipo: 'aprobar-entrada' as const,
      id: aprobacion.id,
      titulo: '¿Eres tú?',
      cuerpo: `Entrada al CMS desde ${desde}`,
      url: `/cms/aprobar/${aprobacion.id}`,
    };
    for (const movil of destinos) {
      enviarAviso({ endpoint: movil.endpoint, p256dh: movil.p256dh, auth: movil.auth }, aviso)
        .then(async (resultado) => {
          if (resultado === 'muerta') await db.movilApuntado.deleteMany({ where: { id: movil.id } });
        })
        .catch((error) => console.error('[Avisos] Fallo al mandar el aviso:', error));
    }

    return { aprobacion: { numero, expiraEn: aprobacion.expiraEn.toISOString() }, ...esteMovil };
  }

  // =================================================================
  //  EL ORDENADOR ESPERA
  // =================================================================

  /**
   * Lo que pregunta el ordenador cada pocos segundos, con su testigo. Si el
   * móvil ya aprobó, se gasta el testigo y se devuelve la sesión: el mismo
   * final que el código de la app.
   */
  static async consultar(
    pendingToken: string,
    testigo: DatosDelTestigo & { id: number; recordarme: boolean; origen: 'cms' | 'hermanos' },
  ) {
    const aprobacion = await db.aprobacionEntrada.findUnique({ where: { pendienteDe: sha256(pendingToken) } });
    // Sin aprobación para este testigo (o de otra cuenta, que no puede pasar): nada que esperar.
    if (!aprobacion || aprobacion.userId !== testigo.id) return { estado: 'CADUCADA' as const };

    const estado = await estadoAlDia(aprobacion);
    if (estado === 'USADA') return { estado: 'CADUCADA' as const };
    if (estado !== 'APROBADA') return { estado };

    const sesion = await pasarSinCodigo(testigo.id, testigo.recordarme, testigo.origen, testigo, async (tx) => {
      const { count } = await tx.aprobacionEntrada.updateMany({ where: { id: aprobacion.id, estado: 'APROBADA' }, data: { estado: 'USADA' } });
      return count === 1;
    });
    return { estado: 'APROBADA' as const, ...sesion };
  }

  // =================================================================
  //  EL MÓVIL: VER, APROBAR Y RECHAZAR
  // =================================================================

  /** La aprobación de esta cuenta, comprobado el móvil. Si no existe, 404. */
  private static async deLaCuenta(id: string, dispositivo: number, clave: string) {
    const aprobacion = await db.aprobacionEntrada.findUnique({ where: { id } });
    if (!aprobacion) throw new NotFoundError('Esta entrada ya no está esperando.');
    const movil = await movilConClave(aprobacion.userId, dispositivo, clave);
    return { aprobacion, movil };
  }

  static async ver(id: string, dispositivo: number, clave: string): Promise<VistaEnElMovil> {
    const { aprobacion } = await this.deLaCuenta(id, dispositivo, clave);
    const estado = await estadoAlDia(aprobacion);
    if (estado !== 'PENDIENTE') return { estado };
    return {
      estado, opciones: opcionesDeTexto(aprobacion.opciones), desde: aprobacion.desde, expiraEn: aprobacion.expiraEn.toISOString(),
    };
  }

  /**
   * Elegir un número. El bueno aprueba; cualquier otro la anula sin segundo
   * intento y cuenta como un código equivocado (mismo bloqueo creciente).
   */
  static async aprobar(id: string, dispositivo: number, clave: string, numero: number, meta: MetaDeAuditoria = {}) {
    const { aprobacion, movil } = await this.deLaCuenta(id, dispositivo, clave);
    comprobarBloqueo2FA(aprobacion.userId);
    const estado = await estadoAlDia(aprobacion);
    if (estado !== 'PENDIENTE') return { estado };

    const acierta = numero === aprobacion.numero;
    const { count } = await db.aprobacionEntrada.updateMany({
      where: { id, estado: 'PENDIENTE', expiraEn: { gt: new Date() } },
      data: { estado: acierta ? 'APROBADA' : 'FALLADA' },
    });
    // Otra petición (el mismo aviso abierto dos veces) llegó antes: manda la suya.
    if (count !== 1) return { estado: await estadoAlDia({ ...aprobacion, estado: 'PENDIENTE' }) };

    const quien = { ...meta, userId: aprobacion.userId };
    if (!acierta) {
      registrarFallo2FA(aprobacion.userId);
      await AuditoriaService.log(ACCIONES_AUDITORIA.ENTRADA_NUMERO_FALLADO, quien, 'aprobacion', id, { movil: movil.id });
      return { estado: 'FALLADA' as const };
    }
    await db.movilApuntado.update({ where: { id: movil.id }, data: { usadoEn: new Date() } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.ENTRADA_APROBADA, quien, 'aprobacion', id, { movil: movil.id, desde: aprobacion.desde });
    return { estado: 'APROBADA' as const };
  }

  /**
   * «No he sido yo». Alguien conoce la contraseña: se rechaza, se gasta el
   * testigo de ese navegador (tampoco podrá seguir con el código de la app) y
   * se avisa a Administración en el Inicio del CMS.
   */
  static async rechazar(id: string, dispositivo: number, clave: string, meta: MetaDeAuditoria = {}) {
    const { aprobacion, movil } = await this.deLaCuenta(id, dispositivo, clave);
    const estado = await estadoAlDia(aprobacion);
    if (estado !== 'PENDIENTE') return { estado };

    const rechazada = await db.$transaction(async (tx) => {
      const { count } = await tx.aprobacionEntrada.updateMany({ where: { id, estado: 'PENDIENTE' }, data: { estado: 'RECHAZADA' } });
      if (count !== 1) return null;
      const user = await tx.user.findUnique({ where: { id: aprobacion.userId }, select: { nombre: true, apellidos: true, role: true, twoFactorLastStep: true } });
      if (!user) return null;
      // Avanzar el paso deja sin valor todo testigo emitido hasta ahora.
      await tx.user.update({
        where: { id: aprobacion.userId },
        data: { twoFactorLastStep: Math.max(pasoTotpActual(), (user.twoFactorLastStep ?? -1) + 1) },
      });
      const texto = `${user.nombre} ${user.apellidos}`.trim() + ' ha rechazado desde su móvil una entrada al CMS con su cuenta: alguien conoce su contraseña.';
      await tx.avisoJunta.create({
        data: { texto: texto.length > 160 ? `${texto.slice(0, 159)}…` : texto, para: Role.ADMIN, urgente: true, creadoPorId: aprobacion.userId, creadorRol: user.role },
      });
      return true;
    });
    if (!rechazada) return { estado: await estadoAlDia({ ...aprobacion, estado: 'PENDIENTE' }) };

    await AuditoriaService.log(ACCIONES_AUDITORIA.ENTRADA_RECHAZADA, { ...meta, userId: aprobacion.userId }, 'aprobacion', id, { movil: movil.id, desde: aprobacion.desde });
    return { estado: 'RECHAZADA' as const };
  }

  // =================================================================
  //  ENTRAR DESDE EL MISMO MÓVIL
  // =================================================================

  /**
   * Quien entra desde su propio móvil apuntado no necesita aviso ni número:
   * esos protegen de una entrada hecha desde otro sitio, y aquí la clave del
   * dispositivo ya prueba que es ese móvil. Gasta el testigo como el código.
   */
  static async entrarDesdeEsteMovil(
    testigo: DatosDelTestigo & { id: number; recordarme: boolean; origen: 'cms' | 'hermanos' },
    dispositivo: number,
    clave: string,
    meta: MetaDeAuditoria = {},
  ) {
    if (!(await disponible())) throw new HttpError('Los avisos en el móvil no están disponibles en esta instalación.', 409);
    comprobarBloqueo2FA(testigo.id);
    const movil = await movilConClave(testigo.id, dispositivo, clave);
    const sesion = await pasarSinCodigo(testigo.id, testigo.recordarme, testigo.origen, testigo, async (tx) => {
      await tx.movilApuntado.update({ where: { id: movil.id }, data: { usadoEn: new Date() } });
      return true;
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.ENTRADA_DESDE_ESTE_MOVIL, { ...meta, userId: testigo.id }, 'movil', movil.id);
    return sesion;
  }
}
