import { NewsService } from '../services/news.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';
import type { AdminNewsFilterDto } from '../dtos/news.dto.js';
import { AuditService, AUDIT_ACTIONS } from '../services/audit.service.js';

export class NewsController {

  // =================================================================
  //  PÚBLICO (Lectura)
  // =================================================================

  static getLatest = manejar('Error obteniendo portada', async (_req, res) => {
    const news = await NewsService.getLatest();
    res.status(200).json(news);
  });

  // Archivo PÚBLICO: solo noticias publicadas (visible:true)
  static getArchive = manejar('Error obteniendo archivo', async (req, res) => {
    // El saneamiento de página y tamaño lo decide sanearPaginacion, no el
    // controlador: se le pasan los valores crudos de la query.
    // Si mandan un array en `search`, se descarta.
    const searchRaw = req.query.search;
    const search = typeof searchRaw === 'string' ? searchRaw.slice(0, 100) : undefined;
    const result = await NewsService.getArchive({ page: req.query.page, limit: req.query.limit, search });
    res.status(200).json(result);
  });

  // Archivo del CMS (auth + rol): incluye borradores. La query ya viene
  // validada por adminArchiveQuerySchema.
  static getAdminArchive = manejar('Error obteniendo archivo de administración', async (req, res) => {
    const { page, limit, q, estado } = req.query as AdminNewsFilterDto;
    const result = await NewsService.getAdminArchive({ page, limit, q, estado });
    res.status(200).json(result);
  });

  // Noticia individual del CMS por id (incluye borradores). Cierra un fallo
  // latente: antes el cliente se traía el listado paginado y buscaba dentro
  // con un .find(), así que una noticia fuera del recorte era imposible de
  // editar.
  static getAdminOne = manejar('Error obteniendo noticia', async (req, res) => {
    const id = Number(req.params.id);
    const noticia = await NewsService.getOneById(id);

    if (!noticia) return handleHttp(res, null, 'Noticia no encontrada', 404);

    res.status(200).json(noticia);
  });

  static getOne = manejar('Error obteniendo noticia', async (req, res) => {
    // Gracias a ArkType, sabemos que req.params.slug es un string 100% seguro
    const slug = req.params.slug as string;
    const noticia = await NewsService.getOneBySlug(slug);

    if (!noticia) return handleHttp(res, null, 'Noticia no encontrada', 404);

    res.status(200).json(noticia);
  });

  // =================================================================
  //  ADMIN (Gestión)
  // =================================================================

  static create = manejar('Error creando noticia', async (req, res) => {
    // El body viene limpio de inyecciones desde ArkType
    const news = await NewsService.create(req.body);
    AuditService.log(AUDIT_ACTIONS.NOTICIA_CREAR, AuditService.metaFromReq(req), 'noticia', news.id);
    res.status(201).json(news);
  });

  static update = manejar('Error actualizando noticia', async (req, res) => {
    const id = Number(req.params.id);
    const updated = await NewsService.update(id, req.body);
    AuditService.log(AUDIT_ACTIONS.NOTICIA_ACTUALIZAR, AuditService.metaFromReq(req), 'noticia', id);
    res.status(200).json(updated);
  });

  static delete = manejar('Error eliminando noticia', async (req, res) => {
    const id = Number(req.params.id);
    await NewsService.delete(id);
    AuditService.log(AUDIT_ACTIONS.NOTICIA_ELIMINAR, AuditService.metaFromReq(req), 'noticia', id);
    res.status(200).json({ message: 'Noticia eliminada correctamente' });
  });

}
