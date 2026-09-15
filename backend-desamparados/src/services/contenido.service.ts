import db from '../config/db.js';
import { mezclarConDefectos, porDefecto, type SlugContenido } from '../domain/contenido.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';

export class ContenidoService {
  /**
   * El documento de una página, ya mezclado con los textos de siempre. Si la
   * fila no existe (base recién creada, siembra no ejecutada), se devuelven los
   * valores por defecto en vez de un 404: la web pública no puede quedarse en
   * blanco porque falte una fila.
   */
  static async leer(slug: SlugContenido): Promise<unknown> {
    const fila = await db.contenidoPagina.findUnique({ where: { slug }, select: { datos: true } });
    return fila ? mezclarConDefectos(slug, fila.datos) : porDefecto(slug);
  }

  /**
   * Sustituye el documento entero. Ya viene validado por el esquema de su slug.
   *
   * Las fotos que salen del documento se borran del disco si ningún otro
   * registro las usa, igual que hace `PortadaService.guardarImagenes`. Sin
   * esto, cambiar la foto de «Sábado de Pasión» dejaría la anterior publicada
   * para siempre en /storage/public.
   */
  static async guardar(slug: SlugContenido, datos: object): Promise<unknown> {
    const anterior = await db.contenidoPagina.findUnique({ where: { slug }, select: { datos: true } });

    await db.contenidoPagina.upsert({
      where: { slug },
      update: { datos },
      create: { slug, datos },
    });

    await borrarSubidasHuerfanas(subidasEnTexto(JSON.stringify(anterior?.datos ?? {})), {
      conservar: subidasEnTexto(JSON.stringify(datos)),
    });

    return this.leer(slug);
  }
}
