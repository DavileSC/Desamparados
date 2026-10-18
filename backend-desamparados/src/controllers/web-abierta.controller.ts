import { WebAbiertaService } from '../services/web-abierta.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

export class WebAbiertaController {
  /** Sin sesión: la web lo pregunta antes de pintar nada. */
  static leer = manejar('Error leyendo si la web está abierta', async (_req, res) => {
    res.status(200).json(await WebAbiertaService.leer());
  });

  static guardar = manejar('Error abriendo o cerrando la web', async (req, res) => {
    res.status(200).json(await WebAbiertaService.guardar(req.body, AuditoriaService.metaFromReq(req)));
  });
}
