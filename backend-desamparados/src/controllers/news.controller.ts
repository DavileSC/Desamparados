import { Request, Response } from 'express';
import { NewsService } from '../services/news.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { NewsFilterDto } from '../dtos/news.dto.js';
import { AuditService, AUDIT_ACTIONS } from '../services/audit.service.js';

export class NewsController {

  // =================================================================
  //  PÚBLICO (Lectura)
  // =================================================================

  static async getLatest(req: Request, res: Response) {
    try {
      const news = await NewsService.getLatest();
      res.status(200).json(news);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo portada');
    }
  }

  private static parseArchiveFilter(req: Request, includeDrafts: boolean): NewsFilterDto {
    // El saneamiento de página y tamaño lo decide sanearPaginacion, no el
    // controlador: se le pasan los valores crudos de la query.
    // Sanitización segura y limpia (si mandan un array, cogemos el primer elemento o nada)
    const searchRaw = req.query.search;
    const search = typeof searchRaw === 'string' ? searchRaw.slice(0, 100) : undefined;

    return { page: req.query.page, limit: req.query.limit, search, includeDrafts };
  }

  // Archivo PÚBLICO: solo noticias publicadas (visible:true)
  static async getArchive(req: Request, res: Response) {
    try {
      const result = await NewsService.getArchive(NewsController.parseArchiveFilter(req, false));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo archivo');
    }
  }

  // Archivo del CMS (auth + rol): incluye borradores
  static async getAdminArchive(req: Request, res: Response) {
    try {
      const result = await NewsService.getArchive(NewsController.parseArchiveFilter(req, true));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo archivo de administración');
    }
  }

  // Noticia individual del CMS por id (incluye borradores). Cierra un fallo
  // latente: antes el cliente se traía el listado paginado y buscaba dentro
  // con un .find(), así que una noticia fuera del recorte era imposible de
  // editar.
  static async getAdminOne(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const noticia = await NewsService.getOneById(id);

      if (!noticia) return handleHttp(res, null, 'Noticia no encontrada', 404);

      res.status(200).json(noticia);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo noticia');
    }
  }

  static async getOne(req: Request, res: Response) {
    try {
      // Gracias a ArkType, sabemos que req.params.slug es un string 100% seguro
      const slug = req.params.slug as string;
      const noticia = await NewsService.getOneBySlug(slug);

      if (!noticia) return handleHttp(res, null, 'Noticia no encontrada', 404);

      res.status(200).json(noticia);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo noticia');
    }
  }

  // =================================================================
  //  ADMIN (Gestión)
  // =================================================================

  static async create(req: Request, res: Response) {
    try {
      // El body viene limpio de inyecciones desde ArkType
      const news = await NewsService.create(req.body);
      AuditService.log(AUDIT_ACTIONS.NOTICIA_CREAR, AuditService.metaFromReq(req), 'noticia', news.id);
      res.status(201).json(news);
    } catch (e) {
      handleHttp(res, e, 'Error creando noticia');
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await NewsService.update(id, req.body);
      AuditService.log(AUDIT_ACTIONS.NOTICIA_ACTUALIZAR, AuditService.metaFromReq(req), 'noticia', id);
      res.status(200).json(updated);
    } catch (e) {
      handleHttp(res, e, 'Error actualizando noticia');
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await NewsService.delete(id);
      AuditService.log(AUDIT_ACTIONS.NOTICIA_ELIMINAR, AuditService.metaFromReq(req), 'noticia', id);
      res.status(200).json({ message: 'Noticia eliminada correctamente' });
    } catch (e) {
      handleHttp(res, e, 'Error eliminando noticia');
    }
  }

  static async configHomeLimit(req: Request, res: Response) {
    try {
      // limit ya es un 'number' real garantizado por ArkType
      const { limit } = req.body;
      await NewsService.setHomeLimit(limit);
      res.status(200).json({ message: 'Configuración actualizada' });
    } catch (e) {
      handleHttp(res, e, 'Error configurando home');
    }
  }
}
