import db from '../config/db';
import { encrypt } from '../utils/bcrypt.handle';
import { Prisma, Role } from '@prisma/client';
import { CreateHermanoDto, UpdateHermanoDto, EmancipateHermanoDto, UpdateAdminHermanoDto } from '../dtos/hermano.dto';
import { AuditService, AUDIT_ACTIONS, AuditMeta } from './audit.service';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { comprobarBajaNoFutura, comprobarFechasHermano, comprobarMayoriaDeEdad, diaDeHoy, instanteDeDia, mismoDia } from '../domain/fechas-hermano';
import { esCuentaAnonimizada } from '../domain/cuenta-anonimizada';
import { diferenciasFicha, valorParaAuditoria } from '../domain/cambios-ficha';
import crypto from 'crypto';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { esConflictoTransitorio } from '../utils/transaction-retry.js';

// 1. DICCIONARIO DE ERRORES (Centralizado)
const HERMANO_ERRORS = {
  DNI_DUPLICATE: 'Ese DNI ya está registrado.',
  MANAGER_NOT_FOUND: 'Usuario gestor no encontrado.',
  NOT_AUTHORIZED: 'Perfil no encontrado o no autorizado.',
  DNI_REQUIRED_EMANCIPATION: 'El hermano necesita DNI para tener cuenta propia.',
  EMAIL_IN_USE: 'El email ya está en uso.',
  USER_NOT_FOUND: 'Usuario no encontrado.',
  ALREADY_ACTIVE: 'Este usuario ya está activo en el sistema.',
  NOTHING_TO_APPROVE: 'Este usuario no tiene perfiles pendientes de aprobación.',
  CANNOT_DELETE_ACTIVE: 'No puedes destruir la cuenta de un hermano activo.',
  CANNOT_TOUCH_STAFF: 'Esta cuenta pertenece a un miembro del staff: gestiona su rol desde Administración.',
  PENDING_PROFILE: 'Este perfil aún no ha sido aprobado por Secretaría.',
  HERMANO_NOT_FOUND: 'Hermano no encontrado.',
  HERMANO_ALREADY_ACTIVE: 'El hermano ya está activo.',
  HERMANO_ALREADY_DOWN: 'Este hermano ya está dado de baja.',
  PROFILE_ALREADY_DOWN: 'Este perfil ya está dado de baja.',
  PENDING_USE_REQUESTS: 'Esta ficha es una solicitud de alta pendiente: se aprueba o se rechaza desde Solicitudes.',
  BAJA_ONLY_WHEN_DOWN: 'La fecha de baja solo se corrige en fichas que ya están de baja. Para dar de baja a un hermano, usa «Dar de baja».',
  NUMBER_ONLY_ACTIVE: 'El número de hermano solo se cambia en fichas activas: a las demás se lo asignan «Aprobar» o «Reactivar».',
  NUMBER_DUPLICATE: 'Ese número de hermano ya lo tiene otra ficha.',
  FICHA_CHANGED: 'La ficha ha cambiado mientras la editabas (alguien la ha dado de baja o reactivado). Vuelve a cargarla y repite el cambio.'
} as const;

// 2. INTERFAZ PARA EL BUSCADOR
export interface SearchHermanoQuery {
  q?: string;
  tunica?: string;
  puesto?: string;
  activo?: string;
  tieneTunicaPropia?: string;
  page?: string;
  limit?: string;
}

// 3. LISTAS BLANCAS DE CAMPOS EDITABLES (anti mass-assignment)
// El objeto que llega a Prisma se construye SOLO con estas claves. Nunca `{...body}`:
// Prisma acepta escrituras anidadas (user.update, recibos.updateMany...) y con el body
// crudo cualquier hermano podía ascenderse a ADMIN o marcar sus recibos como pagados.
const USER_EDITABLE_FIELDS = [
  'nombre', 'apellidos', 'fechaNacimiento', 'dni', 'telefono', 'email',
  'direccion', 'poblacion', 'codigoPostal'
] as const;

// Sin `activo`: la edición genérica de la ficha no da altas ni bajas. Esas van
// por aprobarSolicitud, reactivarHermano y darDeBajaHermano, que asignan o
// liberan el número, tocan la cuenta y dejan rastro en la auditoría.
// `fechaBaja` sigue aquí solo para CORREGIR la fecha de una ficha que ya está
// de baja (lo comprueba updateAdminMode).
const ADMIN_EDITABLE_FIELDS = [
  ...USER_EDITABLE_FIELDS,
  'tieneTunicaPropia', 'tunica', 'alturaHombro', 'puesto',
  'esTitular', 'numeroHermano',
  'fechaAlta', 'fechaBaja'
] as const;

type EditableField = typeof ADMIN_EDITABLE_FIELDS[number];

// Campos de la ficha que se pueden mostrar al staff sin exponer datos bancarios
const HERMANO_SAFE_SELECT = {
  id: true, nombre: true, apellidos: true, dni: true, fechaNacimiento: true,
  telefono: true, email: true, direccion: true, poblacion: true, codigoPostal: true,
  fechaAlta: true, activo: true, numeroHermano: true, fechaBaja: true, esTitular: true,
  tieneTunicaPropia: true, tunica: true, alturaHombro: true, puesto: true
} satisfies Prisma.HermanoSelect;

/** Una ficha pendiente de aprobación: nunca activa y sin baja. */
const FICHA_PENDIENTE = { activo: false, fechaBaja: null } satisfies Prisma.HermanoWhereInput;

/** Solo las cuentas de hermano raso (USER) se bloquean/borran al perder sus fichas. */
const esCuentaStaff = (role: Role) => role !== Role.USER;

const CAMPOS_FECHA = ['fechaNacimiento', 'fechaAlta', 'fechaBaja'] as const;

/**
 * Quita de los cambios las fechas que caen en el mismo día (de Madrid) que ya
 * tiene la ficha. El formulario manda el día, no la hora: reescribir un alta
 * aprobada a las 00:30 con el comienzo de su día no cambia nada visible, pero
 * sí el dato, y con el día UTC la movía al día anterior sin que nadie la tocara.
 */
function sinFechasDelMismoDia(cambios: Record<string, unknown>, actual: Record<string, unknown>): Record<string, unknown> {
  const limpios = { ...cambios };
  for (const campo of CAMPOS_FECHA) {
    const nuevo = limpios[campo];
    if (nuevo instanceof Date && mismoDia(nuevo, actual[campo] as Date | null)) delete limpios[campo];
  }
  return limpios;
}

// --- Reintento ante choques entre peticiones simultáneas ---
// El número de hermano se calcula como «el mayor + 1» sin bloquear la tabla. Dos
// aprobaciones a la vez leen el mismo máximo y la segunda en escribir choca con
// el índice único (P2002); si InnoDB detecta un interbloqueo, el error es P2034.
//
// Además, MariaDB 11.8 trae `innodb_snapshot_isolation=ON`: si una transacción
// intenta escribir una fila que otra cambió después de su primera lectura (dos
// clics seguidos en «Aprobar», «Dar de baja» o «Reactivar»), falla con el error
// 1020 («Record has changed since last read»), que Prisma no traduce a P2034 (la
// forma en que llega depende de la versión: la reconoce `esConflictoTransitorio`).
// Sin esto, un doble clic era un 500.
//
// En todos esos casos basta con repetir la transacción entera: la nueva lectura
// ya ve lo que hizo la otra (el número que se llevó, o que la ficha ya no está
// pendiente). Pocos intentos y con algo de azar en la espera, para que dos
// peticiones no reintenten al compás.
const INTENTOS_TRANSACCION = 4;

// P2002 solo es reintentable aquí, por el número de hermano: en general un
// duplicado es un error del usuario, no un choque transitorio.
function esChoqueReintentable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return true;
  return esConflictoTransitorio(e);
}

// `opciones` se reenvía tal cual a `db.$transaction` (mismo tipo que acepta
// Prisma: `timeout`, `maxWait`, `isolationLevel`). Casi nadie lo necesita —
// una transacción de una o dos fichas cabe de sobra en los 5 s por defecto—,
// pero quien procesa un lote (`cerrarHuecosDeNumero`) sí, y sin margen un
// timeout no es de los errores que reintenta `esChoqueReintentable`: Prisma
// deshace todo y no hay nada que reintentar, el lote es el mismo.
async function transaccionReintentable<T>(
  operacion: (tx: Prisma.TransactionClient) => Promise<T>,
  opciones?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
): Promise<T> {
  for (let intento = 1; ; intento += 1) {
    try {
      return await db.$transaction(operacion, opciones);
    } catch (e) {
      if (!esChoqueReintentable(e) || intento >= INTENTOS_TRANSACCION) throw e;
      await new Promise((resolver) => setTimeout(resolver, 20 * intento + Math.floor(Math.random() * 30)));
    }
  }
}

/** La ficha con lo que necesita la emancipación, venga del tutor o de secretaría. */
type FichaEmancipable = {
  id: number; userId: number; nombre: string; apellidos: string | null; telefono: string | null;
  direccion: string | null; dni: string | null; email: string | null; activo: boolean;
  esTitular: boolean; fechaNacimiento: Date | null; user: { role: Role };
};

export class HermanoService {

  // =================================================================
  //  ZONA GESTIÓN FAMILIAR
  // =================================================================

  static async getProfilesByUserId(userId: number, query: { page?: unknown; limit?: unknown } = {}) {
    const paginacion = sanearPaginacion(query);
    // Incluimos también las fichas pendientes de aprobación (activo:false sin fecha de baja)
    // para que el usuario vea que su familiar está "en trámite".
    const where = { userId, fechaBaja: null };

    const [data, total] = await db.$transaction([
      db.hermano.findMany({
        where,
        orderBy: [
          { fechaNacimiento: 'desc' },
          { id: 'asc' } // Desempate: con dos mellizos el orden quedaría a merced de MariaDB y
                        // una ficha podría salir en dos páginas y otra en ninguna.
        ],
        include: {
          recibos: { take: 1, orderBy: { year: 'desc' }, select: { year: true, estado: true } }
        },
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      db.hermano.count({ where })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }

  static async createDependentProfile(managerUserId: number, data: CreateHermanoDto, meta?: AuditMeta) {
    if (data.dni) {
      const existe = await db.hermano.findFirst({ where: { dni: data.dni } });
      if (existe) throw new HttpError(HERMANO_ERRORS.DNI_DUPLICATE, 409);
    }

    const manager = await db.user.findUnique({ where: { id: managerUserId } });
    if (!manager) throw new NotFoundError(HERMANO_ERRORS.MANAGER_NOT_FOUND);

    const esTitular = !!data.dni && data.dni === manager.dni;

    const creado = await db.hermano.create({
      data: {
        userId: managerUserId,
        esTitular,
        nombre: data.nombre,
        apellidos: data.apellidos || manager.apellidos,
        dni: data.dni || null,
        fechaNacimiento: new Date(data.fechaNacimiento),
        telefono: data.telefono || manager.telefono,
        email: data.email || manager.email,
        direccion: data.direccion || manager.direccion,
        poblacion: data.poblacion || manager.poblacion,
        codigoPostal: data.codigoPostal || manager.codigoPostal,
        // SEGURIDAD: un familiar nuevo NO entra en el censo hasta que Secretaría lo apruebe
        // (igual que el registro normal). Antes nacía activo y recibía cuotas sin control.
        activo: false
      }
    });

    // Auditoría: una solicitud de alta nueva desde el área familiar. Sin los datos
    // personales del familiar: basta el id de la ficha para encontrarlos.
    await AuditService.log(AUDIT_ACTIONS.FAMILIAR_CREAR, meta ?? {}, 'hermano', creado.id, {
      despues: { estado: 'pendiente', esTitular }
    });
    return creado;
  }

  static async updateProfileIfOwned(hermanoId: number, managerUserId: number, data: UpdateHermanoDto, meta?: AuditMeta) {
    const hermano = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId }
    });

    if (!hermano) return null; // Devolvemos null para que el Controller lance el 403 IDOR

    const dataToUpdate = sinFechasDelMismoDia(this.prepareUpdateData(data, USER_EDITABLE_FIELDS) as Record<string, unknown>, hermano);
    if (typeof dataToUpdate.dni === 'string' && dataToUpdate.dni !== hermano.dni) {
      await this.comprobarDniLibre(dataToUpdate.dni, hermanoId);
    }
    const detalles = diferenciasFicha(hermano, dataToUpdate);

    const actualizado = await db.hermano.update({
      where: { id: hermanoId },
      data: dataToUpdate as Prisma.HermanoUpdateInput
    });

    // Auditoría tras confirmar: el hermano cambió datos de su ficha o de la de un familiar
    if (detalles) await AuditService.log(AUDIT_ACTIONS.FAMILIAR_ACTUALIZAR, meta ?? {}, 'hermano', hermanoId, detalles);
    return actualizado;
  }

  /**
   * La familia retira un perfil desde el área de hermanos (Blindaje BOLA/IDOR).
   *
   * Dos casos distintos:
   * - Una SOLICITUD pendiente sin historial (nunca estuvo en el censo, sin
   *   recibos ni papeletas) se BORRA, igual que «Rechazar solicitud». Antes se le
   *   ponía fecha de baja y quedaba indistinguible de una baja real: el panel la
   *   contaba como alta y como baja.
   * - Cualquier otra ficha (activa, o pendiente con historial) se da de BAJA.
   */
  static async deleteProfileIfOwned(hermanoId: number, managerUserId: number, meta?: AuditMeta) {
    const check = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId },
      include: { user: { select: { role: true, active: true } } }
    });

    if (!check) return null;
    // Una segunda baja reescribiría la fecha de la primera y borraría la historia.
    if (check.fechaBaja) throw new HttpError(HERMANO_ERRORS.PROFILE_ALREADY_DOWN);

    const fechaBaja = new Date();
    const resultado = await transaccionReintentable(async (tx) => {
      // El estado y el historial se miran dentro de la transacción: con dos
      // clics seguidos, la segunda petición ve lo que ya hizo la primera.
      const actual = await tx.hermano.findFirst({
        where: { id: hermanoId, userId: managerUserId },
        select: {
          activo: true, fechaBaja: true,
          _count: { select: { recibos: true, papeletas: true, citas: true, transacciones: true, prendas: true } }
        }
      });
      if (!actual || actual.fechaBaja) throw new HttpError(HERMANO_ERRORS.PROFILE_ALREADY_DOWN);

      const pendiente = !actual.activo; // sin baja (visto arriba): el mismo criterio que FICHA_PENDIENTE
      const conHistorial = Object.values(actual._count).some((n) => n > 0);
      if (pendiente && !conHistorial) {
        await tx.hermano.delete({ where: { id: hermanoId } });
        // Retirar una solicitud no cambia nada de la cuenta: no se desactiva.
        return { retirada: true, cuentaDesactivada: false };
      }

      // La baja familiar libera el número igual que la de secretaría
      // (darDeBajaHermano): una ficha de baja con número lo retenía sin estar en
      // el censo, y al reactivarla se le daba otro de todas formas. El estado va
      // en el `where` para que dos clics seguidos no den dos bajas.
      const { count } = await tx.hermano.updateMany({
        where: { id: hermanoId, fechaBaja: null },
        data: { activo: false, fechaBaja, numeroHermano: null }
      });
      if (count === 0) throw new HttpError(HERMANO_ERRORS.PROFILE_ALREADY_DOWN);

      const restantes = await tx.hermano.count({
        where: { userId: managerUserId, activo: true }
      });

      // Solo las cuentas de hermano raso se desactivan al quedarse sin fichas.
      // Un ADMIN/SECRETARÍA que borra su propia ficha no debe perder el acceso al CMS.
      if (restantes === 0 && !esCuentaStaff(check.user.role)) {
        await tx.user.update({
          where: { id: managerUserId },
          data: { active: false }
        });
        return { retirada: false, cuentaDesactivada: true };
      }
      return { retirada: false, cuentaDesactivada: false };
    });

    if (resultado.retirada) {
      // Como en rechazarSolicitud: solo el estado, sin los datos de la ficha borrada.
      await AuditService.log(AUDIT_ACTIONS.FAMILIAR_SOLICITUD_RETIRAR, meta ?? {}, 'hermano', hermanoId, {
        antes: { estado: 'pendiente' }, despues: { estado: 'eliminada' }
      });
      return { message: 'Solicitud retirada: el perfil pendiente se ha eliminado.' };
    }

    await AuditService.log(AUDIT_ACTIONS.HERMANO_BAJA_FAMILIAR, meta ?? {}, 'hermano', hermanoId, {
      antes: { activo: check.activo, numeroHermano: check.numeroHermano, fechaBaja: null, cuentaActiva: check.user.active },
      despues: { activo: false, numeroHermano: null, fechaBaja: valorParaAuditoria(fechaBaja), cuentaActiva: check.user.active && !resultado.cuentaDesactivada }
    });

    return resultado.cuentaDesactivada
      ? { message: 'Perfil dado de baja. Usuario gestor desactivado.' }
      : { message: 'Perfil dado de baja correctamente.' };
  }

  // =================================================================
  //  ZONA EMANCIPACIÓN
  // =================================================================

  /** El tutor emancipa a su dependiente y elige la contraseña. */
  static async emancipateProfile(hermanoId: number, managerUserId: number, dto: EmancipateHermanoDto, meta?: AuditMeta) {
    const hermano = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId },
      include: { user: { select: { role: true } } }
    });
    if (!hermano) throw new HttpError(HERMANO_ERRORS.NOT_AUTHORIZED, 403);

    return await this.emanciparFicha(hermano, dto.newEmail, dto.newDni, await encrypt(dto.newPassword), false, meta);
  }

  /**
   * Secretaría emancipa: la contraseña no la elige nadie, va un enlace al
   * hermano. Quien está en el mostrador no puede saber la contraseña de otro.
   */
  static async emancipateByStaff(hermanoId: number, dto: { newEmail: string; newDni?: string }, meta?: AuditMeta) {
    const hermano = await db.hermano.findUnique({
      where: { id: hermanoId },
      include: { user: { select: { role: true } } }
    });
    if (!hermano) throw new NotFoundError(HERMANO_ERRORS.HERMANO_NOT_FOUND);

    // Una contraseña aleatoria que nadie conoce: la cuenta se abre con el enlace.
    const inutilizable = await encrypt(crypto.randomBytes(32).toString('hex'));
    return await this.emanciparFicha(hermano, dto.newEmail, dto.newDni, inutilizable, true, meta);
  }

  /**
   * Tronco común de la emancipación: las reglas y la transacción son las mismas
   * venga de donde venga. Lo único que cambia entre los dos caminos es cómo
   * nace la contraseña de la cuenta nueva.
   */
  private static async emanciparFicha(
    hermano: FichaEmancipable,
    newEmail: string,
    newDni: string | undefined,
    hashedPassword: string,
    mandarEnlace: boolean,
    meta?: AuditMeta
  ) {
    const hermanoId = hermano.id;
    const managerUserId = hermano.userId;

    // Una ficha pendiente de aprobación no puede convertirse en una cuenta activa
    if (!hermano.activo) throw new HttpError(HERMANO_ERRORS.PENDING_PROFILE);

    // Cuenta propia solo con 18 años cumplidos. Sin esta regla se podía dar
    // cuenta a un niño, y el tutor perdía la suya si era su último perfil activo.
    comprobarMayoriaDeEdad(hermano.fechaNacimiento);

    const dniFinal = hermano.dni || newDni;
    if (!dniFinal) throw new HttpError(HERMANO_ERRORS.DNI_REQUIRED_EMANCIPATION);

    const emailExists = await db.user.findUnique({ where: { email: newEmail } });
    if (emailExists) throw new HttpError(HERMANO_ERRORS.EMAIL_IN_USE, 409);

    // El DNI también es único en User: si ya pertenece a otra cuenta (ej. el propio tutor),
    // la transacción fallaría con un error crudo de BD. Lo comprobamos antes.
    const dniExists = await db.user.findFirst({ where: { dni: dniFinal } });
    if (dniExists) throw new HttpError('Ese DNI ya pertenece a otra cuenta de usuario.', 409);

    const { cuenta, tutorDesactivado } = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: newEmail,
          password: hashedPassword,
          role: Role.USER,
          dni: dniFinal,
          nombre: hermano.nombre,
          apellidos: hermano.apellidos || '',
          telefono: hermano.telefono || '',
          direccion: hermano.direccion || '',
          active: true
        }
      });

      await tx.hermano.update({
        where: { id: hermanoId },
        data: { userId: newUser.id, esTitular: true, email: newEmail, dni: dniFinal }
      });

      // --- Control del Gestor Fantasma ---
      const restantes = await tx.hermano.count({
        where: { userId: managerUserId, activo: true }
      });

      let desactivado = false;
      if (restantes === 0 && !esCuentaStaff(hermano.user.role)) {
        await tx.user.update({
          where: { id: managerUserId },
          data: { active: false }
        });
        desactivado = true;
      }
      // ------------------------------------------

      // Devolvemos solo datos seguros (nunca el hash de la contraseña)
      return { cuenta: { id: newUser.id, email: newUser.email, nombre: newUser.nombre }, tutorDesactivado: desactivado };
    });

    // Auditoría DESPUÉS de confirmar: creación de una cuenta nueva derivada de un
    // perfil familiar. Antes se escribía dentro de la transacción y quedaba
    // constancia aunque esta se deshiciera.
    await AuditService.log(AUDIT_ACTIONS.EMANCIPACION, meta ?? {}, 'hermano', hermanoId, {
      origen: mandarEnlace ? 'secretaría' : 'tutor',
      antes: { userId: managerUserId, esTitular: hermano.esTitular, email: hermano.email, dni: hermano.dni, cuentaTutorActiva: true },
      despues: { userId: cuenta.id, esTitular: true, email: newEmail, dni: dniFinal, cuentaTutorActiva: !tutorDesactivado }
    });

    if (mandarEnlace) {
      // Fuera de la transacción y con catch, como en requestPasswordReset: que
      // falle el correo no puede deshacer una emancipación ya escrita.
      const token = await AuthService.crearEnlaceDeContrasena(cuenta.id, 72);
      EmailService.enviarRecuperacionContrasena(cuenta.email, cuenta.nombre, token)
        .catch(err => console.error('Error enviando el enlace de emancipación:', err));
    }

    return cuenta;
  }

  // =================================================================
  //  ZONA ADMIN (CENSO Y BUSCADOR)
  // =================================================================

  static async searchHermanos(query: SearchHermanoQuery) {
    const paginacion = sanearPaginacion(query);

    const where: Prisma.HermanoWhereInput = {};

    if (query.q) {
      where.OR = [
        { nombre: { contains: query.q } },
        { apellidos: { contains: query.q } },
        { dni: { contains: query.q } },
        { email: { contains: query.q } }
      ];
    }

    if (query.tunica) where.tunica = { contains: query.tunica };
    if (query.puesto) where.puesto = { contains: query.puesto };
    if (query.activo) where.activo = query.activo === 'true';
    if (query.tieneTunicaPropia) where.tieneTunicaPropia = query.tieneTunicaPropia === 'true';

    const [data, total] = await db.$transaction([
      db.hermano.findMany({
        where, skip: paginacion.skip, take: paginacion.take,
        orderBy: [
          { apellidos: 'asc' },
          { id: 'asc' } // Desempate: en un censo de familias los apellidos se repiten a
                        // pares y a tríos, y sin este criterio MariaDB no garantiza el
                        // mismo orden entre la página 1 y la 2: una ficha saldría dos
                        // veces y otra ninguna.
        ],
        // `select` y no `include`: con `include` salían todos los escalares de la
        // ficha, IBAN, titular de la cuenta y forma de pago incluidos, a cualquiera
        // que abriera el buscador del censo.
        select: { ...HERMANO_SAFE_SELECT, user: { select: { telefono: true, email: true } } }
      }),
      db.hermano.count({ where })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }

  // Ver todos los hermanos
  static async getAllHermanos(query: { page?: unknown; limit?: unknown } = {}) {
    const paginacion = sanearPaginacion(query);

    const [data, total] = await db.$transaction([
      db.hermano.findMany({
        where: { activo: true },
        orderBy: [
          { numeroHermano: 'asc' }, // Ordenamos por número en lugar de apellidos
          { id: 'asc' } // Desempate: `numeroHermano` es @unique pero opcional, y en MariaDB
                        // el índice único no impide varios NULL, así que las fichas activas
                        // aún sin número quedarían en orden arbitrario entre la página 1 y
                        // la 2: una saldría dos veces y otra ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take,
        // Sin datos bancarios, como el buscador (ver searchHermanos).
        select: {
          ...HERMANO_SAFE_SELECT,
          user: { select: { nombre: true, apellidos: true, telefono: true } }
        }
      }),
      db.hermano.count({ where: { activo: true } })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }

  // Ver un hermano por ID
  static async getHermanoById(id: number) {
    return await db.hermano.findUnique({
      where: { id },
      select: {
        ...HERMANO_SAFE_SELECT,
        user: { select: { email: true, telefono: true } },
        recibos: {
          orderBy: { year: 'desc' },
          select: {
            id: true, year: true, concepto: true, importe: true, fechaEmision: true,
            tipo: true, estado: true, fechaPago: true, metodoPago: true,
            observaciones: true, createdAt: true, updatedAt: true
          }
        },
        papeletas: {
          orderBy: { year: 'desc' },
          select: {
            id: true, year: true, puesto: true, tramo: true, numero: true,
            numTunicaAsignada: true, numCapiroteAsignado: true, observaciones: true,
            reciboId: true, citaId: true, createdAt: true, updatedAt: true
          }
        }
      }
    });
  }

  /**
   * Edición de la ficha desde el CMS. No da altas ni bajas (ver
   * ADMIN_EDITABLE_FIELDS): corrige datos, y cada cambio queda en la auditoría
   * con su valor anterior.
   */
  static async updateAdminMode(id: number, data: UpdateAdminHermanoDto, meta?: AuditMeta) {
    const pedidos = this.prepareUpdateData(data, ADMIN_EDITABLE_FIELDS) as Record<string, unknown>;
    // El esquema ya no admite null, pero el servicio no sabe quién le llama:
    // quitar la baja es reactivar, y eso tiene su propia operación.
    if (pedidos.fechaBaja === null) throw new HttpError('Para quitar la baja de un hermano, usa «Reactivar».');

    // Lectura, comprobaciones y escritura en la MISMA transacción: si mientras
    // tanto alguien da de baja o reactiva la ficha, las reglas de abajo se
    // evaluarían sobre un estado que ya no existe (una corrección de la fecha
    // de baja podía dejar una ficha activa con fecha de baja).
    const { actualizado, detalles } = await transaccionReintentable(async (tx) => {
      const actual = await tx.hermano.findUnique({ where: { id }, select: HERMANO_SAFE_SELECT });
      if (!actual) throw new NotFoundError(HERMANO_ERRORS.HERMANO_NOT_FOUND);

      const cambios = sinFechasDelMismoDia(pedidos, actual);
      const deBaja = !actual.activo && actual.fechaBaja !== null;

      // La fecha de baja solo se corrige donde ya hay una baja. Ponérsela a una
      // ficha activa dejaba a alguien de baja pero activo, y a una pendiente la
      // sacaba de las solicitudes sin rechazarla.
      if (cambios.fechaBaja !== undefined) {
        if (!deBaja) throw new HttpError(HERMANO_ERRORS.BAJA_ONLY_WHEN_DOWN);
        comprobarBajaNoFutura(cambios.fechaBaja as Date);
      }

      // El número lo dan «Aprobar» y «Reactivar»: puesto a mano en una ficha
      // pendiente o de baja, reservaría un número a quien no está en el censo.
      if (cambios.numeroHermano !== undefined && cambios.numeroHermano !== actual.numeroHermano) {
        if (!actual.activo) throw new HttpError(HERMANO_ERRORS.NUMBER_ONLY_ACTIVE);
        const ocupado = await tx.hermano.findFirst({
          where: { numeroHermano: cambios.numeroHermano as number, id: { not: id } },
          select: { id: true }
        });
        if (ocupado) throw new HttpError(HERMANO_ERRORS.NUMBER_DUPLICATE, 409);
      }

      if (typeof cambios.dni === 'string' && cambios.dni !== actual.dni) {
        await this.comprobarDniLibre(cambios.dni, id, tx);
      }

      // La baja se compara con el alta que vaya a quedar en la ficha, no solo con
      // la que venga en el cuerpo: cambiar únicamente una de las dos es lo habitual.
      comprobarFechasHermano(
        (cambios.fechaAlta as Date | undefined) ?? actual.fechaAlta,
        (cambios.fechaBaja as Date | undefined) ?? actual.fechaBaja
      );

      const diferencias = diferenciasFicha(actual, cambios);
      // Nada que cambie de verdad: no se escribe (ni se reescriben fechas).
      if (!diferencias) return { actualizado: actual, detalles: null };

      // Escritura condicionada al estado que se ha leído (alta, baja y número).
      // Con la aislamiento de instantáneas de MariaDB 11.8, una escritura cruzada
      // suele saltar antes como error 1020 y la transacción se repite con el
      // estado nuevo; esta condición es la red por si no: si la ficha ya no
      // está como se leyó, no se toca y se avisa.
      const { count } = await tx.hermano.updateMany({
        where: { id, activo: actual.activo, fechaBaja: actual.fechaBaja, numeroHermano: actual.numeroHermano },
        data: cambios as Prisma.HermanoUpdateManyMutationInput
      });
      if (count === 0) throw new HttpError(HERMANO_ERRORS.FICHA_CHANGED, 409);

      // `select` también aquí: la respuesta del PUT devolvía la ficha entera, IBAN incluido.
      const releida = await tx.hermano.findUnique({ where: { id }, select: HERMANO_SAFE_SELECT });
      return { actualizado: releida!, detalles: diferencias };
    });

    // Auditoría tras confirmar (fuera del cuerpo que se reintenta), y solo si
    // algo cambió de verdad.
    if (detalles) await AuditService.log(AUDIT_ACTIONS.HERMANO_ACTUALIZAR, meta ?? {}, 'hermano', id, detalles);
    return actualizado;
  }

  /**
   * Vuelve a dar de alta a un hermano que estaba de baja: número nuevo al final
   * de la cola, alta de hoy y su cuenta de nuevo con acceso.
   *
   * Si la cuenta se anonimizó por el derecho de supresión (RGPD), la ficha
   * vuelve al censo pero la cuenta NO se reabre: su titular pidió que se
   * borraran sus datos y la cuenta ya no tiene ni correo ni contraseña que
   * sirvan. Si vuelve a necesitar acceso, se le crea una cuenta nueva con la
   * emancipación, que le manda un enlace a un correo que dé él.
   */
  static async reactivarHermano(hermanoId: number, meta?: AuditMeta) {
    const hermano = await db.hermano.findUnique({
      where: { id: hermanoId },
      include: { user: { select: { email: true, dni: true, active: true } } }
    });
    if (!hermano) throw new NotFoundError(HERMANO_ERRORS.HERMANO_NOT_FOUND);
    if (hermano.activo) throw new HttpError(HERMANO_ERRORS.HERMANO_ALREADY_ACTIVE);
    // Una solicitud pendiente no se «reactiva»: nunca estuvo activa. Antes esta
    // ruta la aprobaba sin pasar por Solicitudes.
    if (hermano.fechaBaja === null) throw new HttpError(HERMANO_ERRORS.PENDING_USE_REQUESTS);

    const anonimizada = esCuentaAnonimizada(hermano.user);
    const fechaAlta = new Date();

    const { numero, cuentaActiva } = await transaccionReintentable(async (tx) => {
      // Le mandamos al final de la cola
      const nextNum = await this.getNextNumeroHermano(tx);

      // El estado va en el `where`: InnoDB lo evalúa sobre la última versión
      // confirmada, así que con dos clics seguidos la segunda petición no
      // encuentra nada que reactivar y no se lleva otro número.
      const { count } = await tx.hermano.updateMany({
        where: { id: hermanoId, activo: false, fechaBaja: { not: null } },
        data: {
          activo: true,
          fechaBaja: null, // Limpiamos la fecha de baja
          fechaAlta, // Nueva fecha de alta
          numeroHermano: nextNum
        }
      });
      if (count === 0) throw new HttpError(HERMANO_ERRORS.HERMANO_ALREADY_ACTIVE);

      // Aseguramos que su cuenta de usuario vuelva a tener acceso, salvo que
      // esté anonimizada (ver el comentario de la función).
      if (!anonimizada && !hermano.user.active) {
        await tx.user.update({
          where: { id: hermano.userId },
          data: { active: true }
        });
      }

      return { numero: nextNum, cuentaActiva: anonimizada ? hermano.user.active : true };
    });

    // Auditoría tras confirmar: reactivación de un miembro del censo
    await AuditService.log(AUDIT_ACTIONS.HERMANO_REACTIVAR, meta ?? {}, 'hermano', hermanoId, {
      antes: {
        activo: false, numeroHermano: null, fechaAlta: valorParaAuditoria(hermano.fechaAlta),
        fechaBaja: valorParaAuditoria(hermano.fechaBaja), cuentaActiva: hermano.user.active
      },
      despues: {
        activo: true, numeroHermano: numero, fechaAlta: valorParaAuditoria(fechaAlta),
        fechaBaja: null, cuentaActiva
      },
      ...(anonimizada ? { cuentaAnonimizada: true } : {})
    });

    if (anonimizada) {
      return {
        message: `Hermano reactivado con el número ${numero}. Su cuenta de acceso se eliminó a petición suya (RGPD) y sigue cerrada: si necesita entrar en la web, créale una cuenta nueva desde su ficha.`
      };
    }
    return { message: `Hermano reactivado correctamente. Se le ha asignado el nuevo número ${numero}.` };
  }

  /**
   * Baja desde secretaría. `fechaBajaTexto` (AAAA-MM-DD) permite anotar la baja
   * con el día en que el hermano avisó; sin ella, la baja es de ahora.
   */
  static async darDeBajaHermano(hermanoId: number, meta?: AuditMeta, fechaBajaTexto?: string) {
    const hermano = await db.hermano.findUnique({
      where: { id: hermanoId },
      // `user.email` es el respaldo del aviso de baja: las fichas antiguas
      // pueden no tener dirección propia, y la de un menor es la del tutor.
      include: { user: { select: { role: true, active: true, email: true } } }
    });
    if (!hermano) throw new NotFoundError(HERMANO_ERRORS.HERMANO_NOT_FOUND);
    if (!hermano.activo) {
      // Una solicitud pendiente se rechaza, no se da de baja: nunca estuvo en el censo.
      throw new HttpError(hermano.fechaBaja === null ? HERMANO_ERRORS.PENDING_USE_REQUESTS : HERMANO_ERRORS.HERMANO_ALREADY_DOWN);
    }

    // Un día pasado se guarda como el comienzo de ese día en Madrid; la baja de
    // hoy (o sin fecha), con la hora real, como los apuntes contables del día.
    const fechaBaja = fechaBajaTexto && fechaBajaTexto !== diaDeHoy() ? instanteDeDia(fechaBajaTexto, 'fechaBaja') : new Date();
    comprobarBajaNoFutura(fechaBaja);
    comprobarFechasHermano(hermano.fechaAlta, fechaBaja);

    const cuentaBloqueada = await transaccionReintentable(async (tx) => {
      // El estado va en el `where` (ver reactivarHermano): dos clics seguidos
      // no dan dos bajas.
      const { count } = await tx.hermano.updateMany({
        where: { id: hermanoId, activo: true },
        // Liberamos el número: al reactivar se le asigna uno nuevo (final de la cola)
        data: { activo: false, fechaBaja, numeroHermano: null }
      });
      if (count === 0) throw new HttpError(HERMANO_ERRORS.HERMANO_ALREADY_DOWN);

      const restantes = await tx.hermano.count({
        where: { userId: hermano.userId, activo: true }
      });

      // SEGURIDAD: nunca bloqueamos la cuenta de un miembro del staff desde aquí.
      // Antes, Secretaría podía dejar sin acceso al ADMIN dando de baja su ficha.
      if (restantes === 0 && !esCuentaStaff(hermano.user.role)) {
        await tx.user.update({
          where: { id: hermano.userId },
          data: { active: false }
        });
        return true;
      }
      return false;
    });

    // Auditoría tras confirmar: baja de un miembro del censo. El número que tenía
    // queda aquí, porque en la ficha se borra.
    await AuditService.log(AUDIT_ACTIONS.HERMANO_BAJA, meta ?? {}, 'hermano', hermanoId, {
      antes: { activo: true, numeroHermano: hermano.numeroHermano, fechaBaja: null, cuentaActiva: hermano.user.active },
      despues: { activo: false, numeroHermano: null, fechaBaja: valorParaAuditoria(fechaBaja), cuentaActiva: hermano.user.active && !cuentaBloqueada }
    });

    // Aviso de la baja, fuera de la transacción y con catch: la baja ya está
    // escrita y un correo no puede deshacerla.
    const destino = hermano.email || hermano.user.email;
    if (destino) {
      EmailService.enviarBajaORechazo(destino, hermano.nombre, 'baja')
        .catch((err) => console.error('Error enviando el aviso de baja:', err));
    }

    return cuentaBloqueada
      ? { message: `${hermano.nombre} ${hermano.apellidos} dado de baja. Se ha bloqueado el acceso a la App porque no le quedan perfiles activos.` }
      : { message: `${hermano.nombre} ${hermano.apellidos} dado de baja. El usuario mantiene el acceso.` };
  }

  // =================================================================
  //  GESTIÓN DE SOLICITUDES DE ALTA (SECRETARÍA)
  // =================================================================

  /**
   * Solicitudes pendientes: cuentas USER con alguna ficha sin aprobar (activo:false y sin
   * fecha de baja). Incluye tanto registros nuevos (cuenta inactiva) como familiares añadidos
   * por un hermano ya aprobado (cuenta activa, ficha pendiente).
   *
   * SEGURIDAD: `select` explícito. Antes se devolvía el objeto User completo con el hash
   * de contraseña, el secreto 2FA, el token de reset y el IBAN de las fichas.
   */
  static async getSolicitudesPendientes(query: { page?: unknown; limit?: unknown } = {}) {
    const paginacion = sanearPaginacion(query);
    const where: Prisma.UserWhereInput = {
      role: Role.USER,
      hermanos: {
        some: FICHA_PENDIENTE
      }
    };

    const [data, total] = await db.$transaction([
      db.user.findMany({
        where,
        select: {
          id: true, email: true, dni: true, nombre: true, apellidos: true, telefono: true,
          direccion: true, poblacion: true, codigoPostal: true, active: true, createdAt: true,
          hermanos: {
            where: FICHA_PENDIENTE,
            select: HERMANO_SAFE_SELECT
          }
        },
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' } // Desempate: dos altas registradas en el mismo segundo —una familia
                        // que se apunta seguida desde el mismo formulario, o una siembra que
                        // las inserta de golpe— comparten `createdAt` y MariaDB las ordenaría
                        // a su antojo: una saldría en dos páginas y otra en ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take
      }),
      db.user.count({ where })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }

  static async aprobarSolicitud(userId: number, meta?: AuditMeta) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { hermanos: { where: FICHA_PENDIENTE, select: { id: true } } } // Solo las fichas pendientes
    });

    if (!user) throw new NotFoundError(HERMANO_ERRORS.USER_NOT_FOUND);
    if (user.hermanos.length === 0) {
      throw new HttpError(user.active ? HERMANO_ERRORS.NOTHING_TO_APPROVE : HERMANO_ERRORS.ALREADY_ACTIVE);
    }

    const fechaAlta = new Date();
    const { aprobadas, cuentaActivada } = await transaccionReintentable(async (tx) => {
      // Las fichas se vuelven a leer DENTRO de la transacción: con dos clics
      // seguidos en «Aprobar», la segunda petición no debe numerar otra vez las
      // que la primera ya aprobó (antes, número saltado o un 500).
      const pendientes = await tx.hermano.findMany({
        where: { userId, ...FICHA_PENDIENTE },
        orderBy: { id: 'asc' },
        select: { id: true }
      });

      // A cada ficha pendiente le damos de alta y le asignamos un número consecutivo.
      // (Las fichas ya activas no se tocan: no se les reasigna número.)
      const hechas: { id: number; numeroHermano: number }[] = [];
      for (const { id } of pendientes) {
        const nextNum = await this.getNextNumeroHermano(tx);
        // El estado en el `where` es la segunda red: si otra petición la aprobó
        // entre la lectura y esta escritura, no se toca (count = 0).
        const { count } = await tx.hermano.updateMany({
          where: { id, ...FICHA_PENDIENTE },
          data: { activo: true, fechaAlta, numeroHermano: nextNum }
        });
        if (count === 1) hechas.push({ id, numeroHermano: nextNum });
      }
      if (hechas.length === 0) throw new HttpError(HERMANO_ERRORS.NOTHING_TO_APPROVE);

      const cuenta = await tx.user.findUnique({ where: { id: userId }, select: { active: true } });
      if (cuenta && !cuenta.active) {
        await tx.user.update({ where: { id: userId }, data: { active: true } });
      }
      return { aprobadas: hechas, cuentaActivada: !!cuenta && !cuenta.active };
    });

    // Auditoría tras confirmar: alta oficial de miembros (trámite de Secretaría)
    await AuditService.log(AUDIT_ACTIONS.SOLICITUD_APROBAR, meta ?? {}, 'user', userId, {
      antes: { cuentaActiva: !cuentaActivada, fichasPendientes: aprobadas.map((f) => f.id) },
      despues: { cuentaActiva: true, fichasAprobadas: aprobadas }
    });

    // Aviso al hermano, fuera de la transacción y con catch: aprobar no puede
    // deshacerse porque falle un correo (el fallo queda en la auditoría como
    // EMAIL_FALLIDO). Antes esta operación era muda y el hermano no se enteraba
    // ni de su alta ni de su número.
    EmailService.enviarAprobacionSolicitud(
      user.email,
      user.nombre,
      aprobadas.map((f) => f.numeroHermano)
    ).catch((err) => console.error('Error enviando el aviso de aprobación:', err));

    return { message: 'Solicitud aprobada. Los perfiles ya son oficiales y tienen número de hermano asignado.' };
  }

  /**
   * REORDENACIÓN DEL CENSO (Proceso anual de Secretaría)
   * Asigna un nuevo número correlativo a todos los hermanos activos
   * basándose estrictamente en su fecha de alta (antigüedad).
   */
  static async reordenarCenso(meta?: AuditMeta) {
    // Todo en UNA transacción para que, si falla a la mitad, no quede el censo corrupto.
    // `transaccionReintentable` (no `db.$transaction` a pelo): un reordenamiento
    // toca a todo el censo activo, y con eso hay más ocasión de chocar con una
    // aprobación o una baja que esté firmando a la vez.
    //
    // Las dos lecturas van DENTRO del cuerpo, y con `tx`: el cuerpo se reintenta,
    // y con la foto tomada fuera el reintento renumeraba sobre una realidad que
    // ya había cambiado. Quien entrase en el censo entre la lectura y el reintento
    // se comía el `numeroHermano: null` del `updateMany` de abajo, no estaba en la
    // lista que reparte 1..N, nadie le reasignaba número y el reintento confirmaba
    // una ficha `activo: true` sin número: el estado que el censo declara imposible.
    // Leyendo dentro, cada intento parte del censo real del momento.
    const { hermanosActivos, inactivosConNumero } = await transaccionReintentable(async (tx) => {
      // 1. TODOS los hermanos activos, ordenados por fecha de alta (los más antiguos primero)
      const hermanosActivos = await tx.hermano.findMany({
        where: { activo: true },
        orderBy: [{ fechaAlta: 'asc' }, { id: 'asc' }],
        select: { id: true, numeroHermano: true } // Traemos lo mínimo para no saturar la memoria
      });

      // Lanzar aquí aborta la transacción sin tocar nada, y el error sale del
      // servicio igual que cuando la lectura estaba fuera: un `HttpError` no es
      // P2002 ni un conflicto transitorio, así que `esChoqueReintentable` no lo
      // toma por un choque y no lo repite (fijado en test/numero-hermano.test.ts).
      if (hermanosActivos.length === 0) {
        throw new HttpError('No hay hermanos activos en el censo para reordenar.');
      }

      // Fichas fuera del censo que aún conservan número (bajas familiares de antes
      // de que se liberara): la reordenación se lo quita, y eso también se anota.
      const inactivosConNumero = await tx.hermano.findMany({
        where: { activo: false, numeroHermano: { not: null } },
        select: { id: true, numeroHermano: true }
      });

      // numeroHermano es @unique y MySQL comprueba el índice por sentencia: si asignamos
      // 1..N directamente, el primer número ya ocupado por otro hermano lanza P2002.
      // Solución: liberamos TODOS los números primero (NULL no colisiona) y luego asignamos.
      await tx.hermano.updateMany({ data: { numeroHermano: null } });

      for (let index = 0; index < hermanosActivos.length; index++) {
        await tx.hermano.update({
          where: { id: hermanosActivos[index].id },
          data: { numeroHermano: index + 1 }
        });
      }

      // Las dos listas salen para la auditoría y el recuento de abajo: son la foto
      // del intento que de verdad se confirmó, no la de una lectura anterior.
      return { hermanosActivos, inactivosConNumero };
    }, { timeout: 60_000 }); // Censos grandes: damos margen a la transacción

    // Auditoría tras confirmar: renumeración completa del censo (operación
    // delicada). Solo los números que cambian, con el de antes y el de después.
    const antes: Record<string, number | null> = {};
    const despues: Record<string, number | null> = {};
    hermanosActivos.forEach((h, index) => {
      if (h.numeroHermano !== index + 1) {
        antes[`hermano #${h.id}`] = h.numeroHermano;
        despues[`hermano #${h.id}`] = index + 1;
      }
    });
    for (const h of inactivosConNumero) {
      antes[`hermano #${h.id}`] = h.numeroHermano;
      despues[`hermano #${h.id}`] = null;
    }
    await AuditService.log(AUDIT_ACTIONS.CENSO_REORDENAR, meta ?? {}, 'hermano', `total:${hermanosActivos.length}`, {
      totalProcesados: hermanosActivos.length,
      antes,
      despues
    });

    return {
      message: 'Censo reordenado con éxito.',
      totalProcesados: hermanosActivos.length
    };
  }

  /**
   * Da número de hermano a las fichas activas que no lo tienen, por antigüedad.
   *
   * No renumera a nadie: quien ya tiene número lo conserva, porque lleva
   * décadas con él y el censo real llega con su numeración hecha. Esto cierra
   * huecos, no reordena; para reordenar está `reordenarCenso`.
   *
   * Se lanza a mano desde Secretaría y no en el arranque del servidor: asignar
   * números es una decisión suya y tiene que quedar en la auditoría con quién
   * la tomó.
   */
  static async cerrarHuecosDeNumero(meta?: AuditMeta) {
    const asignados = await transaccionReintentable(async (tx) => {
      const sinNumero = await tx.hermano.findMany({
        where: { activo: true, numeroHermano: null },
        // Por antigüedad real. `id` desempata: dos altas del mismo día dejarían
        // el orden a merced de MariaDB y el resultado no sería repetible.
        orderBy: [{ fechaAlta: 'asc' }, { id: 'asc' }],
        select: { id: true }
      });
      if (sinNumero.length === 0) return [];

      let siguiente = await this.getNextNumeroHermano(tx);
      const hechas: { id: number; numeroHermano: number }[] = [];
      for (const { id } of sinNumero) {
        await tx.hermano.update({ where: { id }, data: { numeroHermano: siguiente } });
        hechas.push({ id, numeroHermano: siguiente });
        siguiente += 1;
      }
      return hechas;
    // Margen largo, como `reordenarCenso` (misma cifra, mismo motivo: «Censos
    // grandes: damos margen a la transacción»). Esta función existe para el
    // censo real que se va a importar, que puede traer cientos de fichas sin
    // número: un `update` por ficha, cada uno un viaje de ida y vuelta, agota
    // de sobra los 5 s por defecto de Prisma. Y si agota el timeout, Prisma
    // deshace TODO y no hay nada que reintentar (no es de los errores que
    // repite `esChoqueReintentable`), así que volver a pulsar fallaría igual.
    // `reactivarHermano` y `aprobarSolicitud` tocan una sola ficha cada vez y
    // no lo necesitan.
    }, { timeout: 60_000 });

    if (asignados.length > 0) {
      await AuditService.log(AUDIT_ACTIONS.CENSO_CERRAR_HUECOS, meta ?? {}, 'hermano', `total:${asignados.length}`, { asignados });
    }
    return { asignados };
  }

  static async rechazarSolicitud(userId: number, meta?: AuditMeta) {
    // El email y el nombre se leen AQUÍ y no después: cuando la cuenta nunca
    // llegó a aprobarse, la transacción de abajo la borra entera y ya no hay a
    // quién escribir ni cómo llamarle.
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, nombre: true }
    });
    if (!user) throw new NotFoundError(HERMANO_ERRORS.USER_NOT_FOUND);
    // SEGURIDAD: jamás se borra una cuenta del staff desde el panel de solicitudes
    if (esCuentaStaff(user.role)) throw new HttpError(HERMANO_ERRORS.CANNOT_TOUCH_STAFF, 403);

    const resultado = await transaccionReintentable(async (tx) => {
      // Se relee dentro de la transacción: con dos clics seguidos, la segunda
      // petición tiene que ver lo que ya borró la primera.
      const cuenta = await tx.user.findUnique({
        where: { id: userId },
        select: { active: true, hermanos: { select: { id: true, activo: true, fechaBaja: true } } }
      });
      if (!cuenta) throw new NotFoundError(HERMANO_ERRORS.USER_NOT_FOUND);

      const pendientes = cuenta.hermanos.filter((h) => !h.activo && h.fechaBaja === null).map((h) => h.id);
      // Una cuenta con alguna ficha que llegó a estar en el censo (activa o de
      // baja) tiene historia —recibos, papeletas— aunque hoy esté bloqueada: se
      // rechazan sus fichas pendientes y la cuenta se queda.
      const tuvoAlta = cuenta.hermanos.length > pendientes.length;

      if (cuenta.active || tuvoAlta) {
        // Cuenta ya aprobada: solo se eliminan las fichas pendientes, la cuenta sigue viva
        if (pendientes.length === 0) throw new HttpError(HERMANO_ERRORS.CANNOT_DELETE_ACTIVE);
        await tx.hermano.deleteMany({ where: { id: { in: pendientes }, ...FICHA_PENDIENTE } });
        return {
          cuentaAprobada: cuenta.active, cuentaEliminada: false, fichas: pendientes,
          message: 'Perfiles pendientes rechazados y eliminados. La cuenta del usuario se mantiene.'
        };
      }

      // Cuenta nunca aprobada: se elimina por completo
      await tx.hermano.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      return {
        cuentaAprobada: false, cuentaEliminada: true, fichas: pendientes,
        message: 'Solicitud rechazada y eliminada definitivamente.'
      };
    });

    // Auditoría tras confirmar: borrado definitivo de datos personales (solicitud
    // rechazada). Solo ids: guardar aquí el nombre desharía el borrado.
    await AuditService.log(AUDIT_ACTIONS.SOLICITUD_RECHAZAR, meta ?? {}, 'user', userId, {
      antes: { cuentaAprobada: resultado.cuentaAprobada, fichasPendientes: resultado.fichas },
      despues: { cuentaEliminada: resultado.cuentaEliminada, fichasEliminadas: resultado.fichas }
    });

    // Aviso con los datos leídos antes del borrado. Fuera de la transacción y
    // con catch: el rechazo ya está escrito y un correo no puede deshacerlo.
    EmailService.enviarBajaORechazo(user.email, user.nombre, 'rechazo')
      .catch((err) => console.error('Error enviando el aviso de rechazo:', err));

    return { message: resultado.message };
  }

  // =================================================================
  //  HELPER PRIVADO
  // =================================================================

  /** DNI único entre las fichas: mejor un 409 con mensaje que el P2002 crudo. */
  private static async comprobarDniLibre(dni: string, exceptoId: number, cliente: Prisma.TransactionClient | typeof db = db) {
    // Dentro de una transacción se consulta con ella; fuera, con el cliente normal.
    const otro = await (cliente as Prisma.TransactionClient).hermano.findFirst({ where: { dni, id: { not: exceptoId } }, select: { id: true } });
    if (otro) throw new HttpError(HERMANO_ERRORS.DNI_DUPLICATE, 409);
  }

  /**
   * Construye el objeto de update por LISTA BLANCA.
   * Solo pasan las claves permitidas para el rol; el resto del body se ignora aunque
   * ArkType las hubiera dejado pasar. Nunca se reenvía el objeto entero a Prisma.
   */
  private static prepareUpdateData(
    data: UpdateAdminHermanoDto,
    allowedFields: readonly EditableField[]
  ): Prisma.HermanoUpdateInput {
    const source = data as Record<string, unknown>;
    const cleanedData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      const value = source[field];
      if (value === undefined) continue;
      // Solo valores primitivos: un objeto aquí sería un intento de escritura anidada
      if (value !== null && typeof value === 'object') continue;
      cleanedData[field] = value;
    }

    // Del día escrito al instante que se guarda (ver instanteDeDia): el alta y la
    // baja, comienzo del día en Madrid; el nacimiento, medianoche UTC.
    for (const campo of CAMPOS_FECHA) {
      const valor = cleanedData[campo];
      if (typeof valor !== 'string') continue;
      cleanedData[campo] = instanteDeDia(valor, campo);
    }

    return cleanedData as Prisma.HermanoUpdateInput;
  }

  /**
   * Siguiente número libre: el mayor asignado + 1.
   *
   * POLÍTICA DEL GRUPO PARROQUIAL (no es un descuido): no hay contador propio.
   * Como la baja libera el número (darDeBajaHermano) y aquí se toma el máximo,
   * si causa baja quien tiene el número más alto, el siguiente que entre hereda
   * ese número; los huecos de en medio no se rellenan hasta la reordenación
   * anual del censo. Cambiarlo es decisión de Secretaría, no de código.
   *
   * Sin bloqueo: dos altas simultáneas pueden leer el mismo máximo. Quien llama
   * lo hace dentro de `transaccionReintentable`, que repite ante el choque.
   */
  static async getNextNumeroHermano(tx: Prisma.TransactionClient) {
    const ultimo = await tx.hermano.findFirst({
      where: { numeroHermano: { not: null } },
      orderBy: { numeroHermano: 'desc' },
      select: { numeroHermano: true }
    });
    return (ultimo?.numeroHermano || 0) + 1;
  }
}
