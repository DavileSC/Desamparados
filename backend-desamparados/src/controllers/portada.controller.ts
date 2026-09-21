import { PortadaService } from '../services/portada.service.js';
import { ContenidoService } from '../services/contenido.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';
import { AuditService, AUDIT_ACTIONS } from '../services/audit.service.js';

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
    AuditService.log(AUDIT_ACTIONS.PORTADA_ACTUALIZAR, AuditService.metaFromReq(req), 'portada', 'imagenes');
    res.status(200).json({ message: 'Fotos de la portada guardadas', data: resultado });
  });
}
