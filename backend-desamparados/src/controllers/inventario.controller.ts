import { Request, Response } from 'express';
import { InventarioService } from '../services/inventario.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { AuditService, AUDIT_ACTIONS } from '../services/audit.service.js';

export class InventarioController {

  // =================================================================
  //  BLOQUE 1: ENSERES (Albacería - Lotes)
  // =================================================================

  static async listEnseres(req: Request, res: Response) {
    try {
      // req.query viene limpio por ArkType (ej. search, categoria)
      const result = await InventarioService.getAllEnseres(req.query as any); 
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error listando los enseres');
    }
  }

  static async getOneEnser(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const enser = await InventarioService.getEnserById(id);
      res.status(200).json(enser);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo ficha del enser');
    }
  }

  static async createEnser(req: Request, res: Response) {
    try {
      const newItem = await InventarioService.createEnser(req.body);
      AuditService.log(AUDIT_ACTIONS.ENSER_CREAR, AuditService.metaFromReq(req), 'enser', newItem.id);
      res.status(201).json(newItem);
    } catch (e) {
      handleHttp(res, e, 'Error creando registro de enser');
    }
  }

  static async updateEnser(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await InventarioService.updateEnser(id, req.body);
      AuditService.log(AUDIT_ACTIONS.ENSER_ACTUALIZAR, AuditService.metaFromReq(req), 'enser', id);
      res.status(200).json(updated);
    } catch (e) {
      handleHttp(res, e, 'Error actualizando enser');
    }
  }

  static async deleteEnser(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await InventarioService.deleteEnser(id);
      AuditService.log(AUDIT_ACTIONS.ENSER_ELIMINAR, AuditService.metaFromReq(req), 'enser', id);
      res.status(200).json({ message: 'Enser eliminado del inventario' });
    } catch (e) {
      handleHttp(res, e, 'Error eliminando enser');
    }
  }

  // =================================================================
  //  BLOQUE 2: ROPERO (Túnicas, Capirotes, Faraonas)
  // =================================================================

  static async listPrendas(req: Request, res: Response) {
    try {
      const result = await InventarioService.getAllPrendas(req.query as any);
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error listando el ropero');
    }
  }

  static async getOnePrenda(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const prenda = await InventarioService.getPrendaById(id);
      res.status(200).json(prenda);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo ficha de la prenda');
    }
  }

  static async createPrenda(req: Request, res: Response) {
    try {
      const newItem = await InventarioService.createPrenda(req.body);
      AuditService.log(AUDIT_ACTIONS.PRENDA_CREAR, AuditService.metaFromReq(req), 'prenda', newItem.id);
      res.status(201).json(newItem);
    } catch (e) {
      handleHttp(res, e, 'Error registrando nueva prenda');
    }
  }

  static async updatePrenda(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await InventarioService.updatePrenda(id, req.body);
      AuditService.log(AUDIT_ACTIONS.PRENDA_ACTUALIZAR, AuditService.metaFromReq(req), 'prenda', id);
      res.status(200).json(updated);
    } catch (e) {
      handleHttp(res, e, 'Error actualizando datos de la prenda');
    }
  }

  static async deletePrenda(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await InventarioService.deletePrenda(id);
      AuditService.log(AUDIT_ACTIONS.PRENDA_ELIMINAR, AuditService.metaFromReq(req), 'prenda', id);
      res.status(200).json({ message: 'Prenda eliminada del ropero' });
    } catch (e) {
      handleHttp(res, e, 'Error eliminando prenda');
    }
  }

  // --- LÓGICA DE ASIGNACIONES (PRÉSTAMOS Y DEVOLUCIONES) ---

  static async buscarHermano(req: Request, res: Response) {
    try {
      const hermano = await InventarioService.buscarHermanoPorNumero(Number(req.params.numeroHermano));
      res.status(200).json(hermano);
    } catch (e) {
      handleHttp(res, e, 'Error buscando al hermano');
    }
  }

  static async asignarPrenda(req: Request, res: Response) {
    try {
      const prendaId = Number(req.params.id);
      // El body trae { numeroHermano: 123 } validado por ArkType (inventario.schema.ts)
      const { numeroHermano } = req.body;

      const result = await InventarioService.asignarPrenda(prendaId, numeroHermano);
      AuditService.log(AUDIT_ACTIONS.PRENDA_ASIGNAR, AuditService.metaFromReq(req), 'prenda', prendaId, { numeroHermano });
      res.status(200).json({ message: 'Prenda asignada correctamente', data: result });
    } catch (e) {
      handleHttp(res, e, 'Error al asignar la prenda al hermano');
    }
  }

  static async devolverPrenda(req: Request, res: Response) {
    try {
      const prendaId = Number(req.params.id);
      // Asumimos que el body trae { necesitaLavado: true/false } (opcional)
      const necesitaLavado = req.body.necesitaLavado === true;

      const result = await InventarioService.devolverPrenda(prendaId, necesitaLavado);
      AuditService.log(AUDIT_ACTIONS.PRENDA_DEVOLVER, AuditService.metaFromReq(req), 'prenda', prendaId, { necesitaLavado });
      res.status(200).json({ message: 'Prenda devuelta con éxito', data: result });
    } catch (e) {
      handleHttp(res, e, 'Error al procesar la devolución de la prenda');
    }
  }

  // =================================================================
  //  BLOQUE 3: DASHBOARD (Resumen Global)
  // =================================================================

  static async dashboard(req: Request, res: Response) {
    try {
      // Ahora trae tanto los datos de Albacería como de Ropero
      const resumen = await InventarioService.getResumenInventario();
      res.status(200).json(resumen);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo resumen del inventario');
    }
  }
}
