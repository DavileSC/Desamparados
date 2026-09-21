import { Request, Response } from 'express';
import { PaginaService } from '../services/pagina.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

export class PaginaController {

  /**
   * Obtener contenido de una página pública (ej: Historia).
   * GET /api/pages/:slug
   */
  static getPage = manejar('Error obteniendo página', async (req, res) => {
    // ArkType garantiza que es un string seguro
    const slug = req.params.slug as string; 

    const pagina = await PaginaService.getPaginaBySlug(slug);

    if (!pagina) {
      return handleHttp(res, null, 'Página no encontrada', 404);
    }

    res.status(200).json(pagina);
  });

  /**
   * Guardar (Crear/Editar) una página.
   * POST /api/pages
   */
  static createPage = manejar('Error creando página', async (req, res) => {
    const result = await PaginaService.createPagina(req.body);
    AuditoriaService.log(ACCIONES_AUDITORIA.PAGINA_GUARDAR, AuditoriaService.metaFromReq(req), 'pagina', result.slug);
    res.status(201).json({ message: 'Página creada con éxito', data: result });
  });

  static updatePage = manejar('Error actualizando página', async (req, res) => {
    const slug = req.params.slug as string;
    const result = await PaginaService.updatePagina(slug, req.body);
    AuditoriaService.log(ACCIONES_AUDITORIA.PAGINA_ACTUALIZAR, AuditoriaService.metaFromReq(req), 'pagina', slug);
    res.status(200).json({ message: 'Página actualizada correctamente', data: result });
  });

  /**
   * Eliminar una página del sistema.
   * DELETE /api/pages/:slug
   */
  static deletePage = manejar('Error eliminando página', async (req, res) => {
    // El slug viene validado por ArkType desde la ruta
    const slug = req.params.slug as string; 

    await PaginaService.deletePagina(slug);
    AuditoriaService.log(ACCIONES_AUDITORIA.PAGINA_ELIMINAR, AuditoriaService.metaFromReq(req), 'pagina', slug);

    res.status(200).json({ message: `Página '${slug}' eliminada correctamente` });
  });

  /**
   * Listar todas las páginas (Menú Admin).
   * GET /api/pages/list-all
   */
  static listAll = manejar('Error listando páginas', async (_req, res) => {
    const pages = await PaginaService.getAllSlugs();
    res.status(200).json(pages);
  });
}
