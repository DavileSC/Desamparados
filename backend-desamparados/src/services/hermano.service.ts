import db from '../config/db';
import { encrypt } from '../utils/bcrypt.handle';
import { Prisma, Role } from '@prisma/client';
import { CreateHermanoDto, UpdateHermanoDto, EmancipateHermanoDto, UpdateAdminHermanoDto } from '../dtos/hermano.dto';
import { AuditService, AUDIT_ACTIONS, AuditMeta } from './audit.service';

// 1. DICCIONARIO DE ERRORES (Centralizado)
const HERMANO_ERRORS = {
  DNI_DUPLICATE: 'Ese DNI ya está registrado.',
  MANAGER_NOT_FOUND: 'Usuario gestor no encontrado.',
  NOT_AUTHORIZED: 'Perfil no encontrado o no autorizado.',
  DNI_REQUIRED_EMANCIPATION: 'El hermano necesita DNI para tener cuenta propia.',
  EMAIL_IN_USE: 'El email ya está en uso.',
  USER_NOT_FOUND: 'Usuario no encontrado.',
  ALREADY_ACTIVE: 'Este usuario ya está activo en el sistema.',
  CANNOT_DELETE_ACTIVE: 'No puedes destruir la cuenta de un hermano activo.'
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

export class HermanoService {

  // =================================================================
  //  ZONA GESTIÓN FAMILIAR
  // =================================================================

  static async getProfilesByUserId(userId: number) {
    return await db.hermano.findMany({
      where: { userId, activo: true },
      orderBy: { fechaNacimiento: 'desc' },
      include: {
        recibos: { take: 1, orderBy: { year: 'desc' }, select: { year: true, estado: true } }
      }
    });
  }

  static async createDependentProfile(managerUserId: number, data: CreateHermanoDto) {
    if (data.dni) {
      const existe = await db.hermano.findFirst({ where: { dni: data.dni } });
      if (existe) throw new Error(HERMANO_ERRORS.DNI_DUPLICATE);
    }

    const manager = await db.user.findUnique({ where: { id: managerUserId } });
    if (!manager) throw new Error(HERMANO_ERRORS.MANAGER_NOT_FOUND);

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
        activo: true
        // BORRADAS LAS LÍNEAS DE TÚNICA Y PUESTO
      }
    });
  }

  static async updateProfileIfOwned(hermanoId: number, managerUserId: number, data: UpdateHermanoDto) {
    const hermano = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId }
    });

    if (!hermano) return null; // Devolvemos null para que el Controller lance el 403 IDOR

    const dataToUpdate = this.prepareUpdateData(data);

    return await db.hermano.update({
      where: { id: hermanoId },
      data: dataToUpdate
    });
  }

  // MÉTDO RECUPERADO: Baja Familiar (Blindaje BOLA/IDOR)
  static async deleteProfileIfOwned(hermanoId: number, managerUserId: number) {
    const check = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId }
    });

    if (!check) return null;

    await db.hermano.update({
      where: { id: hermanoId },
      data: { activo: false, fechaBaja: new Date() }
    });

    const restantes = await db.hermano.count({
      where: { userId: managerUserId, activo: true }
    });

    if (restantes === 0) {
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
    const hermano = await db.hermano.findFirst({ where: { id: hermanoId, userId: managerUserId } });
    if (!hermano) throw new Error(HERMANO_ERRORS.NOT_AUTHORIZED);

    const dniFinal = hermano.dni || dto.newDni;
    if (!dniFinal) throw new Error(HERMANO_ERRORS.DNI_REQUIRED_EMANCIPATION);

    const emailExists = await db.user.findUnique({ where: { email: dto.newEmail } });
    if (emailExists) throw new Error(HERMANO_ERRORS.EMAIL_IN_USE);

    // El DNI también es único en User: si ya pertenece a otra cuenta (ej. el propio tutor),
    // la transacción fallaría con un error crudo de BD. Lo comprobamos antes.
    const dniExists = await db.user.findFirst({ where: { dni: dniFinal } });
    if (dniExists) throw new Error('Ese DNI ya pertenece a otra cuenta de usuario.');

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

      // --- NUEVO: Control del Gestor Fantasma ---
      const restantes = await tx.hermano.count({
        where: { userId: managerUserId, activo: true }
      });

      if (restantes === 0) {
        await tx.user.update({
          where: { id: managerUserId },
          data: { active: false }
        });
      }
      // ------------------------------------------

      // Devolvemos solo datos seguros (nunca el hash de la contraseña)
      // Auditoría: creación de una cuenta nueva derivada de un perfil familiar
      AuditService.log(AUDIT_ACTIONS.EMANCIPACION, meta ?? {}, 'hermano', hermanoId);
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

  // MÉTODO RECUPERADO: Ver todos los hermanos
  static async getAllHermanos(page: number = 1, limit: number = 500) {
    page = Math.max(page, 1);
    limit = Math.min(Math.max(limit, 1), 500); // Tope duro de seguridad
    const skip = (page - 1) * limit;

    const [data, total] = await db.$transaction([
      db.hermano.findMany({
        where: { activo: true },
        orderBy: { numeroHermano: 'asc' }, // Ahora ordenamos por número en lugar de apellidos
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

  // MÉTODO RECUPERADO: Ver un hermano por ID
  static async getHermanoById(id: number) {
    return await db.hermano.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, telefono: true } },
        recibos: { orderBy: { year: 'desc' } },
        papeletas: { orderBy: { year: 'desc' } }
      }
    });
  }

  static async updateAdminMode(id: number, data: UpdateAdminHermanoDto) {
    const dataToUpdate = this.prepareUpdateData(data);
    return await db.hermano.update({
      where: { id },
      data: dataToUpdate
    });
  }

  static async reactivarHermano(hermanoId: number, meta?: AuditMeta) {
    const hermano = await db.hermano.findUnique({ where: { id: hermanoId } });
    if (!hermano) throw new Error('Hermano no encontrado.');
    if (hermano.activo) throw new Error('El hermano ya está activo.');

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
    const hermano = await db.hermano.findUnique({ where: { id: hermanoId } });
    if (!hermano) throw new Error('Hermano no encontrado');
    if (!hermano.activo) throw new Error('Este hermano ya está dado de baja');

    // Auditoría: baja de un miembro del censo
    AuditService.log(AUDIT_ACTIONS.HERMANO_BAJA, meta ?? {}, 'hermano', hermanoId);

    return await db.$transaction(async (tx) => {
      await tx.hermano.update({
        where: { id: hermanoId },
        data: { activo: false, fechaBaja: new Date() }
      });

      const restantes = await tx.hermano.count({
        where: { userId: hermano.userId, activo: true }
      });

      if (restantes === 0) {
        await tx.user.update({
          where: { id: hermano.userId },
          data: { active: false }
        });
        // Corregido el espacio que faltaba después de apellidos
        return { message: `${hermano.nombre} ${hermano.apellidos} dado de baja. Se ha bloqueado el acceso a la App porque no le quedan perfiles activos.` };
      }

      return { message: `${hermano.nombre} ${hermano.apellidos} dado de baja. El usuario mantiene el acceso porque gestiona otros familiares.` };
    });
  }

  // =================================================================
  //  GESTIÓN DE SOLICITUDES DE ALTA (SECRETARÍA)
  // =================================================================

  // MÉTODO RECUPERADO: Ver solicitudes pendientes
  static async getSolicitudesPendientes() {
    return await db.user.findMany({
      where: {
        role: Role.USER,
        active: false,
        hermanos: {
          some: { fechaBaja: null }
        }
      },
      include: { hermanos: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  static async aprobarSolicitud(userId: number, meta?: AuditMeta) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { hermanos: true } // Necesitamos saber cuántas fichas tiene asociadas
    });

    if (!user) throw new Error(HERMANO_ERRORS.USER_NOT_FOUND);
    if (user.active) throw new Error(HERMANO_ERRORS.ALREADY_ACTIVE);

    // Auditoría: alta oficial de miembros (trámite de Secretaría)
    AuditService.log(AUDIT_ACTIONS.SOLICITUD_APROBAR, meta ?? {}, 'user', userId);

    return await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { active: true } });

      // A cada ficha familiar asociada le damos de alta y le asignamos un número consecutivo
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
    // Nota: Asegúrate de tener el campo 'fechaAlta' en tu base de datos.
    const hermanosActivos = await db.hermano.findMany({
      where: { activo: true },
      orderBy: { fechaAlta: 'asc' },
      select: { id: true, numeroHermano: true, nombre: true } // Traemos lo mínimo para no saturar la memoria
    });

    if (hermanosActivos.length === 0) {
      throw new Error('No hay hermanos activos en el censo para reordenar.');
    }

    // Auditoría: renumeración completa del censo (operación delicada)
    AuditService.log(AUDIT_ACTIONS.CENSO_REORDENAR, meta ?? {}, 'hermano', `total:${hermanosActivos.length}`);

    // 2. Preparamos todas las actualizaciones en una Transacción 
    // (Para que si falla a la mitad, no se quede el censo corrupto)
    const operaciones = hermanosActivos.map((hermano, index) => {
      const nuevoNumero = index + 1; // El índice empieza en 0, así que sumamos 1
      
      return db.hermano.update({
        where: { id: hermano.id },
        data: { numeroHermano: nuevoNumero }
      });
    });

    // 3. Ejecutamos todas las actualizaciones de golpe
    await db.$transaction(operaciones);

    return {
      message: 'Censo reordenado con éxito.',
      totalProcesados: hermanosActivos.length
    };
  }

  static async rechazarSolicitud(userId: number, meta?: AuditMeta) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error(HERMANO_ERRORS.USER_NOT_FOUND);
    if (user.active) throw new Error(HERMANO_ERRORS.CANNOT_DELETE_ACTIVE);

    // Auditoría: borrado definitivo de datos personales (solicitud rechazada)
    AuditService.log(AUDIT_ACTIONS.SOLICITUD_RECHAZAR, meta ?? {}, 'user', userId);

    return await db.$transaction(async (tx) => {
      await tx.hermano.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      return { message: 'Solicitud rechazada y eliminada definitivamente.' };
    });
  }

  // =================================================================
  //  HELPER PRIVADO
  // =================================================================
  private static prepareUpdateData(data: UpdateAdminHermanoDto): Prisma.HermanoUpdateInput {
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );

    if (cleanedData.fechaNacimiento) {
      cleanedData.fechaNacimiento = new Date(cleanedData.fechaNacimiento as string);
    }

    return cleanedData;
  }

  static async getNextNumeroHermano(tx: Prisma.TransactionClient) {
    const ultimo = await tx.hermano.findFirst({
      where: { numeroHermano: { not: null } },
      orderBy: { numeroHermano: 'desc' }
    });
    return (ultimo?.numeroHermano || 0) + 1;
  }
}