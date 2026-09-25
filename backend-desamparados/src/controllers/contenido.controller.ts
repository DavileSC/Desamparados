import type { Request } from 'express';
import { ContenidoService } from '../services/contenido.service.js';
import { esSlugContenido } from '../domain/contenido.js';
import { NotFoundError } from '../utils/error.handle.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

/** El slug de la ruta, o un 404 si no es de ninguna página editable. */
function slugDe(req: Request) {
  const slug = req.params.slug;
  if (!esSlugContenido(slug)) throw new NotFoundError('Página no encontrada');
  return slug;
}

/** Quién está editando: la sesión del CMS, que es la que abre estas rutas. */
export const autorDeLaPeticion = (req: Request) => req.sesiones?.cms?.id ?? req.user?.id;

export class ContenidoController {
  /** GET /api/contenido/:slug (pública: la lee la web). */
  static leer = manejar('Error obteniendo el contenido de la página', async (req, res) => {
    res.status(200).json(await ContenidoService.leer(slugDe(req)));
  });

  /** PUT /api/contenido/:slug (CMS): sustituye el documento entero y deja una versión. */
  static guardar = manejar('Error guardando el contenido de la página', async (req, res) => {
    const slug = slugDe(req);
    const datos = await ContenidoService.guardar(slug, req.body.datos, autorDeLaPeticion(req));
    AuditoriaService.log(ACCIONES_AUDITORIA.CONTENIDO_ACTUALIZAR, AuditoriaService.metaFromReq(req), 'contenido', slug);
    res.status(200).json({ message: 'Contenido guardado', data: datos });
  });

  /** GET /api/contenido/:slug/versiones (CMS): el historial, sin los documentos. */
  static versiones = manejar('Error obteniendo el historial de la página', async (req, res) => {
    res.status(200).json(await ContenidoService.versiones(slugDe(req)));
  });

  /** GET /api/contenido/:slug/versiones/:id (CMS): el documento de una versión. */
  static version = manejar('Error obteniendo la versión de la página', async (req, res) => {
    res.status(200).json(await ContenidoService.version(slugDe(req), Number(req.params.id)));
  });
}
