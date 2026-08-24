import { Response, Request } from 'express';
import { AgendaService } from '../services/agenda.service.js';
import { handleHttp } from '../utils/error.handle.js';

export class AgendaController {

  static async list(req: Request, res: Response) {
    try {
      const isHermano = !!req.user; 
      // Los query params ya vienen limpios y tipados gracias a ArkType
      const events = await AgendaService.getEvents(isHermano, req.query as any);
      res.status(200).json(events);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo agenda');
    }
  }

  static async getOne(req: Request, res: Response) {
    try {
      // Ya no hace falta isNaN, validateId en la ruta nos protege
      const id = Number(req.params.id); 
      const isHermano = !!req.user;

      const event = await AgendaService.getEventById(id, isHermano);
      res.status(200).json(event);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo evento', 403);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      // req.body validado por agendaSchema
      const event = await AgendaService.createEvent(req.body);
      res.status(201).json(event);
    } catch (e) {
      handleHttp(res, e, 'Error creando evento');
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await AgendaService.updateEvent(id, req.body);
      res.status(200).json(updated);
    } catch (e) {
      handleHttp(res, e, 'Error actualizando evento');
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await AgendaService.deleteEvent(id);
      res.status(200).json({ message: 'Evento eliminado' });
    } catch (e) {
      handleHttp(res, e, 'Error eliminando evento');
    }
  }
}