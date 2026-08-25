import { Request, Response } from 'express';
import { PaginaService } from '../services/pagina.service.js';
import { handleHttp } from '../utils/error.handle.js';

export class PaginaController {

  /**
   * Obtener contenido de una página pública (ej: Historia).
   * GET /api/pages/:slug
   */
  static async getPage(req: Request, res: Response) {
    try {
      // ArkType garantiza que es un string seguro
      const slug = req.params.slug as string; 

      const pagina = await PaginaService.getPaginaBySlug(slug);

      if (!pagina) {
        return handleHttp(res, null, 'Página no encontrada', 404);
      }

      res.status(200).json(pagina);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo página');
    }
  }

  /**
   * Guardar (Crear/Editar) una página.
   * POST /api/pages
   */
static async createPage(req: Request, res: Response) {
    try {
      const result = await PaginaService.createPagina(req.body);
      res.status(201).json({ message: 'Página creada con éxito', data: result });
    } catch (e) {
      handleHttp(res, e, 'Error creando página');
    }
  }

  static async updatePage(req: Request, res: Response) {
    try {
      const slug = req.params.slug as string;
      const result = await PaginaService.updatePagina(slug, req.body);
      res.status(200).json({ message: 'Página actualizada correctamente', data: result });
    } catch (e) {
      handleHttp(res, e, 'Error actualizando página');
    }
  }

  /**
   * Eliminar una página del sistema.
   * DELETE /api/pages/:slug
   */
  static async deletePage(req: Request, res: Response) {
    try {
      // El slug viene validado por ArkType desde la ruta
      const slug = req.params.slug as string; 
      
      await PaginaService.deletePagina(slug);
      
      res.status(200).json({ message: `Página '${slug}' eliminada correctamente` });
    } catch (e) {
      handleHttp(res, e, 'Error eliminando página');
    }
  }

  /**
   * Listar todas las páginas (Menú Admin).
   * GET /api/pages/list-all
   */
  static async listAll(req: Request, res: Response) {
    try {
      const pages = await PaginaService.getAllSlugs();
      res.status(200).json(pages);
    } catch (e) {
      handleHttp(res, e, 'Error listando páginas');
    }
  }
}
