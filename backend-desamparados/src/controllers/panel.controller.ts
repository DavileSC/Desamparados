import { Response, Request } from 'express';
import { PanelService } from '../services/panel.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';

export class PanelController {
  static get = manejar('Error obteniendo el panel', async (req, res) => {
    // El año inválido llega como HttpError desde el dominio y handleHttp lo
    // convierte en 400: es un parámetro mal puesto, no un fallo del servidor.
    res.status(200).json(await PanelService.getPanel(req.query.anio));
  });
}
