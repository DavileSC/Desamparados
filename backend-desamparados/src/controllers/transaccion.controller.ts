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

  static async update(req: Request, res: Response) {
    try {
      const transaccion = await TransaccionService.update(Number(req.params.id), req.body, AuditService.metaFromReq(req));
      res.status(200).json({ message: 'Apunte corregido', data: transaccion });
    } catch (e) {
      handleHttp(res, e, 'Error corrigiendo el apunte');
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const borrado = await TransaccionService.remove(Number(req.params.id), AuditService.metaFromReq(req));
      res.status(200).json({ message: 'Apunte borrado', data: borrado });
    } catch (e) {
      handleHttp(res, e, 'Error borrando el apunte');
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
      // Opcional: ?tipo=INGRESO y ?todas=true. Llegan ya validados por categoriasQuerySchema.
      const tipo = req.query.tipo as 'INGRESO' | 'GASTO' | undefined;
      const categorias = await TransaccionService.getCategorias(tipo, req.query.todas === 'true');
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

  static async renombrarCategoria(req: Request, res: Response) {
    try {
      const categoria = await TransaccionService.renombrarCategoria(Number(req.params.id), req.body.nombre, AuditService.metaFromReq(req));
      res.status(200).json({ message: 'Categoría renombrada', data: categoria });
    } catch (e) { handleHttp(res, e, 'Error renombrando la categoría'); }
  }

  static async cambiarEstadoCategoria(req: Request, res: Response) {
    try {
      const activa = req.body.activa as boolean;
      const categoria = await TransaccionService.cambiarEstadoCategoria(Number(req.params.id), activa, AuditService.metaFromReq(req));
      res.status(200).json({ message: activa ? 'Categoría reactivada' : 'Categoría desactivada', data: categoria });
    } catch (e) { handleHttp(res, e, 'Error cambiando el estado de la categoría'); }
  }
}
