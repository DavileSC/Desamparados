import { Response, Request } from 'express';
import { ReciboService } from '../services/recibo.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { AuditService } from '../services/audit.service.js';

export class ReciboController {

  // =================================================================
  //  ZONA FAMILIA (App del Hermano)
  // =================================================================

  static async getMyRecibos(req: Request, res: Response) {
    try {
      const userId = req.user!.id; 
      const recibosFamiliares = await ReciboService.getRecibosByUsuarioFamilia(userId);
      res.status(200).json(recibosFamiliares);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo tus recibos');
    }
  }

  // =================================================================
  //  ZONA ADMIN / TESORERÍA
  // =================================================================

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

      const recibo = await ReciboService.adminMarcarComoPagado(id, AuditService.metaFromReq(req));

      res.status(200).json({
        message: 'Recibo cobrado correctamente. Si tenía papeleta, se ha enviado por email.',
        reciboId: recibo.id,
        estado: recibo.estado
      });
    } catch (e: any) {
      // Errores de negocio del servicio (no existe, ya pagado, anulado...) → 400 con su mensaje real.
      // Otros errores inesperados → 500 genérico (sin filtrar detalles internos al cliente).
      const message = e instanceof Error ? e.message : '';
      if (message) {
        return handleHttp(res, e, message, 400);
      }
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