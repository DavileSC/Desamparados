import { CorporacionService } from '../services/corporacion.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

export class CorporacionController {
  /** Sin sesión: el pie, los textos legales y el alta la necesitan para cualquiera. */
  static leer = manejar('Error leyendo los datos de la corporación', async (_req, res) => {
    res.status(200).json(await CorporacionService.leer());
  });

  static guardar = manejar('Error guardando los datos de la corporación', async (req, res) => {
    res.status(200).json(await CorporacionService.guardar(req.body, AuditoriaService.metaFromReq(req)));
  });
}
