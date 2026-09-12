import { Response, Request } from 'express';
import { PanelService } from '../services/panel.service.js';
import { handleHttp } from '../utils/error.handle.js';

export class PanelController {
  static async get(req: Request, res: Response) {
    try {
      // El año inválido llega como HttpError desde el dominio y handleHttp lo
      // convierte en 400: es un parámetro mal puesto, no un fallo del servidor.
      res.status(200).json(await PanelService.getPanel(req.query.anio));
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo el panel');
    }
  }
}
