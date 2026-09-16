import db from '../config/db';
import { Request } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Metadatos de quién realiza la acción (extraídos del request autenticado).
 */
export interface AuditMeta {
  userId?: number;
  ip?: string;
  userAgent?: string;
}

/**
 * Catálogo centralizado de acciones auditables.
 * Mantener en mayúsculas y verbo_sustantivo para filtrado consistente.
 */
export const AUDIT_ACTIONS = {
  // Staff / roles
  STAFF_PROMOTE: 'STAFF_PROMOTE',
  STAFF_DEMOTE: 'STAFF_DEMOTE',
  CONFIG_UPDATE: 'CONFIG_UPDATE',
  TFa_RESET_ADMIN: '2FA_RESET_ADMIN',
  // Economía
  RECIBO_COBRAR: 'RECIBO_COBRAR',
  RECIBO_ACTUALIZAR: 'RECIBO_ACTUALIZAR',
  CUOTAS_GENERAR: 'CUOTAS_GENERAR',
  TRANSACCION_CREAR: 'TRANSACCION_CREAR',
  CATEGORIA_CREAR: 'CATEGORIA_CREAR',
  // Contabilidad: corregir y borrar apuntes manuales, gestionar categorías
  TRANSACCION_ACTUALIZAR: 'TRANSACCION_ACTUALIZAR',
  TRANSACCION_ELIMINAR: 'TRANSACCION_ELIMINAR',
  CATEGORIA_RENOMBRAR: 'CATEGORIA_RENOMBRAR',
  CATEGORIA_DESACTIVAR: 'CATEGORIA_DESACTIVAR',
  CATEGORIA_REACTIVAR: 'CATEGORIA_REACTIVAR',
  PAPELETA_ANULAR: 'PAPELETA_ANULAR',
  INSCRIPCION_FACTURAR: 'INSCRIPCION_FACTURAR',
  RECIBO_EMITIR: 'RECIBO_EMITIR',
  // Procesión (turnos de reparto y citas)
  TURNO_CREAR: 'TURNO_CREAR',
  TURNO_ACTUALIZAR: 'TURNO_ACTUALIZAR',
  TURNO_ELIMINAR: 'TURNO_ELIMINAR',
  AUSENCIAS_PROCESAR: 'AUSENCIAS_PROCESAR',
  // Secretaría
  SOLICITUD_APROBAR: 'SOLICITUD_APROBAR',
  SOLICITUD_RECHAZAR: 'SOLICITUD_RECHAZAR',
  HERMANO_BAJA: 'HERMANO_BAJA',
  HERMANO_REACTIVAR: 'HERMANO_REACTIVAR',
  CENSO_REORDENAR: 'CENSO_REORDENAR',
  CENSO_CERRAR_HUECOS: 'CENSO_CERRAR_HUECOS',
  EMANCIPACION: 'EMANCIPACION',
  // Censo: edición de la ficha por el staff y operaciones del área familiar
  HERMANO_ACTUALIZAR: 'HERMANO_ACTUALIZAR',
  HERMANO_BAJA_FAMILIAR: 'HERMANO_BAJA_FAMILIAR',
  FAMILIAR_CREAR: 'FAMILIAR_CREAR',
  FAMILIAR_ACTUALIZAR: 'FAMILIAR_ACTUALIZAR',
  FAMILIAR_SOLICITUD_RETIRAR: 'FAMILIAR_SOLICITUD_RETIRAR',
  // RGPD
  CUENTA_DATOS_EXPORT: 'CUENTA_DATOS_EXPORT',
  CUENTA_AUTODELETE: 'CUENTA_AUTODELETE',
  NOTICIA_CREAR: 'NOTICIA_CREAR',
  NOTICIA_ACTUALIZAR: 'NOTICIA_ACTUALIZAR',
  NOTICIA_ELIMINAR: 'NOTICIA_ELIMINAR',
  PAGINA_GUARDAR: 'PAGINA_GUARDAR',
  PAGINA_ACTUALIZAR: 'PAGINA_ACTUALIZAR',
  PAGINA_ELIMINAR: 'PAGINA_ELIMINAR',
  EVENTO_CREAR: 'EVENTO_CREAR',
  EVENTO_ACTUALIZAR: 'EVENTO_ACTUALIZAR',
  EVENTO_ELIMINAR: 'EVENTO_ELIMINAR',
  ENSER_CREAR: 'ENSER_CREAR',
  ENSER_ACTUALIZAR: 'ENSER_ACTUALIZAR',
  ENSER_ELIMINAR: 'ENSER_ELIMINAR',
  PRENDA_CREAR: 'PRENDA_CREAR',
  PRENDA_ACTUALIZAR: 'PRENDA_ACTUALIZAR',
  PRENDA_ELIMINAR: 'PRENDA_ELIMINAR',
  PRENDA_ASIGNAR: 'PRENDA_ASIGNAR',
  PRENDA_DEVOLVER: 'PRENDA_DEVOLVER',
  PUBLICACION_CREAR: 'PUBLICACION_CREAR',
  PUBLICACION_ACTUALIZAR: 'PUBLICACION_ACTUALIZAR',
  PUBLICACION_ELIMINAR: 'PUBLICACION_ELIMINAR',
  PORTADA_ACTUALIZAR: 'PORTADA_ACTUALIZAR',
  CONTENIDO_ACTUALIZAR: 'CONTENIDO_ACTUALIZAR',
  // Correo que no salió. No es una acción de nadie, pero se guarda aquí porque
  // es el único sitio del CMS donde el staff puede enterarse: antes el fallo
  // moría en un console.error y el alta se daba por buena sin avisar a nadie.
  EMAIL_FALLIDO: 'EMAIL_FALLIDO'
} as const;

export class AuditService {

  /**
   * Extrae los metadatos del request (requiere que authenticateToken ya haya corrido).
   */
  static metaFromReq(req: Request): AuditMeta {
    return {
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 250)
    };
  }

  /**
   * Borra los registros más antiguos que el plazo de retención. La auditoría
   * guarda IP y navegador, que son datos personales: no pueden guardarse sin
   * límite. El plazo por defecto (730 días) cubre dos ejercicios contables
   * completos; se ajusta con AUDIT_RETENTION_DAYS.
   */
  static async purgarAntiguos(dias = Number(process.env.AUDIT_RETENTION_DAYS ?? 730)): Promise<number> {
    if (!Number.isInteger(dias) || dias < 30) {
      throw new Error(`AUDIT_RETENTION_DAYS debe ser un entero de 30 o más (recibido: ${dias}).`);
    }
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const { count } = await db.auditLog.deleteMany({ where: { createdAt: { lt: limite } } });
    return count;
  }

  /**
   * Registra una acción sensible. Fire-and-forget tolerante a fallos:
   * un problema escribiendo auditoría NUNCA debe romper la operación de negocio
   * (queda logueado en consola para alertar al administrador).
   *
   * Se llama DESPUÉS de que la operación haya confirmado, no antes: si la
   * transacción falla, el registro no debe dar fe de algo que no ocurrió.
   * `detalles` lleva el estado anterior y el nuevo (`{ antes, despues }`) o
   * lo que haga falta para entender el cambio sin reconstruirlo.
   */
  static async log(
    action: string,
    meta: AuditMeta,
    entityType?: string,
    entityId?: string | number,
    detalles?: Prisma.InputJsonValue
  ): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          action,
          userId: meta.userId ?? null,
          ip: meta.ip,
          userAgent: meta.userAgent,
          entityType: entityType ?? null,
          entityId: entityId !== undefined ? String(entityId) : null,
          ...(detalles !== undefined ? { detalles } : {})
        }
      });
    } catch (e) {
      console.error(`[Audit] No se pudo registrar la acción '${action}':`, e);
    }
  }
}
