import { PortadaService } from '../services/portada.service.js';
import { ContenidoService } from '../services/contenido.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../services/auditoria.service.js';

export class PortadaController {
  /**
   * GET /api/portada (pública). Devuelve fotos y textos juntos porque el hero
   * ya espera a esta llamada antes de pintar: así la portada entera no cuesta
   * ni una petición más de las que ya hacía.
   */
  static listar = manejar('Error obteniendo la portada', async (_req, res) => {
    const [imagenes, textos] = await Promise.all([
      PortadaService.listarImagenes(),
      ContenidoService.leer('portada'),
    ]);
    res.status(200).json({ imagenes, textos });
  });

  /** PUT /api/portada/imagenes (CMS): sustituye la lista entera. */
  static guardar = manejar('Error guardando las fotos de la portada', async (req, res) => {
    const { imagenes } = req.body; // Validado por ArkType
    const resultado = await PortadaService.guardarImagenes(imagenes);
    AuditoriaService.log(ACCIONES_AUDITORIA.PORTADA_ACTUALIZAR, AuditoriaService.metaFromReq(req), 'portada', 'imagenes');
    res.status(200).json({ message: 'Fotos de la portada guardadas', data: resultado });
  });
}
