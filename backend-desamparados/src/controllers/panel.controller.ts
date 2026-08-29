import { Response, Request } from 'express';
import { PanelService } from '../services/panel.service.js';
import { handleHttp } from '../utils/error.handle.js';

export class PanelController {
  static async get(_req: Request, res: Response) {
    try {
      res.status(200).json(await PanelService.getPanel());
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo el panel');
    }
  }
}
