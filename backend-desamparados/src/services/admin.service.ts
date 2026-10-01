import db from '../config/db.js';
import { Role } from '@prisma/client';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { condicionBusqueda } from '../domain/busqueda-texto.js';
import { corteDeSesiones } from '../utils/jwt.handle.js';
import { CLAVES_CONFIGURACION, esClaveConfiguracion, normalizarValorConfiguracion } from '../domain/configuracion.js';

export class AdminService {

  // 1. VER EL STAFF ACTUAL
  static async getStaff() {
    return await db.user.findMany({
      where: {
        role: { not: Role.USER }, // Todos los que no sean rasos
        active: true
      },
      select: { 
        id: true, email: true, role: true, nombre: true, apellidos: true, dni: true, telefono: true 
      }
    });
  }

  // 2. BUSCAR USUARIOS RASOS PARA ASCENDERLOS (Para el select del frontend)
  static async searchEligibleUsers(searchTerm?: string) {
    return await db.user.findMany({
      where: {
        role: Role.USER,
        active: true,
        ...condicionBusqueda(searchTerm, ['nombre', 'apellidos', 'dni', 'email'])
      },
      select: { id: true, nombre: true, apellidos: true, dni: true, email: true },
      take: 20 // Límite para no saturar
    });
  }

  // 3. ASCENDER A UN USUARIO (Darle un cargo en la Junta / Staff)
  static async promoteToStaff(userId: number, newRole: Role, currentAdminId: number, meta?: MetaDeAuditoria) {
    // Medida de seguridad: Evitar que un admin se auto-promocione/cambie de rol.
    if (userId === currentAdminId) {
      throw new HttpError('Un administrador no puede modificar su propio rol.');
    }

    const existing = await db.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError('Usuario no encontrado');
    if (!existing.active) throw new HttpError('El usuario está inactivo');

    const result = await db.user.update({
      where: { id: userId },
      data: {
        role: newRole,
        // La sesion anterior se emitio con la politica del rol viejo (cookie
        // persistente de 4 h si era USER). Forzamos un login nuevo para que
        // reciba la de staff, que muere al cerrar el navegador.
        tokenValidAfter: corteDeSesiones()
      },
      select: { id: true, email: true, role: true, nombre: true, apellidos: true }
    });

    // Auditoría: cambio de rol (asignación de privilegios)
    AuditoriaService.log(ACCIONES_AUDITORIA.STAFF_PROMOTE, meta ?? {}, 'user', userId, {
      antes: { role: existing.role }, despues: { role: result.role }
    });
    return result;
  }

  // 4. DEGRADAR A UN USUARIO (Quitarle el cargo, vuelve a ser Hermano raso)
  // ¡FÍJATE! No tocamos el campo `active`, solo le quitamos el rol.
  static async demoteToUser(userId: number, currentAdminId: number, meta?: MetaDeAuditoria) {
    // Medida de seguridad: Evitar que un admin se auto-degrade.
    if (userId === currentAdminId) {
      throw new HttpError('Un administrador no puede degradarse a sí mismo.');
    }

    const existing = await db.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError('Usuario no encontrado');
    if (existing.role === Role.ADMIN) {
        // Medida de seguridad: Evitar que el último Admin se degrade a sí mismo por error
        const adminCount = await db.user.count({ where: { role: Role.ADMIN, active: true } });
        if (adminCount <= 1) throw new HttpError('No puedes degradar al último Administrador del sistema.');
    }

    const result = await db.user.update({
      where: { id: userId },
      data: {
        role: Role.USER,
        // Invalidamos sus sesiones activas: pierde el acceso al CMS de inmediato
        // (los tokens JWT viejos ya no podrán usar rutas de staff)
        tokenValidAfter: corteDeSesiones()
      },
      select: { id: true, email: true, role: true, nombre: true }
    });

    // Auditoría: retirada de privilegios
    AuditoriaService.log(ACCIONES_AUDITORIA.STAFF_DEMOTE, meta ?? {}, 'user', userId, {
      antes: { role: existing.role }, despues: { role: result.role }
    });
    return result;
  }

  // 5. OBTENER TODA LA CONFIGURACIÓN
  static async getAllConfiguracion() {
    return await db.configuracion.findMany({
      orderBy: { key: 'asc' }
    });
  }

  // 6. ACTUALIZAR UN VALOR DE CONFIGURACIÓN
  // Lista blanca de claves conocidas (src/domain/configuracion.ts): una clave
  // que nadie lee se guardaría y parecería surtir efecto sin surtirlo. El valor
  // se vuelve a validar aquí aunque la ruta ya lo haga: el servicio no sabe
  // quién le llama.
  static async updateConfiguracion(key: string, value: string, meta?: MetaDeAuditoria) {
    if (!esClaveConfiguracion(key)) {
      throw new HttpError(`'${key}' no es un parámetro de configuración válido.${CLAVES_CONFIGURACION.length ? ` Claves permitidas: ${CLAVES_CONFIGURACION.join(', ')}.` : ''}`);
    }
    const normalizado = normalizarValorConfiguracion(key, value);
    if (!normalizado.ok) throw new HttpError(normalizado.error);

    const anterior = await db.configuracion.findUnique({ where: { key }, select: { value: true } });
    const result = await db.configuracion.upsert({
      where: { key },
      update: { value: normalizado.valor },
      create: { key, value: normalizado.valor, descripcion: `Valor para ${key}` }
    });

    // Auditoría: los precios y parámetros globales son sensibles (afectan al cobro)
    AuditoriaService.log(ACCIONES_AUDITORIA.CONFIG_UPDATE, meta ?? {}, 'config', key, {
      antes: { value: anterior?.value ?? null }, despues: { value: result.value }
    });
    return result;
  }

  // =================================================================
  //  7. CONSULTA DEL REGISTRO DE AUDITORÍA (Solo ADMIN)
  // =================================================================
  static async getAuditLogs(query: { page?: unknown; limit?: unknown; action?: string; userId?: number } = {}) {
    const paginacion = sanearPaginacion(query);

    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {})
    };

    const [data, total] = await db.$transaction([
      db.auditLog.findMany({
        where,
        orderBy: [
          { createdAt: 'desc' },
          { id: 'asc' } // Desempate: una sola operación deja varios apuntes con el mismo
                        // `createdAt` (aprobar una solicitud familiar, reordenar el censo),
                        // y sin este criterio MariaDB los ordena a su antojo: un apunte
                        // saldría en dos páginas y otro en ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take,
        include: {
          user: { select: { id: true, email: true, nombre: true, apellidos: true, role: true } }
        }
      }),
      db.auditLog.count({ where })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }

}