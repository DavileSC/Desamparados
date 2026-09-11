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
      // `adminRecibosQuerySchema` ya garantiza que, si vienen, `year` son
      // cuatro cifras y `estado` uno de los del enum (nunca una lista).
      const query = req.query as { year?: string; estado?: EstadoPago; page?: string; limit?: string };
      const year = query.year ? Number(query.year) : undefined;
      const result = await ReciboService.getAdminRecibos(query, year, query.estado);
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo recibos administrativos');
    }
  }

  static async buscarHermanos(req: Request, res: Response) {
    try {
      const hermanos = await ReciboService.buscarHermanos(String(req.query.q));
      res.status(200).json(hermanos);
    } catch (e) {
      handleHttp(res, e, 'Error buscando hermanos');
    }
  }

  static async emitir(req: Request, res: Response) {
    try {
      const recibo = await ReciboService.emitirRecibo(req.body, AuditService.metaFromReq(req));
      res.status(201).json({
        message: `Recibo «${recibo.concepto}» emitido.`,
        reciboId: recibo.id,
        estado: recibo.estado
      });
    } catch (e) {
      handleHttp(res, e, 'Error emitiendo el recibo');
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

      const recibo = await ReciboService.adminMarcarComoPagado(id, req.body?.metodoPago, AuditService.metaFromReq(req));

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
