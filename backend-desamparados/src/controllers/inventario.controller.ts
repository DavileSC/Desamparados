import { Request, Response } from 'express';
import { InventarioService } from '../services/inventario.service.js';
import { handleHttp } from '../utils/error.handle.js';

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
      handleHttp(res, e, 'Error obteniendo ficha del enser', 404);
    }
  }

  static async createEnser(req: Request, res: Response) {
    try {
      const newItem = await InventarioService.createEnser(req.body);
      res.status(201).json(newItem);
    } catch (e) {
      handleHttp(res, e, 'Error creando registro de enser');
    }
  }

  static async updateEnser(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await InventarioService.updateEnser(id, req.body);
      res.status(200).json(updated);
    } catch (e) {
      handleHttp(res, e, 'Error actualizando enser');
    }
  }

  static async deleteEnser(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await InventarioService.deleteEnser(id);
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

  static async createPrenda(req: Request, res: Response) {
    try {
      const newItem = await InventarioService.createPrenda(req.body);
      res.status(201).json(newItem);
    } catch (e) {
      handleHttp(res, e, 'Error registrando nueva prenda');
    }
  }

  static async updatePrenda(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await InventarioService.updatePrenda(id, req.body);
      res.status(200).json(updated);
    } catch (e) {
      handleHttp(res, e, 'Error actualizando datos de la prenda');
    }
  }

  static async deletePrenda(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await InventarioService.deletePrenda(id);
      res.status(200).json({ message: 'Prenda eliminada del ropero' });
    } catch (e) {
      handleHttp(res, e, 'Error eliminando prenda');
    }
  }

  // --- LÓGICA DE ASIGNACIONES (PRÉSTAMOS Y DEVOLUCIONES) ---

  static async asignarPrenda(req: Request, res: Response) {
    try {
      const prendaId = Number(req.params.id);
      // Asumimos que el body trae { hermanoId: 123 } validado por ArkType
      const { hermanoId } = req.body; 

      const result = await InventarioService.asignarPrenda(prendaId, hermanoId);
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