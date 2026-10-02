import { ModulosService } from '../services/modulos.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

export class ModulosController {
  /** Sin sesión: la web lo pide al arrancar, antes de pintar ningún menú. */
  static activos = manejar('Error leyendo los módulos', async (_req, res) => {
    res.status(200).json({ activos: [...(await ModulosService.activos())] });
  });

  static listar = manejar('Error leyendo los módulos', async (_req, res) => {
    res.status(200).json(await ModulosService.listarCms());
  });

  static cambiar = manejar('Error cambiando el módulo', async (req, res) => {
    const resultado = await ModulosService.cambiar(
      String(req.params.clave), req.body.activo === true, { conRequisitos: req.body.conRequisitos === true },
      req.user?.id, AuditoriaService.metaFromReq(req),
    );
    // Lo que no se puede hacer no es un fallo del servidor: es un 400 con las
    // listas, para que la pantalla proponga encender lo que falta o diga qué
    // apagar antes.
    if (!resultado.ok) {
      res.status(400).json({ status: 'error', message: resultado.message, faltan: resultado.faltan, dependientes: resultado.dependientes });
      return;
    }
    res.status(200).json(resultado);
  });
}
