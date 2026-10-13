import { MenuService } from '../services/menu.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

export class MenuController {
  /** Sin sesión: la barra de la web la pinta para cualquiera. */
  static leer = manejar('Error leyendo los nombres del menú', async (_req, res) => {
    res.status(200).json({ nombres: await MenuService.leer() });
  });

  static guardar = manejar('Error guardando los nombres del menú', async (req, res) => {
    res.status(200).json({ nombres: await MenuService.guardar(req.body.nombres, AuditoriaService.metaFromReq(req)) });
  });

  static cambiar = manejar('Error guardando el nombre del menú', async (req, res) => {
    const { ruta, nombre } = req.body as { ruta: string; nombre: string };
    res.status(200).json({ nombres: await MenuService.cambiarUno(ruta, nombre, AuditoriaService.metaFromReq(req)) });
  });
}
