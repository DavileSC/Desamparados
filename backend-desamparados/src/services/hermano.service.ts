import db from '../config/db';
import { encrypt } from '../utils/bcrypt.handle';
import { Prisma, Role } from '@prisma/client';
import { CreateHermanoDto, UpdateHermanoDto, EmancipateHermanoDto, UpdateAdminHermanoDto } from '../dtos/hermano.dto';
import { AuditService, AUDIT_ACTIONS, AuditMeta } from './audit.service';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { comprobarFechasHermano } from '../domain/fechas-hermano';

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
  PENDING_PROFILE: 'Este perfil aún no ha sido aprobado por Secretaría.'
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

const ADMIN_EDITABLE_FIELDS = [
  ...USER_EDITABLE_FIELDS,
  'tieneTunicaPropia', 'tunica', 'alturaHombro', 'puesto',
  'activo', 'esTitular', 'numeroHermano',
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

/** Solo las cuentas de hermano raso (USER) se bloquean/borran al perder sus fichas. */
const esCuentaStaff = (role: Role) => role !== Role.USER;

export class HermanoService {

  // =================================================================
  //  ZONA GESTIÓN FAMILIAR
  // =================================================================

  static async getProfilesByUserId(userId: number) {
    // Incluimos también las fichas pendientes de aprobación (activo:false sin fecha de baja)
    // para que el usuario vea que su familiar está "en trámite".
    return await db.hermano.findMany({
      where: { userId, fechaBaja: null },
      orderBy: { fechaNacimiento: 'desc' },
      include: {
        recibos: { take: 1, orderBy: { year: 'desc' }, select: { year: true, estado: true } }
      }
    });
  }

  static async createDependentProfile(managerUserId: number, data: CreateHermanoDto) {
    if (data.dni) {
      const existe = await db.hermano.findFirst({ where: { dni: data.dni } });
      if (existe) throw new HttpError(HERMANO_ERRORS.DNI_DUPLICATE, 409);
    }

    const manager = await db.user.findUnique({ where: { id: managerUserId } });
    if (!manager) throw new NotFoundError(HERMANO_ERRORS.MANAGER_NOT_FOUND);

    const esTitular = !!data.dni && data.dni === manager.dni;

    return await db.hermano.create({
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
  }

  static async updateProfileIfOwned(hermanoId: number, managerUserId: number, data: UpdateHermanoDto) {
    const hermano = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId }
    });

    if (!hermano) return null; // Devolvemos null para que el Controller lance el 403 IDOR

    const dataToUpdate = this.prepareUpdateData(data, USER_EDITABLE_FIELDS);

    return await db.hermano.update({
      where: { id: hermanoId },
      data: dataToUpdate
    });
  }

  // Baja Familiar (Blindaje BOLA/IDOR)
  static async deleteProfileIfOwned(hermanoId: number, managerUserId: number) {
    const check = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId },
      include: { user: { select: { role: true } } }
    });

    if (!check) return null;

    await db.hermano.update({
      where: { id: hermanoId },
      data: { activo: false, fechaBaja: new Date() }
    });

    const restantes = await db.hermano.count({
      where: { userId: managerUserId, activo: true }
    });

    // Solo las cuentas de hermano raso se desactivan al quedarse sin fichas.
    // Un ADMIN/SECRETARÍA que borra su propia ficha no debe perder el acceso al CMS.
    if (restantes === 0 && !esCuentaStaff(check.user.role)) {
      await db.user.update({
        where: { id: managerUserId },
        data: { active: false }
      });
      return { message: 'Perfil dado de baja. Usuario gestor desactivado.' };
    }
    return { message: 'Perfil dado de baja correctamente.' };
  }

  // =================================================================
  //  ZONA EMANCIPACIÓN
  // =================================================================

  static async emancipateProfile(hermanoId: number, managerUserId: number, dto: EmancipateHermanoDto, meta?: AuditMeta) {
    const hermano = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId },
      include: { user: { select: { role: true } } }
    });
    if (!hermano) throw new HttpError(HERMANO_ERRORS.NOT_AUTHORIZED, 403);

    // Una ficha pendiente de aprobación no puede convertirse en una cuenta activa
    if (!hermano.activo) throw new HttpError(HERMANO_ERRORS.PENDING_PROFILE);

    const dniFinal = hermano.dni || dto.newDni;
    if (!dniFinal) throw new HttpError(HERMANO_ERRORS.DNI_REQUIRED_EMANCIPATION);

    const emailExists = await db.user.findUnique({ where: { email: dto.newEmail } });
    if (emailExists) throw new HttpError(HERMANO_ERRORS.EMAIL_IN_USE, 409);

    // El DNI también es único en User: si ya pertenece a otra cuenta (ej. el propio tutor),
    // la transacción fallaría con un error crudo de BD. Lo comprobamos antes.
    const dniExists = await db.user.findFirst({ where: { dni: dniFinal } });
    if (dniExists) throw new HttpError('Ese DNI ya pertenece a otra cuenta de usuario.', 409);

    const hashedPassword = await encrypt(dto.newPassword);

    return await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.newEmail,
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
        data: { userId: newUser.id, esTitular: true, email: dto.newEmail, dni: dniFinal }
      });

      // --- Control del Gestor Fantasma ---
      const restantes = await tx.hermano.count({
        where: { userId: managerUserId, activo: true }
      });

      if (restantes === 0 && !esCuentaStaff(hermano.user.role)) {
        await tx.user.update({
          where: { id: managerUserId },
          data: { active: false }
        });
      }
      // ------------------------------------------

      // Auditoría: creación de una cuenta nueva derivada de un perfil familiar
      AuditService.log(AUDIT_ACTIONS.EMANCIPACION, meta ?? {}, 'hermano', hermanoId);
      // Devolvemos solo datos seguros (nunca el hash de la contraseña)
      return { id: newUser.id, email: newUser.email, nombre: newUser.nombre };
    });
  }

  // =================================================================
  //  ZONA ADMIN (CENSO Y BUSCADOR)
  // =================================================================

  static async searchHermanos(query: SearchHermanoQuery) {
    const pageNum = Math.max(parseInt(query.page || "1"), 1);
    // Tope duro: evita que un cliente pida limit=999999 y sature la BD
    const limitNum = Math.min(Math.max(parseInt(query.limit || "20"), 1), 500);
    const skip = (pageNum - 1) * limitNum;

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
        where, skip, take: limitNum,
        orderBy: { apellidos: 'asc' },
        include: { user: { select: { telefono: true, email: true } } }
      }),
      db.hermano.count({ where })
    ]);

    return {
      data,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
    };
  }

  // Ver todos los hermanos
  static async getAllHermanos(page: number = 1, limit: number = 500) {
    page = Number.isFinite(page) ? Math.max(page, 1) : 1;
    limit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 500; // Tope duro de seguridad
    const skip = (page - 1) * limit;

    const [data, total] = await db.$transaction([
      db.hermano.findMany({
        where: { activo: true },
        orderBy: { numeroHermano: 'asc' }, // Ordenamos por número en lugar de apellidos
        skip,
        take: limit,
        include: {
          user: { select: { nombre: true, apellidos: true, telefono: true } }
        }
      }),
      db.hermano.count({ where: { activo: true } })
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
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

  static async updateAdminMode(id: number, data: UpdateAdminHermanoDto) {
    const dataToUpdate = this.prepareUpdateData(data, ADMIN_EDITABLE_FIELDS);

    // La baja se compara con el alta que vaya a quedar en la ficha, no solo con
    // la que venga en el cuerpo: cambiar únicamente la baja es lo habitual.
    const alta = (dataToUpdate.fechaAlta as Date | undefined)
      ?? (await db.hermano.findUnique({ where: { id }, select: { fechaAlta: true } }))?.fechaAlta;
    const forzado = comprobarFechasHermano(alta, dataToUpdate.fechaBaja as Date | null | undefined);

    return await db.hermano.update({
      where: { id },
      data: { ...dataToUpdate, ...forzado }
    });
  }

  static async reactivarHermano(hermanoId: number, meta?: AuditMeta) {
    const hermano = await db.hermano.findUnique({ where: { id: hermanoId } });
    if (!hermano) throw new NotFoundError('Hermano no encontrado.');
    if (hermano.activo) throw new HttpError('El hermano ya está activo.');

    // Auditoría: reactivación de un miembro del censo
    AuditService.log(AUDIT_ACTIONS.HERMANO_REACTIVAR, meta ?? {}, 'hermano', hermanoId);

    return await db.$transaction(async (tx) => {
      // Le mandamos al final de la cola
      const nextNum = await this.getNextNumeroHermano(tx);

      await tx.hermano.update({
        where: { id: hermanoId },
        data: {
          activo: true,
          fechaBaja: null, // Limpiamos la fecha de baja
          fechaAlta: new Date(), // Nueva fecha de alta
          numeroHermano: nextNum
        }
      });

      // Aseguramos que su cuenta de usuario vuelva a tener acceso
      await tx.user.update({
        where: { id: hermano.userId },
        data: { active: true }
      });

      return { message: `Hermano reactivado correctamente. Se le ha asignado el nuevo número ${nextNum}.` };
    });
  }

  static async darDeBajaHermano(hermanoId: number, meta?: AuditMeta) {
    const hermano = await db.hermano.findUnique({
      where: { id: hermanoId },
      include: { user: { select: { role: true } } }
    });
    if (!hermano) throw new NotFoundError('Hermano no encontrado');
    if (!hermano.activo) throw new HttpError('Este hermano ya está dado de baja');

    // Auditoría: baja de un miembro del censo
    AuditService.log(AUDIT_ACTIONS.HERMANO_BAJA, meta ?? {}, 'hermano', hermanoId);

    return await db.$transaction(async (tx) => {
      await tx.hermano.update({
        where: { id: hermanoId },
        // Liberamos el número: al reactivar se le asigna uno nuevo (final de la cola)
        data: { activo: false, fechaBaja: new Date(), numeroHermano: null }
      });

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
        return { message: `${hermano.nombre} ${hermano.apellidos} dado de baja. Se ha bloqueado el acceso a la App porque no le quedan perfiles activos.` };
      }

      return { message: `${hermano.nombre} ${hermano.apellidos} dado de baja. El usuario mantiene el acceso.` };
    });
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
  static async getSolicitudesPendientes() {
    return await db.user.findMany({
      where: {
        role: Role.USER,
        hermanos: {
          some: { activo: false, fechaBaja: null }
        }
      },
      select: {
        id: true, email: true, dni: true, nombre: true, apellidos: true, telefono: true,
        direccion: true, poblacion: true, codigoPostal: true, active: true, createdAt: true,
        hermanos: {
          where: { activo: false, fechaBaja: null },
          select: HERMANO_SAFE_SELECT
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  static async aprobarSolicitud(userId: number, meta?: AuditMeta) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { hermanos: { where: { activo: false, fechaBaja: null } } } // Solo las fichas pendientes
    });

    if (!user) throw new NotFoundError(HERMANO_ERRORS.USER_NOT_FOUND);
    if (user.hermanos.length === 0) {
      throw new HttpError(user.active ? HERMANO_ERRORS.NOTHING_TO_APPROVE : HERMANO_ERRORS.ALREADY_ACTIVE);
    }

    // Auditoría: alta oficial de miembros (trámite de Secretaría)
    AuditService.log(AUDIT_ACTIONS.SOLICITUD_APROBAR, meta ?? {}, 'user', userId);

    return await db.$transaction(async (tx) => {
      if (!user.active) {
        await tx.user.update({ where: { id: userId }, data: { active: true } });
      }

      // A cada ficha pendiente le damos de alta y le asignamos un número consecutivo.
      // (Las fichas ya activas no se tocan: no se les reasigna número.)
      for (const hermano of user.hermanos) {
        const nextNum = await this.getNextNumeroHermano(tx);
        await tx.hermano.update({
          where: { id: hermano.id },
          data: { activo: true, fechaAlta: new Date(), numeroHermano: nextNum }
        });
      }
      return { message: 'Solicitud aprobada. Los perfiles ya son oficiales y tienen número de hermano asignado.' };
    });
  }

  /**
   * REORDENACIÓN DEL CENSO (Proceso anual de Secretaría)
   * Asigna un nuevo número correlativo a todos los hermanos activos
   * basándose estrictamente en su fecha de alta (antigüedad).
   */
  static async reordenarCenso(meta?: AuditMeta) {
    // 1. Buscamos a TODOS los hermanos activos, ordenados por fecha de alta (los más antiguos primero)
    const hermanosActivos = await db.hermano.findMany({
      where: { activo: true },
      orderBy: [{ fechaAlta: 'asc' }, { id: 'asc' }],
      select: { id: true } // Traemos lo mínimo para no saturar la memoria
    });

    if (hermanosActivos.length === 0) {
      throw new HttpError('No hay hermanos activos en el censo para reordenar.');
    }

    // Auditoría: renumeración completa del censo (operación delicada)
    AuditService.log(AUDIT_ACTIONS.CENSO_REORDENAR, meta ?? {}, 'hermano', `total:${hermanosActivos.length}`);

    // 2. Todo en UNA transacción para que, si falla a la mitad, no quede el censo corrupto.
    await db.$transaction(async (tx) => {
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
    }, { timeout: 60_000 }); // Censos grandes: damos margen a la transacción

    return {
      message: 'Censo reordenado con éxito.',
      totalProcesados: hermanosActivos.length
    };
  }

  static async rechazarSolicitud(userId: number, meta?: AuditMeta) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { hermanos: { where: { activo: false, fechaBaja: null }, select: { id: true } } }
    });
    if (!user) throw new NotFoundError(HERMANO_ERRORS.USER_NOT_FOUND);
    // SEGURIDAD: jamás se borra una cuenta del staff desde el panel de solicitudes
    if (esCuentaStaff(user.role)) throw new HttpError(HERMANO_ERRORS.CANNOT_TOUCH_STAFF, 403);

    // Auditoría: borrado definitivo de datos personales (solicitud rechazada)
    AuditService.log(AUDIT_ACTIONS.SOLICITUD_RECHAZAR, meta ?? {}, 'user', userId);

    return await db.$transaction(async (tx) => {
      if (user.active) {
        // Cuenta ya aprobada: solo se eliminan las fichas pendientes, la cuenta sigue viva
        if (user.hermanos.length === 0) throw new HttpError(HERMANO_ERRORS.CANNOT_DELETE_ACTIVE);
        await tx.hermano.deleteMany({ where: { id: { in: user.hermanos.map(h => h.id) } } });
        return { message: 'Perfiles pendientes rechazados y eliminados. La cuenta del usuario se mantiene.' };
      }

      // Cuenta nunca aprobada: se elimina por completo
      await tx.hermano.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      return { message: 'Solicitud rechazada y eliminada definitivamente.' };
    });
  }

  // =================================================================
  //  HELPER PRIVADO
  // =================================================================

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

    for (const campo of ['fechaNacimiento', 'fechaAlta', 'fechaBaja'] as const) {
      const valor = cleanedData[campo];
      if (typeof valor !== 'string') continue;
      const fecha = new Date(valor);
      if (Number.isNaN(fecha.getTime())) throw new HttpError(`Fecha inválida en ${campo}.`);
      cleanedData[campo] = fecha;
    }

    return cleanedData as Prisma.HermanoUpdateInput;
  }

  static async getNextNumeroHermano(tx: Prisma.TransactionClient) {
    const ultimo = await tx.hermano.findFirst({
      where: { numeroHermano: { not: null } },
      orderBy: { numeroHermano: 'desc' }
    });
    return (ultimo?.numeroHermano || 0) + 1;
  }
}
