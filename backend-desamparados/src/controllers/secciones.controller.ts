import { SeccionesService } from '../services/secciones.service.js';
import { manejar } from '../utils/manejar.js';
import { autorDeLaPeticion } from './contenido.controller.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../services/auditoria.service.js';

export class SeccionesController {
  /** GET /api/secciones (CMS) */
  static listar = manejar('Error obteniendo las secciones guardadas', async (_req, res) => {
    res.status(200).json(await SeccionesService.listar());
  });

  /** POST /api/secciones (CMS) */
  static crear = manejar('Error guardando la sección', async (req, res) => {
    const seccion = await SeccionesService.crear(req.body.nombre, req.body.bloques, autorDeLaPeticion(req));
    AuditoriaService.log(ACCIONES_AUDITORIA.SECCION_GUARDAR, AuditoriaService.metaFromReq(req), 'seccion', String(seccion.id));
    res.status(201).json(seccion);
  });

  /** DELETE /api/secciones/:id (CMS) */
  static borrar = manejar('Error borrando la sección', async (req, res) => {
    await SeccionesService.borrar(Number(req.params.id));
    AuditoriaService.log(ACCIONES_AUDITORIA.SECCION_BORRAR, AuditoriaService.metaFromReq(req), 'seccion', String(req.params.id));
    res.status(204).end();
  });
}
