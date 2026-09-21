import { PublicationService } from '../services/publication.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { AuditService, AUDIT_ACTIONS } from '../services/audit.service.js';
import type { AdminPublicationFilterDto } from '../dtos/publication.dto.js';
import { manejar } from '../utils/manejar.js';

export class PublicationController {
  static latest = manejar('Error obteniendo publicaciones destacadas', async (_req, res) => {
    res.status(200).json(await PublicationService.getLatest());
  });

  static list = manejar('Error obteniendo publicaciones', async (req, res) => {
    // La página y el tamaño llegan crudos: quien los sanea es el servicio.
    res.status(200).json(await PublicationService.getPublic(req.params.category as never, req.query));
  });

  // La query ya viene validada por adminPublicationQuerySchema.
  static adminList = manejar('Error obteniendo publicaciones', async (req, res) => {
    const { page, limit, q, estado, categoria } = req.query as AdminPublicationFilterDto;
    res.status(200).json(await PublicationService.getAdmin({ page, limit, q, estado, categoria }));
  });

  // Publicación individual del CMS por id, borradores incluidos: por eso la ruta
  // exige sesión y rol, a diferencia de los listados públicos.
  static getOne = manejar('Error obteniendo la publicación', async (req, res) => {
    const publication = await PublicationService.getOne(Number(req.params.id));
    if (!publication) return handleHttp(res, null, 'Publicación no encontrada', 404);
    res.status(200).json(publication);
  });

  static create = manejar('Error creando publicación', async (req, res) => {
    const publication = await PublicationService.create(req.body);
    AuditService.log(AUDIT_ACTIONS.PUBLICACION_CREAR, AuditService.metaFromReq(req), 'publicacion', publication.id);
    res.status(201).json(publication);
  });

  static update = manejar('Error actualizando publicación', async (req, res) => {
    const id = Number(req.params.id);
    const publication = await PublicationService.update(id, req.body);
    AuditService.log(AUDIT_ACTIONS.PUBLICACION_ACTUALIZAR, AuditService.metaFromReq(req), 'publicacion', id);
    res.status(200).json(publication);
  });

  static delete = manejar('Error eliminando publicación', async (req, res) => {
    await PublicationService.delete(Number(req.params.id));
    AuditService.log(AUDIT_ACTIONS.PUBLICACION_ELIMINAR, AuditService.metaFromReq(req), 'publicacion', Number(req.params.id));
    res.status(200).json({ message: 'Publicación eliminada correctamente' });
  });
}
