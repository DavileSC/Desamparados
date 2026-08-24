import db from '../config/db';
import { Request } from 'express';

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
  PAPELETA_ANULAR: 'PAPELETA_ANULAR',
  INSCRIPCION_FACTURAR: 'INSCRIPCION_FACTURAR',
  // Secretaría
  SOLICITUD_APROBAR: 'SOLICITUD_APROBAR',
  SOLICITUD_RECHAZAR: 'SOLICITUD_RECHAZAR',
  HERMANO_BAJA: 'HERMANO_BAJA',
  HERMANO_REACTIVAR: 'HERMANO_REACTIVAR',
  CENSO_REORDENAR: 'CENSO_REORDENAR',
  EMANCIPACION: 'EMANCIPACION',
  // RGPD
  CUENTA_DATOS_EXPORT: 'CUENTA_DATOS_EXPORT',
  CUENTA_AUTODELETE: 'CUENTA_AUTODELETE'
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
   * Registra una acción sensible. Fire-and-forget tolerante a fallos:
   * un problema escribiendo auditoría NUNCA debe romper la operación de negocio
   * (queda logueado en consola para alertar al administrador).
   */
  static async log(
    action: string,
    meta: AuditMeta,
    entityType?: string,
    entityId?: string | number
  ): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          action,
          userId: meta.userId ?? null,
          ip: meta.ip,
          userAgent: meta.userAgent,
          entityType: entityType ?? null,
          entityId: entityId !== undefined ? String(entityId) : null
        }
      });
    } catch (e) {
      console.error(`[Audit] No se pudo registrar la acción '${action}':`, e);
    }
  }
}
