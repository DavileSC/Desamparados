import { Response, Request } from 'express';
import { ReciboService } from '../services/recibo.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { AuditService } from '../services/audit.service.js';
import { EstadoPago } from '@prisma/client';

export class ReciboController {

  // =================================================================
  //  ZONA FAMILIA (App del Hermano)
  // =================================================================

  static async getMyRecibos(req: Request, res: Response) {
    try {
      const userId = req.user!.id; 
      const recibosFamiliares = await ReciboService.getRecibosByUsuarioFamilia(userId, req.query);
      res.status(200).json(recibosFamiliares);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo tus recibos');
    }
  }

  // =================================================================
  //  ZONA ADMIN / TESORERÍA
  // =================================================================

  static async getAdminRecibos(req: Request, res: Response) {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const estado = typeof req.query.estado === 'string' && Object.values(EstadoPago).includes(req.query.estado as EstadoPago)
        ? req.query.estado as EstadoPago
        : undefined;
      const result = await ReciboService.getAdminRecibos(req.query, Number.isFinite(year) ? year : undefined, estado);
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo recibos administrativos');
    }
  }

  static async generarCuotas(req: Request, res: Response) {
    try {
      // req.body validado por ArkType
      const result = await ReciboService.generarCuotaAnual(req.body, AuditService.metaFromReq(req));
      
      // --- ACTUALIZADO: El servicio ahora nos devuelve un mensaje exacto y los omitidos ---
      res.status(201).json({
        message: result.message,
        omitidos: result.omitidos 
      });
    } catch (e) {
      handleHttp(res, e, 'Error generando cuotas masivas');
    }
  }

  static async marcarPagado(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      const recibo = await ReciboService.adminMarcarComoPagado(id, req.body.metodoPago, AuditService.metaFromReq(req));

      res.status(200).json({
        message: 'Recibo cobrado correctamente. Si tenía papeleta, se ha enviado por email.',
        reciboId: recibo.id,
        estado: recibo.estado
      });
    } catch (e) {
      handleHttp(res, e, 'Error al cobrar el recibo');
    }
  }

  static async updateDetalles(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const reciboActualizado = await ReciboService.adminUpdateDetalles(id, req.body, AuditService.metaFromReq(req));
      res.status(200).json(reciboActualizado);
    } catch (e) {
      handleHttp(res, e, 'Error actualizando recibo');
    }
  }
}
