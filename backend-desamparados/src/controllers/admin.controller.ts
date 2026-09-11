import { Response, Request } from 'express';
import { AdminService } from '../services/admin.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { AuditService } from '../services/audit.service.js';


export class AdminController {

  static async getStaff(_req: Request, res: Response) {
    try {
      const staff = await AdminService.getStaff();
      res.status(200).json(staff);
    } catch (e) {
      handleHttp(res, e, 'Error listando staff');
    }
  }

  static async searchUsers(req: Request, res: Response) {
    try {
      // Validado por searchUsersSchema: si llega, es un texto (nunca un array).
      const search = typeof req.query.q === 'string' ? req.query.q : undefined;
      const users = await AdminService.searchEligibleUsers(search);
      res.status(200).json(users);
    } catch (e) {
      handleHttp(res, e, 'Error buscando usuarios elegibles');
    }
  }

  static async promote(req: Request, res: Response) {
    try {
      const { userId, role } = req.body; // Validados por ArkType
      const currentAdminId = req.user!.id;
      const promoted = await AdminService.promoteToStaff(userId, role, currentAdminId, AuditService.metaFromReq(req));
      res.status(200).json({ message: 'Usuario ascendido correctamente', data: promoted });
    } catch (e) {
      handleHttp(res, e, 'Error asignando rol');
    }
  }

  static async demote(req: Request, res: Response) {
    try {
      const { userId } = req.body; // Validado por ArkType
      const currentAdminId = req.user!.id;
      const demoted = await AdminService.demoteToUser(userId, currentAdminId, AuditService.metaFromReq(req));
      res.status(200).json({ message: 'Cargo revocado. El usuario vuelve a ser base.', data: demoted });
    } catch (e) {
      handleHttp(res, e, 'Error revocando cargo');
    }
  }

  // --- CONFIGURACIÓN ---

  static async getAllConfig(_req: Request, res: Response) {
    try {
      const configs = await AdminService.getAllConfiguracion();
      res.status(200).json(configs);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo la configuración');
    }
  }

  static async updateConfig(req: Request, res: Response) {
    try {
      const { key, value } = req.body; // Validado por ArkType
      const config = await AdminService.updateConfiguracion(key, value, AuditService.metaFromReq(req));
      res.status(200).json({ message: 'Configuración actualizada correctamente', data: config });
    } catch (e) {
      handleHttp(res, e, 'Error actualizando la configuración');
    }
  }

  // --- AUDITORÍA ---

  /** Consulta del registro de auditoría (paginada, filtrable por acción y usuario). */
  static async getAuditLogs(req: Request, res: Response) {
    try {
      // El saneamiento de página y tamaño lo decide sanearPaginacion, no el
      // controlador: se le pasa req.query entero. userId sí necesita parseo
      // aquí porque Prisma lo espera numérico (columna Int en AuditLog).
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

      const result = await AdminService.getAuditLogs({ ...req.query, userId: Number.isNaN(userId!) ? undefined : userId });
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error consultando el registro de auditoría');
    }
  }
}