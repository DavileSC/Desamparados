import { Request, Response } from 'express';
import { PublicationService } from '../services/publication.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { AuditService, AUDIT_ACTIONS } from '../services/audit.service.js';

export class PublicationController {
  static async latest(_req: Request, res: Response) {
    try { res.status(200).json(await PublicationService.getLatest()); }
    catch (e) { handleHttp(res, e, 'Error obteniendo publicaciones destacadas'); }
  }

  static async list(req: Request, res: Response) {
    try { res.status(200).json(await PublicationService.getPublic(req.params.category as never)); }
    catch (e) { handleHttp(res, e, 'Error obteniendo publicaciones'); }
  }

  static async adminList(_req: Request, res: Response) {
    try { res.status(200).json(await PublicationService.getAdmin()); }
    catch (e) { handleHttp(res, e, 'Error obteniendo publicaciones'); }
  }

  static async create(req: Request, res: Response) {
    try {
      const publication = await PublicationService.create(req.body);
      AuditService.log(AUDIT_ACTIONS.PUBLICACION_CREAR, AuditService.metaFromReq(req), 'publicacion', publication.id);
      res.status(201).json(publication);
    }
    catch (e) { handleHttp(res, e, 'Error creando publicación'); }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const publication = await PublicationService.update(id, req.body);
      AuditService.log(AUDIT_ACTIONS.PUBLICACION_ACTUALIZAR, AuditService.metaFromReq(req), 'publicacion', id);
      res.status(200).json(publication);
    }
    catch (e) { handleHttp(res, e, 'Error actualizando publicación'); }
  }

  static async delete(req: Request, res: Response) {
    try {
      await PublicationService.delete(Number(req.params.id));
      AuditService.log(AUDIT_ACTIONS.PUBLICACION_ELIMINAR, AuditService.metaFromReq(req), 'publicacion', Number(req.params.id));
      res.status(200).json({ message: 'Publicación eliminada correctamente' });
    } catch (e) { handleHttp(res, e, 'Error eliminando publicación'); }
  }
}
