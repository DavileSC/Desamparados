import { ContenidoService } from '../services/contenido.service.js';
import { esSlugContenido } from '../domain/contenido.js';
import { handleHttp, NotFoundError } from '../utils/error.handle.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

export class ContenidoController {
  /** GET /api/contenido/:slug (pública: la lee la web). */
  static leer = manejar('Error obteniendo el contenido de la página', async (req, res) => {
    const slug = req.params.slug;
    if (!esSlugContenido(slug)) throw new NotFoundError('Página no encontrada');
    res.status(200).json(await ContenidoService.leer(slug));
  });

  /** PUT /api/contenido/:slug (CMS): sustituye el documento entero. */
  static guardar = manejar('Error guardando el contenido de la página', async (req, res) => {
    const slug = req.params.slug;
    if (!esSlugContenido(slug)) throw new NotFoundError('Página no encontrada');
    const datos = await ContenidoService.guardar(slug, req.body.datos);
    AuditoriaService.log(ACCIONES_AUDITORIA.CONTENIDO_ACTUALIZAR, AuditoriaService.metaFromReq(req), 'contenido', slug);
    res.status(200).json({ message: 'Contenido guardado', data: datos });
  });
}
