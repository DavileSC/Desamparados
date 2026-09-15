import { Request, Response } from 'express';
import { ContenidoService } from '../services/contenido.service.js';
import { esSlugContenido } from '../domain/contenido.js';
import { handleHttp, NotFoundError } from '../utils/error.handle.js';
import { AuditService, AUDIT_ACTIONS } from '../services/audit.service.js';

export class ContenidoController {
  /** GET /api/contenido/:slug (pública: la lee la web). */
  static async leer(req: Request, res: Response) {
    try {
      const slug = req.params.slug;
      if (!esSlugContenido(slug)) throw new NotFoundError('Página no encontrada');
      res.status(200).json(await ContenidoService.leer(slug));
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo el contenido de la página');
    }
  }

  /** PUT /api/contenido/:slug (CMS): sustituye el documento entero. */
  static async guardar(req: Request, res: Response) {
    try {
      const slug = req.params.slug;
      if (!esSlugContenido(slug)) throw new NotFoundError('Página no encontrada');
      const datos = await ContenidoService.guardar(slug, req.body.datos);
      AuditService.log(AUDIT_ACTIONS.CONTENIDO_ACTUALIZAR, AuditService.metaFromReq(req), 'contenido', slug);
      res.status(200).json({ message: 'Contenido guardado', data: datos });
    } catch (e) {
      handleHttp(res, e, 'Error guardando el contenido de la página');
    }
  }
}
