import { PublicacionService } from '../services/publicacion.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../services/auditoria.service.js';
import type { FiltroPublicacionesCmsDto } from '../dtos/publicacion.dto.js';
import { manejar } from '../utils/manejar.js';

export class PublicacionController {
  static latest = manejar('Error obteniendo publicaciones destacadas', async (_req, res) => {
    res.status(200).json(await PublicacionService.deLaPortada());
  });

  static list = manejar('Error obteniendo publicaciones', async (req, res) => {
    // La página y el tamaño llegan crudos: quien los sanea es el servicio.
    res.status(200).json(await PublicacionService.listadoPublico(req.params.category as never, req.query));
  });

  // La query ya viene validada por publicacionesCmsQuerySchema.
  static adminList = manejar('Error obteniendo publicaciones', async (req, res) => {
    const { page, limit, q, estado, categoria } = req.query as FiltroPublicacionesCmsDto;
    res.status(200).json(await PublicacionService.listadoDelCms({ page, limit, q, estado, categoria }));
  });

  // Publicación individual del CMS por id, borradores incluidos: por eso la ruta
  // exige sesión y rol, a diferencia de los listados públicos.
  static getOne = manejar('Error obteniendo la publicación', async (req, res) => {
    const publication = await PublicacionService.porId(Number(req.params.id));
    if (!publication) return handleHttp(res, null, 'Publicación no encontrada', 404);
    res.status(200).json(publication);
  });

  static create = manejar('Error creando publicación', async (req, res) => {
    const publication = await PublicacionService.crear(req.body);
    AuditoriaService.log(ACCIONES_AUDITORIA.PUBLICACION_CREAR, AuditoriaService.metaFromReq(req), 'publicacion', publication.id);
    res.status(201).json(publication);
  });

  static update = manejar('Error actualizando publicación', async (req, res) => {
    const id = Number(req.params.id);
    const publication = await PublicacionService.actualizar(id, req.body);
    AuditoriaService.log(ACCIONES_AUDITORIA.PUBLICACION_ACTUALIZAR, AuditoriaService.metaFromReq(req), 'publicacion', id);
    res.status(200).json(publication);
  });

  static delete = manejar('Error eliminando publicación', async (req, res) => {
    await PublicacionService.eliminar(Number(req.params.id));
    AuditoriaService.log(ACCIONES_AUDITORIA.PUBLICACION_ELIMINAR, AuditoriaService.metaFromReq(req), 'publicacion', Number(req.params.id));
    res.status(200).json({ message: 'Publicación eliminada correctamente' });
  });
}
