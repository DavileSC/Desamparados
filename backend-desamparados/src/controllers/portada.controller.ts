import { Request, Response } from 'express';
import { PortadaService } from '../services/portada.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { AuditService, AUDIT_ACTIONS } from '../services/audit.service.js';

export class PortadaController {
  /** GET /api/portada/imagenes (pública: la lee la portada de la web). */
  static async listar(_req: Request, res: Response) {
    try {
      res.status(200).json(await PortadaService.listarImagenes());
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo las fotos de la portada');
    }
  }

  /** PUT /api/portada/imagenes (CMS): sustituye la lista entera. */
  static async guardar(req: Request, res: Response) {
    try {
      const { imagenes } = req.body; // Validado por ArkType
      const resultado = await PortadaService.guardarImagenes(imagenes);
      AuditService.log(AUDIT_ACTIONS.PORTADA_ACTUALIZAR, AuditService.metaFromReq(req), 'portada', 'imagenes');
      res.status(200).json({ message: 'Fotos de la portada guardadas', data: resultado });
    } catch (e) {
      handleHttp(res, e, 'Error guardando las fotos de la portada');
    }
  }
}
