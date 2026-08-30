import { Request, Response } from 'express';
import { handleHttp } from '../utils/error.handle';
import { HermanoService } from '../services/hermano.service';
import { AuditService } from '../services/audit.service';

export class HermanoController {

  // ========================================================
  // --- RUTAS FAMILIARES (Prevención BOLA/IDOR Crítica) ---
  // ========================================================

  static async getMyProfiles(req: Request, res: Response) {
    try {
      const userId = req.user!.id; 
      const perfiles = await HermanoService.getProfilesByUserId(userId);
      res.status(200).json(perfiles);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo los perfiles familiares');
    }
  }

  static async addProfile(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const newProfile = await HermanoService.createDependentProfile(userId, req.body);
      res.status(201).json(newProfile);
    } catch (e) {
      handleHttp(res, e, 'Error añadiendo perfil familiar');
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const hermanoId = Number(req.params.id);
      const userId = req.user!.id; 

      if (isNaN(hermanoId)) return handleHttp(res, null, 'ID inválido', 400);

      const updated = await HermanoService.updateProfileIfOwned(hermanoId, userId, req.body);
      
      if (!updated) {
        return handleHttp(res, 'IDOR_ATTEMPT', 'Perfil no encontrado o no autorizado', 403);
      }

      res.status(200).json({ message: 'Perfil actualizado correctamente', data: updated });
    } catch (e) {
      handleHttp(res, e, 'Error actualizando el perfil');
    }
  }

  static async deleteProfile(req: Request, res: Response) {
    try {
      const hermanoId = Number(req.params.id);
      const userId = req.user!.id;

      if (isNaN(hermanoId)) return handleHttp(res, null, 'ID inválido', 400);

      const deleted = await HermanoService.deleteProfileIfOwned(hermanoId, userId);
      
      if (!deleted) {
        return handleHttp(res, 'IDOR_ATTEMPT', 'No autorizado para dar de baja este perfil', 403);
      }

      res.status(200).json({ message: 'Perfil dado de baja' });
    } catch (e) {
      handleHttp(res, e, 'Error eliminando perfil');
    }
  }

  static async emancipate(req: Request, res: Response) {
    try {
      const hermanoId = Number(req.params.id);
      const userId = req.user!.id;

      if (isNaN(hermanoId)) return handleHttp(res, null, 'ID inválido', 400);

      const result = await HermanoService.emancipateProfile(hermanoId, userId, req.body, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error en el proceso de emancipación');
    }
  }

  /** Secretaría emancipa a un hermano: al hermano le llega un enlace. */
  static async emancipateByStaff(req: Request, res: Response) {
    try {
      const hermanoId = Number(req.params.id);
      if (isNaN(hermanoId)) return handleHttp(res, null, 'ID inválido', 400);

      const result = await HermanoService.emancipateByStaff(hermanoId, req.body, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error en el proceso de emancipación');
    }
  }

  // ========================================================
  // --- RUTAS ADMIN (Secretaría) ---
  // ========================================================

  static async search(req: Request, res: Response) {
    try {
      const result = await HermanoService.searchHermanos(req.query);
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error en el buscador de hermanos');
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      // El saneamiento (defecto, tope) lo decide sanearPaginacion, no el controlador.
      const hermanos = await HermanoService.getAllHermanos(req.query);
      res.status(200).json(hermanos);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo el censo de la cofradía');
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const hermanoId = Number(req.params.id);
      if (isNaN(hermanoId)) return handleHttp(res, null, 'ID inválido', 400);

      const hermano = await HermanoService.getHermanoById(hermanoId);
      if (!hermano) return handleHttp(res, null, 'Hermano no encontrado', 404);

      res.status(200).json(hermano);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo la ficha del hermano');
    }
  }

  static async updateAdmin(req: Request, res: Response) {
    try {
      const hermanoId = Number(req.params.id);
      if (isNaN(hermanoId)) return handleHttp(res, null, 'ID inválido', 400);

      const updated = await HermanoService.updateAdminMode(hermanoId, req.body);
      res.status(200).json(updated);
    } catch (e) {
      handleHttp(res, e, 'Error actualizando ficha desde Secretaría');
    }
  }

  static async reordenarCenso(req: Request, res: Response) {
    try {
      const result = await HermanoService.reordenarCenso(AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error crítico al intentar reordenar el censo');
    }
  }

  static async getSolicitudes(req: Request, res: Response) {
    try {
      // La ruta no pasa por `validate`: sanearPaginacion() ya defiende los
      // parámetros crudos de req.query (defecto y tope incluidos).
      const solicitudes = await HermanoService.getSolicitudesPendientes(req.query);
      res.status(200).json(solicitudes);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo las solicitudes pendientes');
    }
  }

  static async aprobarSolicitud(req: Request, res: Response) {
    try {
      const userId = Number(req.params.id);
      if (isNaN(userId)) return handleHttp(res, null, 'ID inválido', 400);

      const result = await HermanoService.aprobarSolicitud(userId, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error aprobando la solicitud');
    }
  }

  static async rechazarSolicitud(req: Request, res: Response) {
    try {
      const userId = Number(req.params.id);
      if (isNaN(userId)) return handleHttp(res, null, 'ID inválido', 400);

      const result = await HermanoService.rechazarSolicitud(userId, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error rechazando la solicitud');
    }
  }

  static async darDeBajaHermano(req: Request, res: Response) {
    try {
      const hermanoId = Number(req.params.id);
      if (isNaN(hermanoId)) return handleHttp(res, null, 'ID inválido', 400);

      const result = await HermanoService.darDeBajaHermano(hermanoId, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error dando de baja al hermano');
    }
  }

  static async reactivarHermano(req: Request, res: Response) {
    try {
      const hermanoId = Number(req.params.id);
      if (isNaN(hermanoId)) return handleHttp(res, null, 'ID inválido', 400);

      const result = await HermanoService.reactivarHermano(hermanoId, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error reactivando al hermano');
    }
  }
}