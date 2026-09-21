import { Response, Request } from 'express';
import { AdminService } from '../services/admin.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';


export class AdminController {

  static getStaff = manejar('Error listando staff', async (_req, res) => {
    const staff = await AdminService.getStaff();
    res.status(200).json(staff);
  });

  static searchUsers = manejar('Error buscando usuarios elegibles', async (req, res) => {
    // Validado por searchUsersSchema: si llega, es un texto (nunca un array).
    const search = typeof req.query.q === 'string' ? req.query.q : undefined;
    const users = await AdminService.searchEligibleUsers(search);
    res.status(200).json(users);
  });

  static promote = manejar('Error asignando rol', async (req, res) => {
    const { userId, role } = req.body; // Validados por ArkType
    const currentAdminId = req.user!.id;
    const promoted = await AdminService.promoteToStaff(userId, role, currentAdminId, AuditoriaService.metaFromReq(req));
    res.status(200).json({ message: 'Usuario ascendido correctamente', data: promoted });
  });

  static demote = manejar('Error revocando cargo', async (req, res) => {
    const { userId } = req.body; // Validado por ArkType
    const currentAdminId = req.user!.id;
    const demoted = await AdminService.demoteToUser(userId, currentAdminId, AuditoriaService.metaFromReq(req));
    res.status(200).json({ message: 'Cargo revocado. El usuario vuelve a ser base.', data: demoted });
  });

  // --- CONFIGURACIÓN ---

  static getAllConfig = manejar('Error obteniendo la configuración', async (_req, res) => {
    const configs = await AdminService.getAllConfiguracion();
    res.status(200).json(configs);
  });

  static updateConfig = manejar('Error actualizando la configuración', async (req, res) => {
    const { key, value } = req.body; // Validado por ArkType
    const config = await AdminService.updateConfiguracion(key, value, AuditoriaService.metaFromReq(req));
    res.status(200).json({ message: 'Configuración actualizada correctamente', data: config });
  });

  // --- AUDITORÍA ---

  /** Consulta del registro de auditoría (paginada, filtrable por acción y usuario). */
  static getAuditLogs = manejar('Error consultando el registro de auditoría', async (req, res) => {
    // El saneamiento de página y tamaño lo decide sanearPaginacion, no el
    // controlador: se le pasa req.query entero. userId sí necesita parseo
    // aquí porque Prisma lo espera numérico (columna Int en AuditLog).
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

    const result = await AdminService.getAuditLogs({ ...req.query, userId: Number.isNaN(userId!) ? undefined : userId });
    res.status(200).json(result);
  });
}