import { Request, Response } from 'express';
import { TransaccionService } from '../services/transaccion.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { AuditService } from '../services/audit.service.js';

export class TransaccionController {
  
  static async create(req: Request, res: Response) {
    try {
      const transaccion = await TransaccionService.create(req.body, AuditService.metaFromReq(req));
      res.status(201).json({ message: 'Apunte contable registrado', data: transaccion });
    } catch (e) {
      handleHttp(res, e, 'Error registrando la transacción');
    }
  }

  static async getLibroMayor(req: Request, res: Response) {
    try {
      // El saneamiento (defecto, tope) lo decide sanearPaginacion, no el controlador.
      const libro = await TransaccionService.getAll(req.query);
      res.status(200).json(libro);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo el libro mayor');
    }
  }

  static async getResumen(req: Request, res: Response) {
    try {
      const resumen = await TransaccionService.getResumen(req.query);
      res.status(200).json(resumen);
    } catch (e) {
      handleHttp(res, e, 'Error calculando el resumen contable');
    }
  }

  static async getDashboard(req: Request, res: Response) {
    try {
      const balance = await TransaccionService.getBalance();
      res.status(200).json(balance);
    } catch (e) {
      handleHttp(res, e, 'Error calculando el balance general');
    }
  }

  static async getCategorias(req: Request, res: Response) {
    try {
      // Opcional: ?tipo=INGRESO
      const tipo = req.query.tipo as 'INGRESO' | 'GASTO' | undefined;
      const categorias = await TransaccionService.getCategorias(tipo);
      res.status(200).json(categorias);
    } catch (e) { handleHttp(res, e, 'Error listando categorías'); }
  }

  static async createCategoria(req: Request, res: Response) {
    try {
      const { nombre, tipo } = req.body;
      const nueva = await TransaccionService.createCategoria(nombre, tipo, AuditService.metaFromReq(req));
      res.status(201).json({ message: 'Categoría creada', data: nueva });
    } catch (e) { handleHttp(res, e, 'Error creando categoría'); }
  }
}
